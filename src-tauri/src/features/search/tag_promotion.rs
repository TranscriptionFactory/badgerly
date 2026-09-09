use serde_json::Value;
use std::collections::HashSet;

pub(crate) fn promoted_setting_from_value(value: Option<&Value>) -> Vec<String> {
    let _ = value;
    todo!("lane C phase 2")
}

pub(crate) fn promoted_set(setting: &[String], frontmatter_tags: &[String]) -> HashSet<String> {
    let _ = (setting, frontmatter_tags);
    todo!("lane C phase 2")
}

pub(crate) fn is_promoted(tag: &str, set: &HashSet<String>) -> bool {
    let _ = (tag, set);
    todo!("lane C phase 2")
}
