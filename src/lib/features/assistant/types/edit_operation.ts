import type { NoteRevision } from "$lib/features/assistant/types/proposal";

export type EditOperation = {
  base_revision: NoteRevision;
  hunk_id: string;
} & (
  | { kind: "replace_span"; start: number; end: number; text: string }
  | { kind: "insert_at_heading"; heading: string; text: string }
  | { kind: "set_frontmatter"; key: string; value: unknown }
  | { kind: "rename_with_repair"; to_path: string }
);

export type ProposalMutation = {
  path: string;
  before: string | null;
  after: string | null;
};

export type OperationConflict = {
  hunk_id: string;
  start: number;
  end: number;
  reason: string;
};
