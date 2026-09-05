use crate::features::git::service::{CheckpointOutcome, GitCommit};
use crate::features::mcp::shared_ops::VAULT_ID_OPTIONAL_DESC;
use crate::features::mcp::tools::git;
use crate::features::mcp::types::ToolDefinition;

fn def(name: &str) -> ToolDefinition {
    git::tool_definitions()
        .into_iter()
        .find(|d| d.name == name)
        .unwrap_or_else(|| panic!("{name} is defined"))
}

#[test]
fn git_tool_definitions_count() {
    let defs = git::tool_definitions();
    assert_eq!(defs.len(), 6);
}

#[test]
fn get_note_history_requires_path_with_optional_vault_id_and_limit() {
    let def = def("get_note_history");
    assert_eq!(def.input_schema.required, vec!["path".to_string()]);
    assert_eq!(
        def.input_schema.properties["vault_id"].description.as_deref(),
        Some(VAULT_ID_OPTIONAL_DESC)
    );
    assert_eq!(def.input_schema.properties["limit"].prop_type, "integer");
}

#[test]
fn read_note_version_requires_path_and_ref_with_optional_vault_id() {
    let def = def("read_note_version");
    assert_eq!(
        def.input_schema.required,
        vec!["path".to_string(), "ref".to_string()]
    );
    assert_eq!(
        def.input_schema.properties["vault_id"].description.as_deref(),
        Some(VAULT_ID_OPTIONAL_DESC)
    );
}

#[test]
fn create_checkpoint_requires_description_and_is_mutating() {
    let def = def("create_checkpoint");
    assert_eq!(def.input_schema.required, vec!["description".to_string()]);
    assert!(def.mutating, "a checkpoint commits, so it must be gated as mutating");
}

#[test]
fn history_and_version_tools_are_not_mutating() {
    assert!(!def("get_note_history").mutating);
    assert!(!def("read_note_version").mutating);
}

#[test]
fn history_line_shows_short_hash_utc_date_and_subject_only() {
    let commit = GitCommit {
        hash: "0123456789abcdef".into(),
        short_hash: "0123456".into(),
        author: "Carbide".into(),
        timestamp_ms: 1_756_987_200_000,
        message: "Checkpoint: agent: before merge\n\nbody line\n".into(),
    };
    assert_eq!(
        git::history_line(&commit),
        "0123456 2025-09-04 12:00 Checkpoint: agent: before merge"
    );
}

#[test]
fn format_utc_date_handles_epoch_and_leap_day() {
    assert_eq!(git::format_utc_date(0), "1970-01-01 00:00");
    assert_eq!(git::format_utc_date(1_709_164_800_000), "2024-02-29 00:00");
}

#[test]
fn agent_checkpoint_description_is_prefixed_so_the_panel_shows_its_origin() {
    assert_eq!(
        git::agent_checkpoint_description("  before restructure "),
        "agent: before restructure"
    );
}

#[test]
fn checkpoint_outcome_text_covers_created_warning_and_clean_tree() {
    assert_eq!(
        git::checkpoint_outcome_text(CheckpointOutcome::Created {
            sha: "abc".into(),
            tag_warning: None,
        }),
        "Checkpoint created: abc"
    );
    assert_eq!(
        git::checkpoint_outcome_text(CheckpointOutcome::Created {
            sha: "abc".into(),
            tag_warning: Some("boom".into()),
        }),
        "Checkpoint created: abc (tag not created: boom)"
    );
    assert_eq!(
        git::checkpoint_outcome_text(CheckpointOutcome::NothingToCheckpoint),
        "Nothing to checkpoint: the working tree is clean."
    );
}

#[test]
fn git_status_requires_vault_id() {
    let defs = git::tool_definitions();
    let def = defs.iter().find(|d| d.name == "git_status").unwrap();
    assert!(def.input_schema.required.contains(&"vault_id".to_string()));
    assert_eq!(def.input_schema.required.len(), 1);
}

#[test]
fn git_log_requires_vault_id() {
    let defs = git::tool_definitions();
    let def = defs.iter().find(|d| d.name == "git_log").unwrap();
    assert!(def.input_schema.required.contains(&"vault_id".to_string()));
    assert_eq!(def.input_schema.required.len(), 1);
}

#[test]
fn git_log_has_optional_limit() {
    let defs = git::tool_definitions();
    let def = defs.iter().find(|d| d.name == "git_log").unwrap();
    let limit_prop = def.input_schema.properties.get("limit").unwrap();
    assert_eq!(limit_prop.prop_type, "integer");
    assert!(!def.input_schema.required.contains(&"limit".to_string()));
}

#[test]
fn rename_note_requires_old_path_new_path_with_optional_vault_id() {
    let defs = git::tool_definitions();
    let def = defs.iter().find(|d| d.name == "rename_note").unwrap();
    assert!(def.input_schema.properties.contains_key("vault_id"));
    assert!(!def.input_schema.required.contains(&"vault_id".to_string()));
    assert!(def.input_schema.required.contains(&"old_path".to_string()));
    assert!(def.input_schema.required.contains(&"new_path".to_string()));
    assert_eq!(def.input_schema.required.len(), 2);
}

#[test]
fn all_git_tools_are_snake_case() {
    for def in git::tool_definitions() {
        assert!(
            def.name.chars().all(|c| c.is_ascii_lowercase() || c == '_'),
            "{} should be snake_case",
            def.name
        );
    }
}

#[test]
fn all_git_tools_have_descriptions() {
    for def in git::tool_definitions() {
        assert!(
            !def.description.is_empty(),
            "{} should have a description",
            def.name
        );
    }
}

#[test]
fn all_git_schemas_are_object_type() {
    for def in git::tool_definitions() {
        assert_eq!(
            def.input_schema.schema_type, "object",
            "{} schema should be object type",
            def.name
        );
    }
}

#[test]
fn all_git_properties_have_type_and_description() {
    for def in git::tool_definitions() {
        for (name, prop) in &def.input_schema.properties {
            assert!(
                !prop.prop_type.is_empty(),
                "{}.{} should have a type",
                def.name,
                name
            );
            assert!(
                prop.description.is_some(),
                "{}.{} should have a description",
                def.name,
                name
            );
        }
    }
}
