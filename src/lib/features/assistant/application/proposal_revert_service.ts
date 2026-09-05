import { error_message } from "$lib/shared/utils/error_message";
import {
  plan_session_revert,
  plan_turn_revert,
  type ReadyTurnRevertPlan,
  type TurnRevertPlan,
} from "$lib/features/assistant/domain/proposal_turns";
import type { AssistantProposalStore } from "$lib/features/assistant/state/assistant_proposal_store.svelte";
import type {
  ProposalCheckpointPort,
  ProposalNotePort,
} from "$lib/features/assistant/ports";
import { proposal_path } from "$lib/features/assistant/types/proposal";
import type { RunId } from "$lib/features/assistant/types/run";

// Structural, following AgentProposalGit in agent_proposal_service.ts. The
// git feature's restore_file is deliberately NOT used: it refuses any path
// with uncommitted changes, which is the state of every just-applied note and
// of every note the user edited after applying — exactly what a revert must
// restore. Reading the anchor's bytes and writing them through the note port
// is the same primitive the runner's end-of-turn rollback uses.
export type ProposalRevertGit = {
  get_file_at_commit(file_path: string, commit_hash: string): Promise<string>;
};

export type ProposalRevertDeps = {
  proposals: AssistantProposalStore;
  notes: ProposalNotePort;
  git: ProposalRevertGit;
  checkpoint: ProposalCheckpointPort;
};

export type ProposalRevertOptions = { confirmed: boolean };

export type ProposalRevertOutcome =
  | {
      status: "reverted";
      plan: ReadyTurnRevertPlan;
      restored_note_paths: string[];
      failed: { note_path: string; error: string }[];
    }
  | { status: "needs_confirmation"; plan: ReadyTurnRevertPlan }
  | { status: "refused"; reason: string }
  | { status: "nothing" };

export class ProposalRevertService {
  constructor(private readonly deps: ProposalRevertDeps) {}

  revert_turn(
    turn_id: RunId,
    options: ProposalRevertOptions,
  ): Promise<ProposalRevertOutcome> {
    return this.run(
      plan_turn_revert(this.deps.proposals.proposals, turn_id),
      options,
    );
  }

  revert_session(
    session_id: string,
    options: ProposalRevertOptions,
  ): Promise<ProposalRevertOutcome> {
    return this.run(
      plan_session_revert(this.deps.proposals.proposals, session_id),
      options,
    );
  }

  // One checkpoint per revert, mirroring apply_batch: the revert discards
  // edits by contract, so it must itself be undoable, and a failed checkpoint
  // fails the whole revert closed. Each path is restored independently and a
  // proposal is marked reverted only when its note actually went back — a
  // path that failed keeps its proposal applied so the record stays honest.
  private async run(
    plan: TurnRevertPlan,
    options: ProposalRevertOptions,
  ): Promise<ProposalRevertOutcome> {
    if (plan.status !== "ready") return plan;
    if (plan.later_turns.length > 0 && !options.confirmed) {
      return { status: "needs_confirmation", plan };
    }

    const checkpoint = await this.deps.checkpoint.create_checkpoint(
      `before reverting turn ${String(plan.target.ordinal)}`,
    );
    if (checkpoint === "failed") {
      return {
        status: "refused",
        reason: "checkpoint failed; nothing reverted",
      };
    }

    const restored_note_paths: string[] = [];
    const failed: { note_path: string; error: string }[] = [];
    for (const note_path of plan.note_paths) {
      try {
        await this.restore(note_path, plan.anchor);
        restored_note_paths.push(note_path);
      } catch (err) {
        failed.push({ note_path, error: error_message(err) });
      }
    }

    const restored = new Set(restored_note_paths);
    for (const proposal of plan.proposals) {
      if (restored.has(proposal_path(proposal.target))) {
        this.deps.proposals.set_status(proposal.id, "reverted");
      }
    }
    return { status: "reverted", plan, restored_note_paths, failed };
  }

  // The note port's write is guarded by the mtime of its last read, so the
  // read is not optional: without it the guard compares against the read
  // taken before the apply and refuses the restore as a conflict.
  private async restore(note_path: string, anchor: string): Promise<void> {
    const content = await this.deps.git.get_file_at_commit(note_path, anchor);
    const current = await this.deps.notes.read_note(note_path);
    if (current === null) throw new Error("the note no longer exists");
    if (current === content) return;
    await this.deps.notes.write_note(note_path, content);
  }
}
