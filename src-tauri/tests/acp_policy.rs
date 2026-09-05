use agent_client_protocol::schema::v1::RequestPermissionRequest;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

use crate::features::ai::acp::session::settle_prompt;
use crate::features::ai::harness::MutatingToolSet;
use crate::features::ai::permissions::{Evaluation, ParkOutcome, PermissionEngine, PermissionRequestSpec, SessionPolicy};
use crate::features::mcp::tools::git::tool_definitions;

use crate::features::ai::permissions::option_kind_name;
use crate::features::ai::acp::policy::build_request_spec;
use crate::features::ai::permissions::select_allow;
use crate::features::ai::agent_stream::{PermissionOptionKind, PermissionOptionSpec, ToolKind};

// The decision matrix itself lives in PermissionEngine (tests/agent_permissions.rs);
// this file covers the pure wire-shape mapping the session handler feeds it.

fn request(kind: &str, title: &str, options: Value) -> RequestPermissionRequest {
    serde_json::from_value(json!({
        "sessionId": "sess-1",
        "toolCall": {
            "toolCallId": "call-1",
            "title": title,
            "kind": kind,
            "rawInput": { "path": "notes/a.md" },
        },
        "options": options,
    }))
    .expect("fixture should deserialize as a RequestPermissionRequest")
}

fn all_options() -> Value {
    json!([
        { "optionId": "allow-once", "name": "Allow once", "kind": "allow_once" },
        { "optionId": "allow-always", "name": "Always allow", "kind": "allow_always" },
        { "optionId": "reject-once", "name": "Reject", "kind": "reject_once" },
    ])
}

fn spec_option(kind: PermissionOptionKind) -> PermissionOptionSpec {
    PermissionOptionSpec {
        option_id: format!("opt-{}", option_kind_name(kind)),
        label: option_kind_name(kind).to_string(),
        kind,
    }
}

#[test]
fn build_request_spec_maps_the_wire_shape() {
    let spec = build_spec("claude", &request("edit", "Edit note", all_options()));

    assert_eq!(spec.agent_id, "claude");
    assert_eq!(spec.tool_call_id.as_deref(), Some("call-1"));
    assert_eq!(spec.name, "Edit note");
    assert_eq!(spec.kind, ToolKind::Edit);
    assert!(spec.mutating);
    assert_eq!(spec.paths, ["notes/a.md"]);
    assert!(spec.input_summary.contains("notes/a.md"));
    assert_eq!(spec.options.len(), 3);
    assert_eq!(spec.options[0].kind, PermissionOptionKind::AllowOnce);
    assert_eq!(spec.options[0].option_id, "allow-once");
}

#[test]
fn a_kindless_tool_call_falls_back_to_name_inference() {
    let request: RequestPermissionRequest = serde_json::from_value(json!({
        "sessionId": "sess-1",
        "toolCall": { "toolCallId": "call-1", "title": "delete_note" },
        "options": [],
    }))
    .expect("fixture should deserialize");

    let spec = build_spec("codex", &request);
    assert_eq!(spec.kind, ToolKind::Delete);
    assert!(spec.mutating);
}

#[test]
fn read_kinds_are_not_mutating() {
    let spec = build_spec("claude", &request("read", "Read note", all_options()));
    assert_eq!(spec.kind, ToolKind::Read);
    assert!(!spec.mutating);
}

/// Carbide's own MCP tools used to arrive pre-authorized, because the scoped
/// token hid the mutating ones outright. They are advertised in full now, so
/// nothing may skip the engine on the strength of its name.
#[test]
fn no_request_arrives_pre_authorized_including_carbide_mcp_tools() {
    let mcp = build_spec(
        "claude",
        &request("delete", "mcp__carbide__delete_note", all_options()),
    );
    let plain = build_spec("claude", &request("delete", "Delete note", all_options()));

    assert!(!mcp.pre_authorized);
    assert!(!plain.pre_authorized);
}

#[test]
fn select_allow_prefers_the_mildest_grant() {
    let options = vec![
        spec_option(PermissionOptionKind::AllowAlways),
        spec_option(PermissionOptionKind::AllowOnce),
        spec_option(PermissionOptionKind::RejectOnce),
    ];
    assert_eq!(
        select_allow(&options).map(|o| o.kind),
        Some(PermissionOptionKind::AllowOnce)
    );
}

#[test]
fn select_allow_never_answers_with_a_refusal() {
    let allow_always_only = vec![spec_option(PermissionOptionKind::AllowAlways)];
    assert_eq!(
        select_allow(&allow_always_only).map(|o| o.kind),
        Some(PermissionOptionKind::AllowAlways)
    );
    assert!(select_allow(&[spec_option(PermissionOptionKind::RejectOnce)]).is_none());
}

#[test]
fn checkpoint_kind_and_mutation_override_absent_or_conflicting_acp_kinds() {
    for kind in [None, Some("read"), Some("edit"), Some("execute")] {
        for name in ["create_checkpoint", "mcp__carbide__create_checkpoint"] {
            let request = serde_json::from_value(json!({
                "sessionId": "sess-1",
                "toolCall": { "toolCallId": "call-1", "title": name, "kind": kind },
                "options": all_options(),
            })).unwrap();
            let spec = build_spec("claude", &request);
            assert_eq!(spec.kind, ToolKind::Execute, "{name}: {kind:?}");
            assert!(spec.mutating, "{name}: {kind:?}");
        }
    }
}

fn build_spec(agent: &str, request: &RequestPermissionRequest) -> PermissionRequestSpec {
    build_request_spec(agent, request, &MutatingToolSet::from_catalog(&tool_definitions()))
}

#[test]
fn checkpoint_approval_issues_one_http_ticket_but_rejection_issues_none() {
    for (name, wire_kind) in ["create_checkpoint", "mcp__carbide__create_checkpoint"].into_iter()
        .flat_map(|name| [None, Some("read"), Some("edit"), Some("execute")].map(|kind| (name, kind))) {
        for choice in [PermissionOptionKind::AllowOnce, PermissionOptionKind::AllowAlways,
                       PermissionOptionKind::RejectOnce, PermissionOptionKind::RejectAlways] {
            let dir = tempfile::tempdir().unwrap();
            let engine = PermissionEngine::new(dir.path());
            let policy = SessionPolicy::default();
            let request = serde_json::from_value(json!({
                "sessionId": "sess-1",
                "toolCall": { "toolCallId": "call-1", "title": name, "kind": wire_kind },
                "options": all_options(),
            })).unwrap();
            let spec = build_spec("claude", &request);
            assert_eq!(engine.evaluate(&policy, &spec), Evaluation::Prompt);
            assert!(!policy.consume_ticket("create_checkpoint"));
            let answer = settle_prompt(&Arc::new(Mutex::new(None)), "request-1", &policy, &spec,
                ParkOutcome::Selected { option_id: "choice".into(), kind: choice, auto: false });
            assert_eq!(answer.as_deref(), Some("choice"));
            assert!(!policy.consume_ticket("rename_note"));
            assert_eq!(policy.consume_ticket("create_checkpoint"),
                matches!(choice, PermissionOptionKind::AllowOnce | PermissionOptionKind::AllowAlways));
            assert!(!policy.consume_ticket("create_checkpoint"));
        }
    }
}

#[test]
fn unrelated_explicit_kinds_and_read_only_tools_keep_their_behavior() {
    for (name, wire_kind, expected, mutating) in [
        ("mcp__carbide__get_note_history", "read", ToolKind::Read, false),
        ("mcp__carbide__read_note_version", "read", ToolKind::Read, false),
        ("unrelated_create_checkpoint", "read", ToolKind::Read, false),
        ("mcp__elsewhere__create_checkpoint", "read", ToolKind::Read, false),
        ("some_command", "execute", ToolKind::Execute, false),
        ("mcp__carbide__rename_note", "read", ToolKind::Read, true),
    ] {
        let spec = build_spec("claude", &request(wire_kind, name, all_options()));
        assert_eq!(spec.kind, expected, "{name}");
        assert_eq!(spec.mutating, mutating, "{name}");
        if !mutating {
            let policy = SessionPolicy::default();
            policy.grant_for(&spec);
            assert!(!policy.consume_ticket(name.trim_start_matches("mcp__carbide__")));
        }
    }
}
