use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::features::git::service as git_service;
use crate::features::mcp::shared_ops::{self, VAULT_ID_OPTIONAL_DESC};
use crate::features::mcp::tools::{op_err_to_tool_result, parse_args, prop};
use crate::features::mcp::types::{InputSchema, PropertySchema, ToolDefinition, ToolResult};
use crate::shared::storage;

const NOTE_HISTORY_DEFAULT_LIMIT: usize = 20;
const NOTE_HISTORY_MAX_LIMIT: usize = 100;
const AGENT_CHECKPOINT_PREFIX: &str = "agent:";

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        git_status_def(),
        git_log_def(),
        rename_note_def(),
        get_note_history_def(),
        read_note_version_def(),
        create_checkpoint_def(),
    ]
}

pub fn dispatch(app: &AppHandle, name: &str, arguments: Option<&Value>) -> Option<ToolResult> {
    match name {
        "git_status" => Some(handle_git_status(app, arguments)),
        "git_log" => Some(handle_git_log(app, arguments)),
        "rename_note" => Some(handle_rename_note(app, arguments)),
        "get_note_history" => Some(handle_get_note_history(app, arguments)),
        "read_note_version" => Some(handle_read_note_version(app, arguments)),
        "create_checkpoint" => Some(handle_create_checkpoint(app, arguments)),
        _ => None,
    }
}

fn get_note_history_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "path".into(),
        prop("string", "Vault-relative path of the note (e.g. 'folder/note.md')"),
    );
    properties.insert(
        "limit".into(),
        PropertySchema {
            prop_type: "integer".into(),
            description: Some("Optional. Maximum number of commits to return (default: 20, max: 100)".into()),
            enum_values: None,
            default: Some(Value::Number((NOTE_HISTORY_DEFAULT_LIMIT as u64).into())),
        },
    );

    ToolDefinition {
        name: "get_note_history".into(),
        mutating: false,
        description: "Get the git commit history of a single note, newest first, following renames. Returns one line per commit: short_hash, UTC date, and subject. Use a short_hash as `ref` for read_note_version. Only works if the vault is a git repository.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["path".into()],
        },
    }
}

fn read_note_version_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "path".into(),
        prop("string", "Current vault-relative path of the note (e.g. 'folder/note.md')"),
    );
    properties.insert(
        "ref".into(),
        prop(
            "string",
            "Commit to read from: a hash from get_note_history, a tag, or a revision like 'HEAD~2'",
        ),
    );

    ToolDefinition {
        name: "read_note_version".into(),
        mutating: false,
        description: "Read the content of a note as it was at a given commit. Follows renames, so the current path works for commits from before the note was renamed. Only works if the vault is a git repository.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["path".into(), "ref".into()],
        },
    }
}

fn create_checkpoint_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "description".into(),
        prop(
            "string",
            "Short reason for the checkpoint (e.g. 'before restructuring project notes')",
        ),
    );

    ToolDefinition {
        name: "create_checkpoint".into(),
        mutating: true,
        description: "Commit every pending change in the vault as a checkpoint before a risky edit, so the user can restore it from the git panel. Returns the commit hash, or reports that there was nothing to checkpoint. Only works if the vault is a git repository.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["description".into()],
        },
    }
}

fn git_status_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));

    ToolDefinition {
        name: "git_status".into(),
        mutating: false,
        description:
            "Get the git working tree status for a vault. Returns branch name, clean/dirty state, ahead/behind counts, and per-file status codes with paths. Only works if the vault is a git repository."
                .into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into()],
        },
    }
}

fn git_log_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", "Vault identifier (use list_vaults to discover IDs)"));
    properties.insert(
        "limit".into(),
        PropertySchema {
            prop_type: "integer".into(),
            description: Some("Optional. Maximum number of commits to return (default: 20, max: 100)".into()),
            enum_values: None,
            default: Some(Value::Number(20.into())),
        },
    );

    ToolDefinition {
        name: "git_log".into(),
        mutating: false,
        description: "Get recent git commit history for a vault. Returns one line per commit: short_hash, author, and message. Only works if the vault is a git repository.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["vault_id".into()],
        },
    }
}

fn rename_note_def() -> ToolDefinition {
    let mut properties = HashMap::new();
    properties.insert("vault_id".into(), prop("string", VAULT_ID_OPTIONAL_DESC));
    properties.insert(
        "old_path".into(),
        prop(
            "string",
            "Current vault-relative path of the note (e.g. 'folder/note.md')",
        ),
    );
    properties.insert(
        "new_path".into(),
        prop(
            "string",
            "New vault-relative path for the note (e.g. 'other/renamed.md'). Must end in .md.",
        ),
    );

    ToolDefinition {
        name: "rename_note".into(),
        mutating: true,
        description: "Rename or move a note within the vault. **Automatically updates all wikilinks** (`[[...]]`) in other notes that reference the old path. Returns the old and new paths plus a count of updated backlinks.".into(),
        input_schema: InputSchema {
            schema_type: "object".into(),
            properties,
            required: vec!["old_path".into(), "new_path".into()],
        },
    }
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct VaultArgs {
    pub vault_id: String,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct GitLogArgs {
    pub vault_id: String,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct RenameNoteArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub old_path: String,
    pub new_path: String,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct NoteHistoryArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub path: String,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct NoteVersionArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub path: String,
    #[serde(rename = "ref")]
    pub commit_ref: String,
}

#[derive(Default, Serialize, Deserialize)]
pub(crate) struct CheckpointArgs {
    #[serde(default)]
    pub vault_id: Option<String>,
    pub description: String,
}

fn vault_path_string(app: &AppHandle, vault_id: &str) -> Result<String, ToolResult> {
    storage::vault_path(app, vault_id)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(ToolResult::error)
}

fn optional_vault_path(app: &AppHandle, vault_id: Option<String>) -> Result<String, ToolResult> {
    let vault_id = shared_ops::resolve_vault_id(app, vault_id).map_err(op_err_to_tool_result)?;
    vault_path_string(app, &vault_id)
}

pub(crate) fn format_utc_date(timestamp_ms: i64) -> String {
    let seconds = timestamp_ms.div_euclid(1000);
    let days = seconds.div_euclid(86_400);
    let secs_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}",
        year,
        month,
        day,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60
    )
}

// Proleptic Gregorian date from days since 1970-01-01 (Howard Hinnant's
// civil_from_days), so the tool needs no calendar dependency.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

pub(crate) fn history_line(commit: &git_service::GitCommit) -> String {
    let subject = commit.message.lines().next().unwrap_or("").trim();
    format!(
        "{} {} {}",
        commit.short_hash,
        format_utc_date(commit.timestamp_ms),
        subject
    )
}

pub(crate) fn agent_checkpoint_description(description: &str) -> String {
    format!("{} {}", AGENT_CHECKPOINT_PREFIX, description.trim())
}

pub(crate) fn checkpoint_outcome_text(outcome: git_service::CheckpointOutcome) -> String {
    match outcome {
        git_service::CheckpointOutcome::NothingToCheckpoint => {
            "Nothing to checkpoint: the working tree is clean.".into()
        }
        git_service::CheckpointOutcome::Created { sha, tag_warning: None } => {
            format!("Checkpoint created: {}", sha)
        }
        git_service::CheckpointOutcome::Created {
            sha,
            tag_warning: Some(warning),
        } => format!("Checkpoint created: {} (tag not created: {})", sha, warning),
    }
}

fn handle_get_note_history(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: NoteHistoryArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };
    let vault_path = match optional_vault_path(app, args.vault_id) {
        Ok(p) => p,
        Err(e) => return e,
    };
    let limit = args
        .limit
        .unwrap_or(NOTE_HISTORY_DEFAULT_LIMIT)
        .clamp(1, NOTE_HISTORY_MAX_LIMIT);

    match git_service::collect_file_history(&vault_path, &args.path, limit) {
        Ok(commits) if commits.is_empty() => {
            ToolResult::text(format!("No commits found for {}.", args.path))
        }
        Ok(commits) => {
            let lines: Vec<String> = commits.iter().map(history_line).collect();
            ToolResult::text(lines.join("\n"))
        }
        Err(e) => ToolResult::error(e),
    }
}

fn handle_read_note_version(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: NoteVersionArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };
    let vault_path = match optional_vault_path(app, args.vault_id) {
        Ok(p) => p,
        Err(e) => return e,
    };

    match git_service::git_show_file_following_renames(&vault_path, &args.path, &args.commit_ref)
    {
        Ok(content) => ToolResult::text(content),
        Err(e) => ToolResult::error(e),
    }
}

fn handle_create_checkpoint(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: CheckpointArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };
    let vault_path = match optional_vault_path(app, args.vault_id) {
        Ok(p) => p,
        Err(e) => return e,
    };

    let description = agent_checkpoint_description(&args.description);
    match git_service::git_create_checkpoint_inner(vault_path, &description) {
        Ok(outcome) => ToolResult::text(checkpoint_outcome_text(outcome)),
        Err(e) => ToolResult::error(e),
    }
}

fn handle_git_status(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: VaultArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_path = match vault_path_string(app, &args.vault_id) {
        Ok(p) => p,
        Err(e) => return e,
    };

    match git_service::git_status_inner(vault_path) {
        Ok(status) => {
            let mut lines = vec![format!("Branch: {}", status.branch)];
            if status.is_dirty {
                lines.push(format!("{} changed file(s)", status.files.len()));
            } else {
                lines.push("Clean working tree".into());
            }
            if status.has_upstream {
                if status.ahead > 0 {
                    lines.push(format!("Ahead: {}", status.ahead));
                }
                if status.behind > 0 {
                    lines.push(format!("Behind: {}", status.behind));
                }
            }
            for f in &status.files {
                lines.push(format!("  {} {}", f.status, f.path));
            }
            ToolResult::text(lines.join("\n"))
        }
        Err(e) => ToolResult::error(e),
    }
}

fn handle_git_log(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: GitLogArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_path = match vault_path_string(app, &args.vault_id) {
        Ok(p) => p,
        Err(e) => return e,
    };

    let limit = args.limit.unwrap_or(20).min(100);

    match git_service::collect_git_log(&vault_path, None, limit) {
        Ok(commits) => {
            if commits.is_empty() {
                return ToolResult::text("No commits found.".into());
            }
            let lines: Vec<String> = commits
                .iter()
                .map(|c| format!("{} {} {}", c.short_hash, c.author, c.message.trim()))
                .collect();
            ToolResult::text(lines.join("\n"))
        }
        Err(e) => ToolResult::error(e),
    }
}

fn handle_rename_note(app: &AppHandle, arguments: Option<&Value>) -> ToolResult {
    let args: RenameNoteArgs = match parse_args(arguments) {
        Ok(a) => a,
        Err(e) => return e,
    };

    let vault_id = match shared_ops::resolve_vault_id(app, args.vault_id) {
        Ok(v) => v,
        Err(e) => return op_err_to_tool_result(e),
    };

    match shared_ops::rename_note_and_update_links(
        app,
        &vault_id,
        &args.old_path,
        &args.new_path,
    ) {
        Ok((renamed, updated_count)) => {
            if updated_count > 0 {
                ToolResult::text(format!(
                    "Renamed: {}. Updated wikilinks in {} note(s).",
                    renamed, updated_count
                ))
            } else {
                ToolResult::text(format!("Renamed: {}", renamed))
            }
        }
        Err(e) => op_err_to_tool_result(e),
    }
}
