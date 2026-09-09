use serde_json::Value;
use std::collections::HashSet;

pub(crate) fn promoted_setting_from_value(value: Option<&Value>) -> Vec<String> {
    let Some(Value::Array(entries)) = value else {
        return Vec::new();
    };
    entries
        .iter()
        .filter_map(Value::as_str)
        .map(|raw| raw.trim().strip_prefix('#').unwrap_or(raw.trim()).trim())
        .filter(|tag| !tag.is_empty())
        .map(str::to_string)
        .collect()
}

pub(crate) fn promoted_set(setting: &[String], frontmatter_tags: &[String]) -> HashSet<String> {
    setting
        .iter()
        .chain(frontmatter_tags)
        .map(|tag| tag.to_lowercase())
        .collect()
}

pub(crate) fn is_promoted(tag: &str, set: &HashSet<String>) -> bool {
    let lowered = tag.to_lowercase();
    lowered
        .match_indices('/')
        .map(|(idx, _)| &lowered[..idx])
        .chain(std::iter::once(lowered.as_str()))
        .any(|prefix| set.contains(prefix))
}
