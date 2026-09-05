use std::collections::BTreeMap;

use serde_json::json;

use crate::features::ai::agent_stream::{infer_tool_kind, ToolKind};
use crate::features::mcp::shared_ops::VAULT_ID_OPTIONAL_DESC;
use crate::features::mcp::tools::notes::{
    self, find_memory_by_title, format_memory_lines, memory_folder_from_setting,
    memory_note_path, memory_query, memory_slug, render_memory_note, verify_memory_target, DEFAULT_MEMORY_FOLDER,
};
use crate::features::search::model::{BaseNoteRow, IndexNoteMeta, NoteStats, PropertyValue};

fn row(path: &str, index_title: &str, frontmatter_title: Option<&str>, mtime_ms: i64) -> BaseNoteRow {
    let mut properties = BTreeMap::new();
    properties.insert(
        "memory".to_string(),
        PropertyValue {
            value: "true".into(),
            property_type: "boolean".into(),
        },
    );
    if let Some(title) = frontmatter_title {
        properties.insert(
            "title".to_string(),
            PropertyValue {
                value: title.into(),
                property_type: "string".into(),
            },
        );
    }
    BaseNoteRow {
        note: IndexNoteMeta {
            id: path.into(),
            path: path.into(),
            title: index_title.into(),
            name: index_title.to_lowercase(),
            mtime_ms,
            ctime_ms: 0,
            size_bytes: 0,
            blurb: String::new(),
            file_type: Some("md".into()),
            source: None,
        },
        properties,
        tags: vec![],
        stats: NoteStats::default(),
        content_snippet: None,
        first_image_path: None,
    }
}

#[test]
fn render_memory_note_writes_memory_true_title_and_body() {
    let note = render_memory_note("Deploy region", "We deploy to eu-west.", None);
    assert_eq!(
        note,
        "---\nmemory: true\ntitle: \"Deploy region\"\n---\n\nWe deploy to eu-west.\n"
    );
}

#[test]
fn render_memory_note_includes_source_session_only_when_given() {
    let with = render_memory_note("T", "b", Some("sess-1"));
    assert!(with.contains("source_session: \"sess-1\"\n"));

    let blank = render_memory_note("T", "b", Some("  "));
    assert!(!blank.contains("source_session"));

    let quoted = render_memory_note("Say \"hi\"", "b", None);
    assert!(quoted.contains("title: \"Say \\\"hi\\\"\"\n"));
}

#[test]
fn memory_slug_lowercases_and_collapses_separators() {
    assert_eq!(memory_slug("Deploy Region: EU/West!"), "deploy-region-eu-west");
    assert_eq!(memory_slug("  --  "), "");
}

#[test]
fn memory_note_path_joins_folder_setting_and_slug() {
    assert_eq!(memory_note_path("Memory", "Deploy region"), "Memory/deploy-region.md");
    assert_eq!(memory_note_path("/notes/mem/", "A B"), "notes/mem/a-b.md");
    assert_eq!(memory_note_path("Memory", "???"), "Memory/memory.md");
}

#[test]
fn memory_folder_falls_back_to_default_when_setting_missing_or_blank() {
    assert_eq!(memory_folder_from_setting(None), DEFAULT_MEMORY_FOLDER);
    assert_eq!(memory_folder_from_setting(Some(&json!({}))), DEFAULT_MEMORY_FOLDER);
    assert_eq!(
        memory_folder_from_setting(Some(&json!({ "memory_folder": "   " }))),
        DEFAULT_MEMORY_FOLDER
    );
    assert_eq!(
        memory_folder_from_setting(Some(&json!({ "memory_folder": "/Brain/Memories/" }))),
        "Brain/Memories"
    );
}

#[test]
fn memory_query_filters_on_memory_true_and_sorts_newest_first() {
    let query = memory_query(7);
    assert_eq!(query.filters.len(), 1);
    assert_eq!(query.filters[0].property, "memory");
    assert_eq!(query.filters[0].operator, "eq");
    assert_eq!(query.filters[0].value, "true");
    assert_eq!(query.sort[0].property, "mtime_ms");
    assert!(query.sort[0].descending);
    assert_eq!(query.limit, 7);
    assert_eq!(query.offset, 0);
}

#[test]
fn find_memory_by_title_matches_frontmatter_title_case_insensitively() {
    let rows = vec![
        row("Memory/deploy-region.md", "deploy-region", Some("Deploy region"), 2),
        row("Memory/other.md", "other", Some("Other"), 1),
    ];
    let found = find_memory_by_title(&rows, "  DEPLOY REGION ").expect("match");
    assert_eq!(found.note.path, "Memory/deploy-region.md");
    assert!(find_memory_by_title(&rows, "missing").is_none());
}

#[test]
fn find_memory_by_title_falls_back_to_index_title() {
    let rows = vec![row("elsewhere/Deploy region.md", "Deploy region", None, 1)];
    let found = find_memory_by_title(&rows, "deploy region").expect("match");
    assert_eq!(found.note.path, "elsewhere/Deploy region.md");
}

#[test]
fn format_memory_lines_reports_path_title_and_mtime() {
    let rows = vec![
        row("Memory/b.md", "b", Some("Newest"), 20),
        row("notes/a.md", "Older", None, 10),
    ];
    assert_eq!(
        format_memory_lines(&rows),
        "Memory/b.md\tNewest\t20\nnotes/a.md\tOlder\t10"
    );
}

#[test]
fn save_memory_is_mutating_and_list_memories_is_not() {
    let defs = notes::tool_definitions();
    let save = defs.iter().find(|d| d.name == "save_memory").expect("save_memory");
    let list = defs.iter().find(|d| d.name == "list_memories").expect("list_memories");
    assert!(save.mutating);
    assert!(!list.mutating);
    assert_eq!(save.input_schema.required, vec!["title", "body"]);
    assert!(save.input_schema.properties.contains_key("source_session"));
}

#[test]
fn memory_tools_resolve_vault_id_from_active_vault() {
    let defs = notes::tool_definitions();
    for name in ["save_memory", "list_memories"] {
        let def = defs.iter().find(|d| d.name == name).expect(name);
        assert_eq!(
            def.input_schema.properties["vault_id"].description.as_deref(),
            Some(VAULT_ID_OPTIONAL_DESC)
        );
        assert!(!def.input_schema.required.contains(&"vault_id".to_string()));
    }
}

#[test]
fn save_memory_is_registered_as_edit_and_list_memories_as_read() {
    assert_eq!(infer_tool_kind("save_memory"), ToolKind::Edit);
    assert_eq!(infer_tool_kind("mcp__carbide__save_memory"), ToolKind::Edit);
    assert_eq!(infer_tool_kind("list_memories"), ToolKind::Read);
}

#[test]
fn memory_targets_reject_slug_collisions_and_ordinary_notes() {
    for (original, requested) in [("A B", "A-B"), ("???", "!!!"), ("東京", "京都"), ("Foo", "'Foo'")] {
        let path = memory_note_path("Memory", original);
        assert_eq!(path, memory_note_path("Memory", requested));
        let content = render_memory_note(original, "preserve this", None);
        assert!(verify_memory_target(&path, &content, requested).is_err());
    }
    assert!(verify_memory_target("Memory/a-b.md", "# A B\nordinary note", "A B").is_err());
    assert!(verify_memory_target("Memory/a-b.md", "---\ntitle: A B\nmemory: false\n---\n", "A B").is_err());
}

#[test]
fn current_disk_identity_overrules_a_stale_index_match() {
    let rows = vec![row("Memory/a-b.md", "a-b", Some("A B"), 1)];
    let indexed = find_memory_by_title(&rows, "A B").unwrap();
    for current in ["ordinary note".to_string(), render_memory_note("A-B", "replaced", None)] {
        assert!(verify_memory_target(&indexed.note.path, &current, "A B").is_err());
    }
}

#[test]
fn same_title_memory_is_verified_at_any_path_without_trusting_the_slug() {
    for title in ["Deploy Region", "Say \"hi\"", "Path \\server"] {
        let content = render_memory_note(title, "original", None);
        assert!(verify_memory_target("Elsewhere/renamed.md", &content, &title.to_uppercase()).is_ok());
    }
    assert!(verify_memory_target("Memory/Deploy.md", "---\nmemory: true\n---\n", "deploy").is_ok());
}

#[test]
fn malformed_or_ambiguous_frontmatter_is_not_proof_of_memory_identity() {
    for content in [
        "---\nmemory: true\ntitle: Deploy",
        "---\nmemory: true\nmemory: false\ntitle: Deploy\n---\n",
        "---\nmemory: true\ntitle: Deploy\ntitle: Other\n---\n",
        "---\nmemory: true\nmemory:\ntitle: Deploy\n---\n",
        "---\nmetadata:\n  memory: true\n  title: Deploy\n---\n",
        "---\nmemory: true\n\"memory\": false\ntitle: Deploy\n---\n",
        "---\nmemory: true\nsource_session: \"\ntitle: Deploy\nother: \"\n---\n",
    ] {
        assert!(verify_memory_target("Memory/deploy.md", content, "Deploy").is_err());
    }
}

#[test]
fn title_serialization_cannot_inject_frontmatter_fields() {
    let title = "Deploy\nmemory: false";
    let content = render_memory_note(title, "body", Some("session\ntitle: Other"));
    assert!(verify_memory_target("Memory/deploy.md", &content, title).is_ok());
    assert!(verify_memory_target("Memory/deploy.md", &content, "Deploy").is_err());
    assert_eq!(content.lines().filter(|line| line.starts_with("memory:")).count(), 1);
}
