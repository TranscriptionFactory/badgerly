use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Frontmatter {
    pub tags: Vec<String>,
    pub properties: BTreeMap<String, serde_yml::Value>,
}

pub fn extract_frontmatter(markdown: &str) -> Frontmatter {
    let mut frontmatter = Frontmatter::default();

    if !markdown.starts_with("---") {
        return frontmatter;
    }

    let Some(first_newline) = markdown.find('\n') else {
        return frontmatter;
    };
    
    let first_line = markdown[..first_newline].trim();
    if first_line != "---" {
        return frontmatter;
    }

    // Look for the end of the frontmatter
    let Some(end_index) = markdown[first_newline + 1..].find("\n---") else {
        return frontmatter;
    };

    let yaml_str = &markdown[first_newline + 1..first_newline + 1 + end_index];
    let Ok(value): Result<serde_yml::Value, _> = serde_yml::from_str(yaml_str) else {
        return frontmatter;
    };

    if let Some(map) = value.as_mapping() {
        for (k, v) in map {
            let Some(key) = k.as_str() else {
                continue;
            };

            if key == "tags" || key == "tag" {
                if let Some(tags) = v.as_sequence() {
                    for tag in tags {
                        if let Some(tag_str) = tag.as_str() {
                            frontmatter.tags.push(tag_str.to_string());
                        }
                    }
                } else if let Some(tag_str) = v.as_str() {
                    frontmatter.tags.push(tag_str.to_string());
                } else if let Some(tag_num) = v.as_u64() {
                    frontmatter.tags.push(tag_num.to_string());
                }
            } else {
                frontmatter.properties.insert(key.to_string(), v.clone());
            }
        }
    }

    frontmatter
}

pub fn strip_frontmatter(markdown: &str) -> &str {
    if !markdown.starts_with("---") {
        return markdown;
    }
    let Some(first_newline) = markdown.find('\n') else {
        return markdown;
    };
    let first_line = markdown[..first_newline].trim();
    if first_line != "---" {
        return markdown;
    }
    let Some(end_index) = markdown[first_newline + 1..].find("\n---") else {
        return markdown;
    };
    let after_close = first_newline + 1 + end_index + 4;
    if after_close >= markdown.len() {
        return "";
    }
    &markdown[after_close..]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_no_frontmatter() {
        assert_eq!(strip_frontmatter("hello world"), "hello world");
    }

    #[test]
    fn strip_with_frontmatter() {
        let md = "---\ntitle: Test\ntags: [a, b]\n---\nBody content here";
        assert_eq!(strip_frontmatter(md), "\nBody content here");
    }

    #[test]
    fn strip_frontmatter_only() {
        let md = "---\ntitle: Test\n---";
        assert_eq!(strip_frontmatter(md), "");
    }

    #[test]
    fn strip_frontmatter_with_trailing_newline() {
        let md = "---\nk: v\n---\n";
        assert_eq!(strip_frontmatter(md), "\n");
    }

    #[test]
    fn extract_tags_from_sequence() {
        let md = "---\ntags: [rust, test]\n---\nbody";
        let fm = extract_frontmatter(md);
        assert_eq!(fm.tags, vec!["rust", "test"]);
        assert!(fm.properties.is_empty());
    }

    #[test]
    fn extract_properties() {
        let md = "---\nstatus: draft\npriority: 1\n---\nbody";
        let fm = extract_frontmatter(md);
        assert!(fm.tags.is_empty());
        assert_eq!(fm.properties.len(), 2);
        assert_eq!(fm.properties["status"].as_str(), Some("draft"));
    }
}
