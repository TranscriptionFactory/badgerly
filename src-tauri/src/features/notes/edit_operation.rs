use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct NativeEditOperation {
    pub path: String,
    pub base_content: String,
    pub base_revision: String,
    pub start: u32,
    pub end: u32,
    pub text: String,
}

pub fn note_revision(content: &str) -> String {
    let mut a = 0x811c9dc5u32;
    let mut b = 0x9e3779b9u32;
    for code in content.encode_utf16() {
        a = (a ^ u32::from(code)).wrapping_mul(0x01000193);
        b = (b ^ u32::from(code)).wrapping_mul(0x01000193);
    }
    format!("{a:08x}{b:08x}")
}

pub fn replacement_operations(path: &str, base: &str, old: &str, new: &str, replace_all: bool) -> Result<Vec<NativeEditOperation>, String> {
    if old.is_empty() || old == new { return Err("replacement text must be non-empty and changed".into()); }
    let matches: Vec<_> = base.match_indices(old).collect();
    if matches.is_empty() || (!replace_all && matches.len() != 1) { return Err("replacement must match uniquely unless replace_all is set".into()); }
    Ok(matches.into_iter().map(|(start, text)| NativeEditOperation {
        path: path.into(), base_content: base.into(), base_revision: note_revision(base),
        start: base[..start].encode_utf16().count() as u32,
        end: base[..start + text.len()].encode_utf16().count() as u32,
        text: new.into(),
    }).collect())
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EditKind {
    ReplaceSpan { start: u32, end: u32, text: String },
    InsertAtHeading { heading: String, text: String },
    SetFrontmatter { key: String, value: serde_json::Value },
    RenameWithRepair { to_path: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct StructuredEditOperation {
    #[serde(default)]
    pub base_revision: String,
    #[serde(default)]
    pub hunk_id: String,
    #[serde(flatten)]
    pub edit: EditKind,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct NativeProposal {
    pub vault_id: String,
    pub path: String,
    pub base_content: String,
    pub operations: Vec<StructuredEditOperation>,
}

pub fn prepare_native_proposal(vault_id: String, path: String, base_content: String, mut operations: Vec<StructuredEditOperation>) -> Result<NativeProposal, String> {
    if operations.is_empty() { return Err("operations must not be empty".into()); }
    let revision = note_revision(&base_content);
    let mut ids = std::collections::HashSet::new();
    let operation_count = operations.len();
    for (index, operation) in operations.iter_mut().enumerate() {
        if operation.base_revision.is_empty() { operation.base_revision = revision.clone(); }
        if operation.base_revision != revision { return Err("conflict: base revision changed".into()); }
        if operation.hunk_id.is_empty() { operation.hunk_id = format!("operation-{index}"); }
        if !ids.insert(operation.hunk_id.clone()) { return Err("operation hunk ids must be unique".into()); }
        match &operation.edit {
            EditKind::ReplaceSpan { start, end, .. } if start > end || *end as usize > base_content.encode_utf16().count() || !utf16_boundary(&base_content, *start) || !utf16_boundary(&base_content, *end) => return Err("invalid replacement span".into()),
            EditKind::InsertAtHeading { heading, .. } if heading.trim().is_empty() => return Err("heading must not be empty".into()),
            EditKind::SetFrontmatter { key, .. } if key.trim().is_empty() || ["__proto__", "constructor", "prototype"].contains(&key.as_str()) => return Err("invalid frontmatter key".into()),
            EditKind::RenameWithRepair { to_path } if to_path == &path || operation_count != 1 || !valid_operation_path(to_path) => return Err("invalid rename target".into()),
            _ => {}
        }
    }
    if !valid_operation_path(&path) { return Err("invalid note path".into()); }
    Ok(NativeProposal { vault_id, path, base_content, operations })
}

fn valid_operation_path(path: &str) -> bool {
    path.to_lowercase().ends_with(".md") && !path.contains('\\') && path.split('/').all(|part| !part.is_empty() && !part.starts_with('.'))
}

pub fn operation_schema() -> serde_json::Value {
    use serde_json::json;
    let variants = [
        ("replace_span", json!({"start": {"type":"integer", "minimum":0}, "end": {"type":"integer", "minimum":0}, "text":{"type":"string"}}), vec!["start", "end", "text"]),
        ("insert_at_heading", json!({"heading":{"type":"string", "minLength":1}, "text":{"type":"string"}}), vec!["heading", "text"]),
        ("set_frontmatter", json!({"key":{"type":"string", "minLength":1}, "value":{}}), vec!["key", "value"]),
        ("rename_with_repair", json!({"to_path":{"type":"string", "minLength":1}}), vec!["to_path"]),
    ];
    serde_json::Value::Array(variants.into_iter().map(|(kind, mut properties, fields)| {
        let map = properties.as_object_mut().expect("schema object");
        map.insert("kind".into(), json!({"type":"string", "enum":[kind]}));
        map.insert("base_revision".into(), json!({"type":"string"}));
        map.insert("hunk_id".into(), json!({"type":"string"}));
        let required: Vec<_> = std::iter::once("kind").chain(fields).collect();
        json!({"type":"object", "properties":properties, "required":required, "additionalProperties":false})
    }).collect())
}

fn utf16_boundary(content: &str, offset: u32) -> bool {
    let mut position = 0;
    for character in content.chars() {
        if position == offset { return true; }
        position += character.len_utf16() as u32;
    }
    position == offset
}
