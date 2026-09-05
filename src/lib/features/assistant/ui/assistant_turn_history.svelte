<script lang="ts">
  import {
    proposal_path,
    type Proposal,
  } from "$lib/features/assistant/types/proposal";
  import type { RunId } from "$lib/features/assistant/types/run";
  import type { AssistantSessionSummary } from "$lib/features/assistant/types/session";
  import { KIND_GLYPHS } from "$lib/features/assistant/domain/kind_glyphs";
  import {
    describe_turn_revert,
    group_proposal_turns,
    plan_session_revert,
    plan_turn_revert,
    turn_revert_block_reason,
    type ProposalTurn,
    type ReadyTurnRevertPlan,
    type TurnRevertPlan,
  } from "$lib/features/assistant/domain/proposal_turns";

  interface Props {
    proposals: Proposal[];
    session_summaries: AssistantSessionSummary[];
    on_revert_turn: (turn_id: RunId, confirmed: boolean) => void;
    on_revert_session: (session_id: string, confirmed: boolean) => void;
  }

  let {
    proposals,
    session_summaries,
    on_revert_turn,
    on_revert_session,
  }: Props = $props();

  type SessionTurns = { session_id: string; turns: ProposalTurn[] };

  type PendingConfirm = (
    | { kind: "turn"; turn_id: RunId; plan: ReadyTurnRevertPlan }
    | { kind: "session"; session_id: string; plan: ReadyTurnRevertPlan }
  ) & { refreshed?: boolean };

  const session_by_id = $derived(
    new Map(session_summaries.map((session) => [session.id, session])),
  );

  const sessions = $derived.by((): SessionTurns[] => {
    const grouped: SessionTurns[] = [];
    for (const turn of group_proposal_turns(proposals)) {
      const group = grouped.find((g) => g.session_id === turn.session_id);
      if (group) group.turns.push(turn);
      else grouped.push({ session_id: turn.session_id, turns: [turn] });
    }
    return grouped;
  });

  // The confirmation lives here, beside the control that needs it: a plan
  // that undoes later turns must be seen before it runs, and declining leaves
  // everything as it was.
  let pending = $state<PendingConfirm | null>(null);

  function needs_confirmation(
    plan: TurnRevertPlan,
  ): plan is ReadyTurnRevertPlan {
    return plan.status === "ready" && plan.later_turns.length > 0;
  }

  function request_turn_revert(turn_id: RunId) {
    const plan = plan_turn_revert(proposals, turn_id);
    if (needs_confirmation(plan)) {
      pending = { kind: "turn", turn_id, plan };
      return;
    }
    on_revert_turn(turn_id, false);
  }

  function request_session_revert(session_id: string) {
    const plan = plan_session_revert(proposals, session_id);
    if (needs_confirmation(plan)) {
      pending = { kind: "session", session_id, plan };
      return;
    }
    on_revert_session(session_id, false);
  }

  function revert_scope(plan: ReadyTurnRevertPlan): string {
    return JSON.stringify([
      plan.target.turn_id,
      plan.target.ordinal,
      plan.anchor,
      plan.proposals.map((proposal) => proposal.id),
      plan.note_paths,
    ]);
  }

  function confirm_pending() {
    const confirmed = pending;
    pending = null;
    if (!confirmed) return;
    const current =
      confirmed.kind === "turn"
        ? plan_turn_revert(proposals, confirmed.turn_id)
        : plan_session_revert(proposals, confirmed.session_id);
    if (current.status !== "ready") return;
    if (revert_scope(current) !== revert_scope(confirmed.plan)) {
      pending = { ...confirmed, plan: current, refreshed: true };
      return;
    }
    if (confirmed.kind === "turn") on_revert_turn(confirmed.turn_id, true);
    else on_revert_session(confirmed.session_id, true);
  }

  function provenance(session_id: string): string {
    const session = session_by_id.get(session_id);
    return session
      ? `${KIND_GLYPHS[session.kind]} ${session.title}`
      : session_id;
  }

  function note_list(turn: ProposalTurn): string {
    return turn.proposals.map((p) => proposal_path(p.target)).join(", ");
  }
</script>

{#if sessions.length > 0}
  <div class="flex flex-col gap-3" data-testid="assistant-turn-history">
    <h2 class="text-xs font-medium text-muted-foreground">Applied turns</h2>
    {#each sessions as group (group.session_id)}
      <div
        class="flex flex-col gap-2 rounded-md border p-3"
        data-testid="assistant-turn-history-group"
        data-session-id={group.session_id}
      >
        <div class="flex items-center justify-between gap-2">
          <p
            class="text-xs text-muted-foreground"
            data-testid="assistant-turn-history-provenance"
          >
            from {provenance(group.session_id)}
          </p>
          {#if group.turns.some((turn) => turn.status === "applied")}
            <button
              type="button"
              class="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
              data-testid="assistant-revert-session"
              onclick={() => request_session_revert(group.session_id)}
            >
              Revert session
            </button>
          {/if}
        </div>

        {#each group.turns as turn (turn.turn_id)}
          {@const reason = turn_revert_block_reason(turn)}
          <div
            class="flex flex-wrap items-center gap-2 text-xs"
            data-testid="assistant-turn-row"
            data-turn-id={turn.turn_id}
            data-turn-status={turn.status}
          >
            <span class="font-medium">Turn {turn.ordinal}</span>
            <span
              class="text-muted-foreground"
              data-testid="assistant-turn-notes">{note_list(turn)}</span
            >
            <span
              class="rounded bg-accent px-1.5 py-0.5 text-accent-foreground"
              data-testid="assistant-turn-status">{turn.status}</span
            >
            {#if turn.status === "applied"}
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="assistant-revert-turn"
                disabled={reason !== null}
                title={reason ?? undefined}
                onclick={() => request_turn_revert(turn.turn_id)}
              >
                Revert
              </button>
              {#if reason !== null}
                <span
                  class="text-muted-foreground"
                  data-testid="assistant-revert-turn-reason">{reason}</span
                >
              {/if}
            {/if}
          </div>
        {/each}

        {#if pending && pending.plan.session_id === group.session_id}
          <div
            class="flex flex-col gap-2 rounded-md bg-accent p-2 text-xs text-accent-foreground"
            data-testid="assistant-revert-confirm"
          >
            {#if pending.refreshed}
              <p>
                The edits to revert changed. Review the updated scope and
                confirm again.
              </p>
            {/if}
            <p>{describe_turn_revert(pending.plan)}</p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md bg-destructive px-2.5 py-1 font-medium text-destructive-foreground hover:bg-destructive/90"
                data-testid="assistant-revert-confirm-accept"
                onclick={confirm_pending}
              >
                Revert {pending.plan.later_turns.length + 1} turn{pending.plan
                  .later_turns.length === 0
                  ? ""
                  : "s"}
              </button>
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-background"
                data-testid="assistant-revert-confirm-cancel"
                onclick={() => (pending = null)}
              >
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
