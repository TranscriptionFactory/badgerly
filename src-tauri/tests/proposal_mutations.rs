use crate::features::notes::proposal_mutations::{prepare_rename, apply_mutations, apply_mutations_with, anchor_mutations, ProposalMutation};
use crate::features::notes::edit_operation::{replacement_operations, note_revision};

#[test]
fn native_operations_use_utf16_offsets_and_content_revision() {
    let ops = replacement_operations("a.md", "😀 alpha alpha", "alpha", "beta", true).unwrap();
    assert_eq!((ops[0].start, ops[0].end, ops[1].start), (3, 8, 9));
    assert_eq!(ops[0].base_revision, note_revision("😀 alpha alpha"));
    assert!(replacement_operations("a.md", "alpha alpha", "alpha", "beta", false).is_err());
    assert!(replacement_operations("a.md", "alpha", "", "beta", false).is_err());
}

#[test]
fn rename_prepares_source_destination_and_backlinks_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), "body").unwrap();
    std::fs::write(dir.path().join("links.md"), "[[old]] [[◈ session-id]]").unwrap();
    let mutations = prepare_rename(dir.path(), "old.md", "new.md").unwrap();
    assert_eq!(mutations.len(), 3);
    assert!(dir.path().join("old.md").exists());
    assert!(!dir.path().join("new.md").exists());
    apply_mutations(dir.path(), &mutations).unwrap();
    assert!(!dir.path().join("old.md").exists());
    assert_eq!(std::fs::read_to_string(dir.path().join("new.md")).unwrap(), "body");
    assert_eq!(std::fs::read_to_string(dir.path().join("links.md")).unwrap(), "[[new]] [[◈ session-id]]");
    let manifest = walkdir::WalkDir::new(dir.path().join(".carbide/archive")).into_iter().filter_map(Result::ok).find(|entry| entry.file_name() == "manifest.json").unwrap();
    assert!(std::fs::read_to_string(manifest.path()).unwrap().contains("old.md"));
}

#[test]
fn rename_rejects_stale_backlinks_collisions_and_unsafe_paths() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), "body").unwrap();
    std::fs::write(dir.path().join("links.md"), "[[old]]").unwrap();
    let mutations = prepare_rename(dir.path(), "old.md", "new.md").unwrap();
    std::fs::write(dir.path().join("links.md"), "user edit").unwrap();
    assert!(apply_mutations(dir.path(), &mutations).is_err());
    assert!(dir.path().join("old.md").exists());
    assert!(!dir.path().join("new.md").exists());
    assert!(prepare_rename(dir.path(), "old.md", "links.md").is_err());
    assert!(prepare_rename(dir.path(), "old.md", "../escape.md").is_err());
}

#[test]
fn failed_multi_file_apply_restores_every_already_touched_path() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("a.md"), "a").unwrap();
    std::fs::write(dir.path().join("b.md"), "b").unwrap();
    let mutations = vec![ProposalMutation { path: "a.md".into(), before: Some("a".into()), after: Some("A".into()) }, ProposalMutation { path: "b.md".into(), before: Some("b".into()), after: Some("B".into()) }];
    let result = apply_mutations_with(dir.path(), &mutations, |path, content| {
        if path.ends_with("b.md") { Err("injected write failure".into()) } else { std::fs::write(path, content).map_err(|error| error.to_string()) }
    });
    assert!(result.is_err());
    assert_eq!(std::fs::read_to_string(dir.path().join("a.md")).unwrap(), "a");
    assert_eq!(std::fs::read_to_string(dir.path().join("b.md")).unwrap(), "b");
}

#[test]
fn anchor_restore_archives_absent_destination_and_preserves_other_notes() {
    let dir = tempfile::tempdir().unwrap();
    let repo = git2::Repository::init(dir.path()).unwrap();
    std::fs::write(dir.path().join("old.md"), "body").unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(std::path::Path::new("old.md")).unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let sig = git2::Signature::now("test", "test@example.com").unwrap();
    let anchor = repo.commit(Some("HEAD"), &sig, &sig, "base", &tree, &[]).unwrap().to_string();
    apply_mutations(dir.path(), &prepare_rename(dir.path(), "old.md", "new.md").unwrap()).unwrap();
    std::fs::write(dir.path().join("unrelated.md"), "keep").unwrap();
    let restore = anchor_mutations(dir.path(), &["old.md".into(), "new.md".into()], &anchor).unwrap();
    apply_mutations(dir.path(), &restore).unwrap();
    assert_eq!(std::fs::read_to_string(dir.path().join("old.md")).unwrap(), "body");
    assert!(!dir.path().join("new.md").exists());
    assert_eq!(std::fs::read_to_string(dir.path().join("unrelated.md")).unwrap(), "keep");
}

#[cfg(unix)]
#[test]
fn rename_refuses_symlink_targets_and_parent_traversal() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), "body").unwrap();
    std::os::unix::fs::symlink(outside.path(), dir.path().join("linked")).unwrap();
    assert!(prepare_rename(dir.path(), "old.md", "linked/new.md").is_err());
    std::os::unix::fs::symlink(dir.path().join("old.md"), dir.path().join("alias.md")).unwrap();
    assert!(prepare_rename(dir.path(), "old.md", "alias.md").is_err());
}

#[test]
fn all_four_native_operation_variants_prepare_proposals_without_writes() {
    use crate::features::notes::edit_operation::{prepare_native_proposal, StructuredEditOperation};
    use serde_json::json;
    for input in [json!({"kind":"replace_span", "start":0,"end":4,"text":"new"}), json!({"kind":"insert_at_heading","heading":"Intro","text":"new"}), json!({"kind":"set_frontmatter","key":"memory","value":true}), json!({"kind":"rename_with_repair","to_path":"renamed.md"})] {
        let operation: StructuredEditOperation = serde_json::from_value(input).unwrap();
        let proposal = prepare_native_proposal("vault-1".into(), "a.md".into(), "body".into(), vec![operation]).unwrap();
        assert_eq!(proposal.operations[0].base_revision, note_revision("body"));
        assert_eq!(proposal.base_content, "body");
        assert!(!proposal.operations[0].hunk_id.is_empty());
    }
    assert!(serde_json::from_value::<StructuredEditOperation>(json!({"kind":"unknown"})).is_err());
    let invalid = serde_json::from_value(json!({"kind":"replace_span", "start":0,"end":100,"text":"new"})).unwrap();
    assert!(prepare_native_proposal("vault-1".into(), "a.md".into(), "body".into(), vec![invalid]).is_err());
    let stale = serde_json::from_value(json!({"kind":"rename_with_repair", "to_path":"new.md", "base_revision":"wrong"})).unwrap();
    assert!(prepare_native_proposal("vault-1".into(), "a.md".into(), "body".into(), vec![stale]).is_err());
}

#[test]
fn edit_note_schema_advertises_the_four_machine_readable_variants() {
    let tool = crate::features::mcp::tools::notes::tool_definitions().into_iter().find(|tool| tool.name == "edit_note").unwrap();
    let schema = serde_json::to_value(tool.input_schema).unwrap();
    let variants = schema["properties"]["operation"]["anyOf"].as_array().unwrap();
    assert_eq!(variants.len(), 4);
    for variant in variants {
        assert_eq!(variant["type"], "object");
        assert_eq!(variant["additionalProperties"], false);
        assert!(variant["required"].as_array().unwrap().iter().any(|field| field == "kind"));
    }
}

#[test]
fn native_tool_payload_matches_the_frontend_pipeline_fixture() {
    use crate::features::notes::edit_operation::{prepare_native_proposal, NativeProposal};
    let fixtures: Vec<NativeProposal> = serde_json::from_str(include_str!("../../tests/fixtures/2026-09-05_native_edit_proposals.json")).unwrap();
    for expected in fixtures {
        let mut operations = expected.operations.clone();
        for operation in &mut operations { operation.base_revision.clear(); operation.hunk_id.clear(); }
        let actual = prepare_native_proposal(expected.vault_id.clone(), expected.path.clone(), expected.base_content.clone(), operations).unwrap();
        assert_eq!(actual, expected);
    }
}

#[test]
fn typed_native_spans_reject_surrogate_splits_and_retain_resolved_vault() {
    use crate::features::notes::edit_operation::prepare_native_proposal;
    let invalid = serde_json::from_value(serde_json::json!({"kind":"replace_span", "start":1,"end":2,"text":"new"})).unwrap();
    assert!(prepare_native_proposal("vault-B".into(), "a.md".into(), "😀x".into(), vec![invalid]).is_err());
    let valid = serde_json::from_value(serde_json::json!({"kind":"replace_span", "start":0,"end":2,"text":"new"})).unwrap();
    let proposal = prepare_native_proposal("vault-B".into(), "a.md".into(), "😀x".into(), vec![valid]).unwrap();
    assert_eq!(proposal.vault_id, "vault-B");
}
