import type { NativeProposal } from "$lib/generated/bindings";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import {
  operation_hunks,
  validate_edit_operations,
} from "$lib/features/assistant/domain/edit_operations";
import type {
  Proposal,
  ProposalOrigin,
} from "$lib/features/assistant/types/proposal";

export function build_native_proposal(
  input: NativeProposal,
  origin: ProposalOrigin,
  created_at: number,
  index: number,
  vault_id: string | undefined,
): Proposal {
  if (!vault_id || input.vault_id !== vault_id)
    throw new Error("Native proposal belongs to a different vault");
  const operations = input.operations.map((operation) => ({
    ...operation,
    base_revision: operation.base_revision ?? "",
    hunk_id: operation.hunk_id ?? "",
  }));
  const proposal: Proposal = {
    id: `${origin.run_id ?? origin.session_id}:${String(created_at)}:native:${String(index)}:${input.path}`,
    target: { kind: "note", note_path: input.path },
    base_content: input.base_content,
    base_revision: compute_note_revision(input.base_content),
    operations,
    conversion: "native",
    hunks: operation_hunks(input.base_content, operations),
    origin,
    status: "pending",
    created_at,
  };
  validate_edit_operations(proposal);
  return proposal;
}
