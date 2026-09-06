export type ToolSelector = { kind: "full" } | { kind: "only"; names: string[] };

export type SurfacePolicy = {
  toolset: ToolSelector;
};

// Surface capability scope, not consent. Chat advertises the whole catalog and
// gates each mutation on the session's auto_approve; narrowing the catalog
// here would be invisible to the user and unable to widen mid-conversation.
export function chat_policy(): SurfacePolicy {
  return {
    toolset: { kind: "full" },
  };
}

export function inline_edit_policy(): SurfacePolicy {
  return {
    toolset: { kind: "only", names: ["read_note", "search_notes"] },
  };
}

// The read-only catalog plus the one typed-mutation tool. Advisory, not the
// safety boundary: `proposal_only_refusal` in native_agent.rs refuses any write
// an unattended run attempts regardless of what was advertised. This list only
// keeps the model from burning iterations on tools it would be refused.
//
// Kept in step with the Rust catalog by `mcp_mutating_parity.rs`, which fails if
// a name here is unknown or mutating, or if a read-only tool is missing.
export const UNATTENDED_TOOL_NAMES = [
  "get_backlinks",
  "get_note_history",
  "get_note_metadata",
  "get_outgoing_links",
  "git_log",
  "git_status",
  "list_memories",
  "list_notes",
  "list_properties",
  "list_references",
  "list_vaults",
  "query_notes_by_property",
  "query_tasks",
  "rag_query",
  "rag_status",
  "read_note",
  "read_note_version",
  "search_notes",
  "search_references",
  "edit_note",
];

// An unattended run advertises reads plus the typed edit path. Everything that
// writes directly is left out, and refused by the backend if called anyway.
export function unattended_run_policy(): SurfacePolicy {
  return {
    toolset: { kind: "only", names: [...UNATTENDED_TOOL_NAMES] },
  };
}
