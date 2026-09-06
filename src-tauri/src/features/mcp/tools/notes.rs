use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::features::mcp::shared_ops::{self, CreateResult, OpError, VAULT_ID_OPTIONAL_DESC};
use crate::features::mcp::tools::{op_err_to_tool_result, parse_args, prop};
use crate::features::mcp::types::{InputSchema, PropertySchema, ToolDefinition, ToolResult};
use crate::features::notes::service::file_meta;
use crate::features::search::db as search_db;
use crate::features::search::model::{
    BaseFilter, BaseNoteRow, BaseQuery, BaseQueryResults, BaseSort,
};
use crate::features::search::service as search_service;
use crate::features::vault_settings::service::get_vault_setting_value;

pub(crate) const DEFAULT_MEMORY_FOLDER: &str = "Memory";
const MEMORY_PROPERTY: &str = "memory";
const MEMORY_LIST_DEFAULT: usize = 50;
const MEMORY_LIST_MAX: usize = 200;
const MEMORY_LOOKUP_LIMIT: usize = 10_000;

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct NoteContentArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub path: String,
    pub content: String,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct EditNoteArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub path: String,
    #[serde(default)]
    pub old_string: String,
    #[serde(default)]
    pub new_string: String,
    #[serde(default)]
    pub operation: Option<crate::features::notes::edit_operation::StructuredEditOperation>,
    #[serde(default)]
    pub replace_all: bool,
}

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        list_notes_def(),
        read_note_def(),
        create_note_def(),
        update_note_def(),
        edit_note_def(),
        delete_note_def(),
        append_note_def(),
        prepend_note_def(),
        ensure_frontmatter_def(),
        list_memories_def(),
        save_memory_def(),
    ]
}

pub fn dispatch(app: &AppHandle, name: &str, arguments: Option<&Value>) -> Option<ToolResult> {
    match name {
        "list_notes" => Some(handle_list_notes(app, arguments)),
        "read_note" => Some(handle_read_note(app, arguments)),
        "create_note" => Some(handle_create_note(app, arguments)),
        "update_note" => Some(handle_update_note(app, arguments)),
        "edit_note" => Some(handle_edit_note(app, arguments)),
        "delete_note" => Some(handle_delete_note(app, arguments)),
        "append_note" => Some(handle_append_note(app, arguments)),
        "prepend_note" => Some(handle_prepend_note(app, arguments)),
        "ensure_frontmatter" => Some(handle_ensure_frontmatter(app, arguments)),
        "list_memories" => Some(handle_list_memories(app, arguments)),
        "save_memory" => Some(handle_save_memory(app, arguments)),
        _ => None,
    }
}

fn list_notes_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "folder".into(),
        prop("string", "Optional. Vault-relative folder path to filter by (e.g. 'projects/active'). Omit to list all notes."),
    );
    properties.insert(
        "limit".into(),
        PropertySchema {
        schema: Default::default(),
            prop_type: "integer".into(),
            description: Some("Optional. Maximum number of results to return (default: 200, max: 500)".into()),
            enum_values: None,
            default: Some(Value::Number(200.into())),
        },
    );
    properties.insert(
        "offset".into(),
        PropertySchema {
        schema: Default::default(),
            prop_type: "integer".into(),
            description: Some("Optional. Number of results to skip for pagination (default: 0)".into()),
            enum_values: None,
            default: Some(Value::Number(0.into())),
        },
    );

    ToolDefinition {
        name: "list_notes".into(),
        mutating: false,
        description: "List notes in a vault with pagination. Returns tab-separated lines of path and title, plus a count summary. Use folder to filter by directory. Use search_notes for full-text search, or query_notes_by_property to filter by frontmatter fields.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into()],
        },
    }
}

fn read_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "path".into(),
        prop(
            "string",
            "Vault-relative path to the note (e.g. 'folder/note.md')",
        ),
    );

    ToolDefinition {
        name: "read_note".into(),
        mutating: false,
        description: "Read the full markdown content of a note, including frontmatter. Returns raw markdown as a single text block. Use get_note_metadata instead if you only need title, tags, properties, or stats.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into(), "path".into()],
        },
    }
}

fn create_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "path".into(),
        prop(
            "string",
            "Vault-relative path for the new note. Must end in .md (e.g. 'projects/new-idea.md'). Parent directories are created automatically.",
        ),
    );
    properties.insert("content".into(), prop("string", "Initial markdown content (including any frontmatter)"));
    properties.insert(
        "overwrite".into(),
        PropertySchema {
        schema: Default::default(),
            prop_type: "boolean".into(),
            description: Some("Optional. If true, replace the note when one already exists at the path instead of failing (default: false).".into()),
            enum_values: None,
            default: Some(Value::Bool(false)),
        },
    );

    ToolDefinition {
        name: "create_note".into(),
        mutating: true,
        description: "Create a new note. Fails with a conflict error if a note already exists at the given path, unless overwrite is true. Use update_note or edit_note to modify existing notes. Returns the created (or overwritten) path on success.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into(), "path".into(), "content".into()],
        },
    }
}

fn update_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path to the note (e.g. 'folder/note.md')"),
    );
    properties.insert(
        "content".into(),
        prop("string", "New markdown content (replaces entire file, including frontmatter)"),
    );

    ToolDefinition {
        name: "update_note".into(),
        mutating: true,
        description: "Replace the full content of an existing note. Fails if the note does not exist — use create_note for new notes. Returns the updated path and modification timestamp.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into(), "path".into(), "content".into()],
        },
    }
}

fn edit_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path to the note (e.g. 'folder/note.md')"),
    );
    properties.insert(
        "old_string".into(),
        prop("string", "The exact text to replace. Must match a unique occurrence in the note unless replace_all is true."),
    );
    properties.insert(
        "new_string".into(),
        prop("string", "The text to replace old_string with. Must differ from old_string."),
    );
    properties.insert(
        "replace_all".into(),
        PropertySchema {
        schema: Default::default(),
            prop_type: "boolean".into(),
            description: Some("Optional. Replace every occurrence of old_string instead of requiring a unique match (default: false).".into()),
            enum_values: None,
            default: Some(Value::Bool(false)),
        },
    );

    let mut operation = prop("object", "Typed proposal-only edit; no files change until the user accepts it. Use instead of old_string/new_string. Missing base_revision and hunk_id are filled from the current note.");
    operation.schema.insert("anyOf".into(), crate::features::notes::edit_operation::operation_schema());
    properties.insert("operation".into(), operation);

    ToolDefinition {
        name: "edit_note".into(),
        mutating: true,
        description: "Make a targeted edit to an existing note by replacing old_string with new_string. Fails if old_string is not found, or if it matches more than once and replace_all is not set. Prefer this over update_note when changing part of a note. Returns the path and number of replacements.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["path".into()],
        },
    }
}

fn delete_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path to the note to delete (e.g. 'folder/note.md')"),
    );

    ToolDefinition {
        name: "delete_note".into(),
        mutating: true,
        description: "Permanently delete a note from the vault. Fails if the note does not exist. Returns the deleted path on success.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into(), "path".into()],
        },
    }
}

fn handle_list_notes(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::ListNotesArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let limit = args.limit.unwrap_or(200).min(500);
    let offset = args.offset.unwrap_or(0);

    match shared_ops::list_notes(app, &args.vault_id, args.folder.as_deref(), limit, offset) {
        Ok(paginated) => {
            let lines: Vec<String> = paginated
                .items
                .iter()
                .map(|n| format!("{}\t{}", n.path, n.title))
                .collect();
            let end = (offset + paginated.items.len()).min(paginated.total);
            let mut output = lines.join("\n");
            output.push_str(&format!(
                "\n(showing {}-{} of {})",
                if paginated.items.is_empty() {
                    0
                } else {
                    offset + 1
                },
                end,
                paginated.total
            ));
            ToolResult::text(output)
        }
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_read_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::VaultPathArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    match shared_ops::read_note(app, &args.vault_id, &args.path) {
        Ok((_, content)) => ToolResult::text(content),
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_create_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::CreateNoteArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    match shared_ops::create_note(app, &args) {
        Ok(CreateResult::Created(meta)) => ToolResult::text(format!("Created: {}", meta.path)),
        Ok(CreateResult::Overwritten(path)) => ToolResult::text(format!("Overwritten: {}", path)),
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_update_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::WriteNoteArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    match shared_ops::write_note(app, &args.vault_id, &args.path, &args.content) {
        Ok(path) => {
            let root = crate::shared::storage::vault_path(app, &args.vault_id);
            let mtime = root
                .ok()
                .and_then(|r| crate::features::notes::service::safe_vault_abs(&r, &path).ok())
                .and_then(|abs| file_meta(&abs).ok())
                .map(|(m, _, _)| m)
                .unwrap_or(0);
            ToolResult::text(format!("Updated: {} (mtime={})", path, mtime))
        }
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_edit_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: EditNoteArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };

    if let Some(operation) = args.operation {
        if !args.old_string.is_empty() || !args.new_string.is_empty() || args.replace_all {
            return ToolResult::error("typed operations cannot be combined with find/replace arguments".into());
        }
        let (_, content) = match shared_ops::read_note(app, &vault_id, &args.path) {
            Ok(note) => note,
            Err(error) => return op_err_to_tool_result(error),
        };
        return match crate::features::notes::edit_operation::prepare_native_proposal(vault_id, args.path, content, vec![operation]) {
            Ok(proposal) => {
                let mut result = ToolResult::text("Edits proposed for review; no files changed.".into());
                result.proposals.push(proposal);
                result
            }
            Err(error) => ToolResult::error(error),
        };
    }

    match shared_ops::edit_note(
        app,
        &vault_id,
        &args.path,
        &args.old_string,
        &args.new_string,
        args.replace_all,
    ) {
        Ok((path, replacements, operations)) => {
            let mut result = ToolResult::text(format!("Edited: {} ({} replacement(s))", path, replacements));
            result.edit_operations = operations;
            result
        }
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_delete_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::VaultPathArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    match shared_ops::delete_note(app, &args.vault_id, &args.path) {
        Ok(()) => ToolResult::text(format!("Deleted: {}", args.path)),
        Err(e) => op_err_to_tool_result(e),
    }
}

fn append_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path of the note to append to"),
    );
    properties.insert(
        "content".into(),
        prop("string", "Content to append at the end of the note"),
    );

    ToolDefinition {
        name: "append_note".into(),
        mutating: true,
        description: "Append content to the end of an existing note. Use this to add new sections, paragraphs, or entries without overwriting existing content.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["path".into(), "content".into()],
        },
    }
}

fn prepend_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path of the note to prepend to"),
    );
    properties.insert(
        "content".into(),
        prop("string", "Content to insert after frontmatter (or at the start if no frontmatter)"),
    );

    ToolDefinition {
        name: "prepend_note".into(),
        mutating: true,
        description: "Insert content at the beginning of a note, after any YAML frontmatter. Use this to add content to the top of a note without disturbing metadata.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["path".into(), "content".into()],
        },
    }
}

fn handle_append_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: NoteContentArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };

    match shared_ops::append_to_note(app, &vault_id, &args.path, &args.content) {
        Ok(path) => ToolResult::text(format!("Appended to: {}", path)),
        Err(e) => op_err_to_tool_result(e),
    }
}

fn handle_prepend_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: NoteContentArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };

    match shared_ops::prepend_to_note(app, &vault_id, &args.path, &args.content) {
        Ok(path) => ToolResult::text(format!("Prepended to: {}", path)),
        Err(e) => op_err_to_tool_result(e),
    }
}

fn ensure_frontmatter_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert(
        "vault_id".into(),
        prop("string", "Vault identifier (use list_vaults to discover IDs)"),
    );
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path of the note to ensure frontmatter for"),
    );

    ToolDefinition {
        name: "ensure_frontmatter".into(),
        mutating: true,
        description: "Add title and date_created frontmatter to a note if it doesn't already have any. Idempotent: no-op if frontmatter exists.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into(), "path".into()],
        },
    }
}

fn handle_ensure_frontmatter(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: shared_ops::VaultPathArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    match shared_ops::ensure_frontmatter(app, &args.vault_id, &args.path) {
        Ok(path) => ToolResult::text(format!("Frontmatter ensured: {}", path)),
        Err(e) => op_err_to_tool_result(e),
    }
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct ListMemoriesArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct SaveMemoryArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub source_session: Option<String>,
}

fn list_memories_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "limit".into(),
        PropertySchema {
        schema: Default::default(),
            prop_type: "integer".into(),
            description: Some("Optional. Maximum number of memories to return (default: 50, max: 200)".into()),
            enum_values: None,
            default: Some(Value::Number(MEMORY_LIST_DEFAULT.into())),
        },
    );

    ToolDefinition {
        name: "list_memories".into(),
        mutating: false,
        description: "List the memories saved for this vault: every note with `memory: true` frontmatter, wherever it lives, newest first. Returns tab-separated lines of path, title, and modification time in ms since the epoch. Use read_note to read one in full.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec![],
        },
    }
}

fn save_memory_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "title".into(),
        prop("string", "Short, stable name for the memory. Saving again with the same title updates that memory instead of creating another."),
    );
    properties.insert(
        "body".into(),
        prop("string", "The fact to remember, as markdown."),
    );
    properties.insert(
        "source_session".into(),
        prop("string", "Optional. Session ID this memory came from; saved as a [[◈ ID]] link. Supply the ID, not wiki markup."),
    );

    ToolDefinition {
        name: "save_memory".into(),
        mutating: true,
        description: "Remember a durable fact for future sessions by writing a note with `memory: true` frontmatter into the vault's memory folder. A memory with the same title is updated in place. Returns the saved path.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["title".into(), "body".into()],
        },
    }
}

pub(crate) fn memory_query(limit: usize) -> BaseQuery {
    BaseQuery {
        filters: vec![BaseFilter {
            property: MEMORY_PROPERTY.into(),
            operator: "eq".into(),
            value: "true".into(),
        }],
        sort: vec![BaseSort {
            property: "mtime_ms".into(),
            descending: true,
        }],
        limit,
        offset: 0,
    }
}

pub(crate) fn memory_folder_from_setting(editor_settings: Option<&Value>) -> String {
    editor_settings
        .and_then(|settings| settings.get("memory_folder"))
        .and_then(Value::as_str)
        .map(|folder| folder.trim().trim_matches('/').to_string())
        .filter(|folder| !folder.is_empty())
        .unwrap_or_else(|| DEFAULT_MEMORY_FOLDER.to_string())
}

fn memory_folder(app: &AppHandle, vault_id: &str) -> String {
    let setting = get_vault_setting_value(app, vault_id, "editor")
        .ok()
        .flatten();
    memory_folder_from_setting(setting.as_ref())
}

pub(crate) fn memory_slug(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut prev_dash = false;
    for ch in title.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

pub(crate) fn memory_note_path(folder: &str, title: &str) -> String {
    let slug = memory_slug(title);
    let name = if slug.is_empty() { "memory" } else { slug.as_str() };
    format!("{}/{}.md", folder.trim_matches('/'), name)
}

fn yaml_quote(value: &str) -> String {
    serde_json::to_string(value).expect("strings serialize to JSON")
}

pub(crate) fn render_memory_note(title: &str, body: &str, source_session: Option<&str>) -> Result<String, String> {
    let source_session = source_session.map(str::trim).filter(|s| !s.is_empty());
    if source_session.is_some_and(|session| session.starts_with('◈') || session.chars().any(|c| c.is_control() || matches!(c, '[' | ']' | '|'))) {
        return Err("source_session must be a session ID without wiki markup or control characters".into());
    }
    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&format!("{MEMORY_PROPERTY}: true\n"));
    out.push_str(&format!("title: {}\n", yaml_quote(title)));
    if let Some(session) = source_session {
        out.push_str(&format!("source_session: {}\n", yaml_quote(&format!("[[◈ {session}]]"))));
    }
    out.push_str("---\n\n");
    out.push_str(body.trim_end());
    out.push('\n');
    Ok(out)
}

pub(crate) fn memory_title(row: &BaseNoteRow) -> String {
    row.properties
        .get("title")
        .map(|property| property.value.clone())
        .filter(|title| !title.trim().is_empty())
        .unwrap_or_else(|| row.note.title.clone())
}

pub(crate) fn find_memory_by_title<'a>(rows: &'a [BaseNoteRow], title: &str) -> Option<&'a BaseNoteRow> {
    let wanted = title.trim().to_lowercase();
    rows.iter()
        .find(|row| memory_title(row).trim().to_lowercase() == wanted)
}

pub(crate) fn format_memory_lines(rows: &[BaseNoteRow]) -> String {
    rows.iter()
        .map(|row| format!("{}\t{}\t{}", row.note.path, memory_title(row), row.note.mtime_ms))
        .collect::<Vec<_>>()
        .join("\n")
}

fn query_memories(app: &AppHandle, vault_id: &str, limit: usize) -> Result<BaseQueryResults, String> {
    search_service::with_read_conn(app, vault_id, |conn| {
        search_db::query_bases(conn, memory_query(limit))
    })
}

fn handle_list_memories(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: ListMemoriesArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };
    let limit = args.limit.unwrap_or(MEMORY_LIST_DEFAULT).min(MEMORY_LIST_MAX);

    match query_memories(app, &vault_id, limit) {
        Ok(results) if results.rows.is_empty() => ToolResult::text("No memories saved yet.".into()),
        Ok(results) => ToolResult::text(format!(
            "{} memories (of {} total)\n{}",
            results.rows.len(),
            results.total,
            format_memory_lines(&results.rows)
        )),
        Err(e) => ToolResult::error(e),
    }
}

pub(crate) fn verify_memory_target(path: &str, content: &str, title: &str) -> Result<(), OpError> {
    let conflict = || OpError::Conflict(format!("{} is not a verified memory with the same title", path));
    let mut lines = content.lines();
    if lines.next() != Some("---") {
        return Err(conflict());
    }
    let mut memory = false;
    let mut found_title = None;
    let mut closed = false;
    for line in lines {
        if line == "---" {
            closed = true;
            break;
        }
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        // Index extraction is intentionally permissive; it is not proof of file identity.
        if line.starts_with(char::is_whitespace) {
            return Err(conflict());
        }
        let (key, value) = line.split_once(':').ok_or_else(conflict)?;
        let key = key.trim();
        if key.is_empty() || !key.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') {
            return Err(conflict());
        }
        let value = value.trim();
        let decoded = if value.starts_with('"') {
            serde_json::from_str::<String>(value).map_err(|_| conflict())?
        } else if !value.is_empty() && value.chars().all(|ch| ch.is_alphanumeric() || " -_./".contains(ch)) {
            value.to_string()
        } else {
            return Err(conflict());
        };
        match key {
            "memory" => {
                if memory || value != "true" {
                    return Err(conflict());
                }
                memory = true;
            }
            "title" => {
                if found_title.is_some() {
                    return Err(conflict());
                }
                found_title = Some(decoded);
            }
            _ => {}
        }
    }
    let actual_title = found_title.or_else(|| {
        Path::new(path).file_stem().and_then(|stem| stem.to_str()).map(str::to_string)
    });
    if closed && memory && actual_title.is_some_and(|actual| actual.trim().to_lowercase() == title.trim().to_lowercase()) {
        Ok(())
    } else {
        Err(conflict())
    }
}

fn handle_save_memory(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: SaveMemoryArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };
    let title = args.title.trim();
    if title.is_empty() {
        return ToolResult::error("title must not be empty".into());
    }

    let content = match render_memory_note(title, &args.body, args.source_session.as_deref()) {
        Ok(content) => content,
        Err(error) => return ToolResult::error(error),
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };

    let results = match query_memories(app, &vault_id, MEMORY_LOOKUP_LIMIT) {
        Ok(results) => results,
        Err(error) => return ToolResult::error(error),
    };
    let existing = find_memory_by_title(&results.rows, title).map(|row| row.note.path.clone());
    let path = existing.clone().unwrap_or_else(|| memory_note_path(&memory_folder(app, &vault_id), title));

    let written = match shared_ops::read_note(app, &vault_id, &path) {
        Ok((_, current)) => verify_memory_target(&path, &current, title)
            .and_then(|()| shared_ops::write_note(app, &vault_id, &path, &content))
            .map(|path| (path, true)),
        Err(OpError::NotFound(_)) if existing.is_none() => shared_ops::create_note(
            app,
            &shared_ops::CreateNoteArgs {
                vault_id: vault_id.clone(),
                path,
                content,
                overwrite: false,
            },
        )
        .map(|result| match result {
            CreateResult::Created(meta) => (meta.path, false),
            CreateResult::Overwritten(path) => (path, true),
        }),
        Err(error) => Err(error),
    };

    match written {
        Ok((path, updated)) => {
            let _ = search_service::index_upsert_note_inner(app.clone(), vault_id, path.clone());
            let verb = if updated { "Updated memory" } else { "Saved memory" };
            ToolResult::text(format!("{}: {}", verb, path))
        }
        Err(e) => op_err_to_tool_result(e),
    }
}
