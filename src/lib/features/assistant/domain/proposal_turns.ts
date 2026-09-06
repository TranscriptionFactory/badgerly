import { proposal_mutation_paths } from "$lib/features/assistant/types/proposal";
import { type Proposal } from "$lib/features/assistant/types/proposal";
import type { RunId } from "$lib/features/assistant/types/run";

export type ProposalTurnStatus = "applied" | "reverted";

// The unit of revert: every proposal one agent run produced. Numbered per
// session in creation order so the review centre and the confirmation text
// can name a turn the same way.
export type ProposalTurn = {
  turn_id: RunId;
  session_id: string;
  ordinal: number;
  created_at: number;
  anchor: string | null;
  ambiguous: boolean;
  status: ProposalTurnStatus;
  proposals: Proposal[];
};

export type ReadyTurnRevertPlan = {
  status: "ready";
  session_id: string;
  target: ProposalTurn;
  later_turns: ProposalTurn[];
  anchor: string;
  proposals: Proposal[];
  note_paths: string[];
};

export type TurnRevertPlan =
  | ReadyTurnRevertPlan
  | { status: "refused"; reason: string }
  | { status: "nothing" };

export const NO_ANCHOR_REASON =
  "No checkpoint was recorded before this turn, so there is nothing to restore to.";

// Only turns that have written disk are listed: a turn whose proposals are all
// still pending or rejected has nothing to undo. Proposals with no run id
// (ambient and inline producers) belong to no turn, and document targets
// stage into a buffer rather than disk, so neither can be restored from git.
export function group_proposal_turns(
  proposals: readonly Proposal[],
): ProposalTurn[] {
  const by_turn = new Map<string, ProposalTurn>();
  for (const proposal of proposals) {
    const run_id = proposal.origin.run_id;
    if (run_id === null || proposal.target.kind !== "note") continue;
    if (proposal.status !== "applied" && proposal.status !== "reverted") {
      continue;
    }
    const key = JSON.stringify([proposal.origin.session_id, run_id]);
    const turn = by_turn.get(key);
    if (!turn) {
      by_turn.set(key, {
        turn_id: run_id,
        session_id: proposal.origin.session_id,
        ordinal: 0,
        created_at: proposal.created_at,
        anchor: proposal.origin.anchor ?? null,
        ambiguous: false,
        status: proposal.status,
        proposals: [proposal],
      });
      continue;
    }
    turn.ambiguous ||=
      turn.created_at !== proposal.created_at ||
      turn.anchor !== (proposal.origin.anchor ?? null);
    turn.proposals.push(proposal);
    turn.created_at = Math.min(turn.created_at, proposal.created_at);
    if (proposal.status === "applied") turn.status = "applied";
  }

  const turns = [...by_turn.values()].sort(
    (a, b) =>
      a.created_at - b.created_at ||
      a.turn_id.localeCompare(b.turn_id, "en", { numeric: true }),
  );
  const counters = new Map<string, number>();
  const run_counts = new Map<RunId, number>();
  for (const turn of turns)
    run_counts.set(turn.turn_id, (run_counts.get(turn.turn_id) ?? 0) + 1);
  for (const turn of turns) {
    turn.ambiguous ||= (run_counts.get(turn.turn_id) ?? 0) > 1;
    const ordinal = (counters.get(turn.session_id) ?? 0) + 1;
    counters.set(turn.session_id, ordinal);
    turn.ordinal = ordinal;
  }
  return turns;
}

const AMBIGUOUS_TURN_REASON =
  "This run id belongs to multiple turns; its checkpoint cannot be identified safely.";

export function turn_revert_block_reason(turn: ProposalTurn): string | null {
  if (turn.ambiguous) return AMBIGUOUS_TURN_REASON;
  if (turn.status === "reverted") return "This turn is already reverted.";
  if (turn.anchor === null) return NO_ANCHOR_REASON;
  return null;
}

export function plan_turn_revert(
  proposals: readonly Proposal[],
  turn_id: RunId,
): TurnRevertPlan {
  const turns = group_proposal_turns(proposals);
  const target = turns.find((turn) => turn.turn_id === turn_id);
  if (!target) {
    return {
      status: "refused",
      reason: "This turn has no applied edits to revert.",
    };
  }
  return plan_from(turns, target);
}

export function plan_session_revert(
  proposals: readonly Proposal[],
  session_id: string,
): TurnRevertPlan {
  const turns = group_proposal_turns(proposals);
  const target = turns.find(
    (turn) => turn.session_id === session_id && turn.status === "applied",
  );
  if (!target) return { status: "nothing" };
  return plan_from(turns, target);
}

// Checkpoints are linear: restoring to the target's anchor also discards every
// later turn's applied edits to the same session's notes, so those turns are
// part of the plan rather than collateral.
function plan_from(
  turns: ProposalTurn[],
  target: ProposalTurn,
): TurnRevertPlan {
  const reason = turn_revert_block_reason(target);
  if (reason !== null || target.anchor === null) {
    return { status: "refused", reason: reason ?? NO_ANCHOR_REASON };
  }

  if (
    turns.some(
      (turn) => turn.session_id === target.session_id && turn.ambiguous,
    )
  ) {
    return { status: "refused", reason: AMBIGUOUS_TURN_REASON };
  }
  const in_range = turns.filter(
    (turn) =>
      turn.session_id === target.session_id &&
      turn.ordinal >= target.ordinal &&
      turn.status === "applied",
  );
  const applied = in_range.flatMap((turn) =>
    turn.proposals.filter((proposal) => proposal.status === "applied"),
  );
  return {
    status: "ready",
    session_id: target.session_id,
    target,
    later_turns: in_range.filter((turn) => turn.turn_id !== target.turn_id),
    anchor: target.anchor,
    proposals: applied,
    note_paths: [...new Set(applied.flatMap(proposal_mutation_paths))],
  };
}

export function describe_turn_revert(plan: ReadyTurnRevertPlan): string {
  const turn = `turn ${String(plan.target.ordinal)}`;
  const later = plan.later_turns.map((t) => `turn ${String(t.ordinal)}`);
  const also =
    later.length > 0 ? `Reverting ${turn} also undoes ${join(later)}. ` : "";
  const notes =
    plan.note_paths.length === 1
      ? `${plan.note_paths[0] ?? ""} goes`
      : `${join(plan.note_paths)} go`;
  return `${also}${notes} back to the checkpoint before ${turn}; any edits you made after applying are discarded.`;
}

function join(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}
