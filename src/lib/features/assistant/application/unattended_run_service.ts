import type { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { unattended_run_policy } from "$lib/features/ai";
import { build_native_proposal } from "$lib/features/assistant/domain/native_proposals";
import {
  is_unattended_kind,
  resolve_max_iterations,
} from "$lib/features/assistant/domain/unattended_policy";
import type { NativeProposal } from "$lib/generated/bindings";
import type {
  Proposal,
  ProposalOrigin,
} from "$lib/features/assistant/types/proposal";
import type {
  RunId,
  RunSpec,
  RunStarter,
  RunStats,
} from "$lib/features/assistant/types/run";
import type {
  UnattendedRunStatus,
  UnattendedRunSummary,
  UnattendedTrigger,
} from "$lib/features/assistant/types/unattended";
import { create_logger } from "$lib/shared/utils/logger";
import { error_message } from "$lib/shared/utils/error_message";

const log = create_logger("unattended_run");

export const UNATTENDED_RUN_OP = "assistant.unattended_run";

export type UnattendedProposalQueue = {
  add_many(proposals: Proposal[]): void;
};

export type UnattendedRunSummarySink = {
  record(summary: UnattendedRunSummary): void;
};

export type UnattendedRunResult =
  | { status: "started"; summary: UnattendedRunSummary }
  | { status: "refused"; reason: string };

export type UnattendedRunDeps = {
  run_starter: RunStarter;
  queue: UnattendedProposalQueue;
  summaries: UnattendedRunSummarySink;
  ops: OpStore;
  active_vault_id: () => string | null;
  build_prompt: (trigger: UnattendedTrigger) => string;
  now_ms: () => number;
};

// An unattended run writes nothing, so it needs none of the agent turn's
// checkpoint/rollback machinery: its proposals arrive already-typed on the
// tool_end events Lane 3 introduced, and the disk is never touched.
//
// It deliberately carries NO anchor. An anchor names the state a revert
// restores to, and an unattended run's proposals may sit unreviewed for hours
// while the vault moves on — reverting to a run-start anchor would discard
// unrelated work. Per-proposal revert stays available, as for ambient
// proposals, which have no anchor for the same reason.
export class UnattendedRunService {
  constructor(private readonly deps: UnattendedRunDeps) {}

  get is_running(): boolean {
    return this.deps.ops.is_pending(UNATTENDED_RUN_OP);
  }

  async run(trigger: UnattendedTrigger): Promise<UnattendedRunResult> {
    // One at a time. A folder receiving a batch of notes must not start a run
    // per note and have them race each other's proposals into the queue.
    if (this.is_running) {
      return { status: "refused", reason: "A run is already in progress." };
    }

    const vault_id = this.deps.active_vault_id();
    if (!vault_id) return { status: "refused", reason: "No active vault." };

    const started_at = this.deps.now_ms();
    this.deps.ops.start(UNATTENDED_RUN_OP, started_at);

    const collected: NativeProposal[] = [];
    try {
      const handle = await this.deps.run_starter.start(this.spec(trigger), {
        on_event: (_run_id, event) => {
          if (event.type === "tool_end" && event.proposals?.length) {
            collected.push(...event.proposals);
          }
        },
      });

      const outcome = await handle.outcome;
      const summary = this.publish(
        handle.id,
        trigger,
        started_at,
        vault_id,
        collected,
        outcome.status,
        outcome.status === "done" ? outcome.stats : null,
      );
      return { status: "started", summary };
    } catch (error) {
      const message = error_message(error);
      log.warn(`Unattended run failed: ${message}`);
      return { status: "refused", reason: message };
    } finally {
      this.deps.ops.reset(UNATTENDED_RUN_OP);
    }
  }

  // No provider is passed: the kernel resolves one and settles a refusal
  // through `outcome`, so an unresolved provider surfaces as a recorded failed
  // run rather than a silent no-op.
  private spec(trigger: UnattendedTrigger): RunSpec {
    const kind = "background" as const;
    const prompt = this.deps.build_prompt(trigger);
    return {
      kind,
      label: prompt.slice(0, 80),
      request: {
        mode: "agent",
        prompt,
        toolset: unattended_run_policy().toolset,
        // Nothing can write, so there is nothing to consent to; a prompt would
        // park a run with nobody to answer it.
        auto_approve: true,
        history: [],
        backend: "native",
        max_iterations: resolve_max_iterations(kind),
        unattended: is_unattended_kind(kind),
      },
    };
  }

  private publish(
    run_id: RunId,
    trigger: UnattendedTrigger,
    started_at: number,
    vault_id: string,
    native: readonly NativeProposal[],
    status: UnattendedRunStatus,
    stats: RunStats | null,
  ): UnattendedRunSummary {
    // Re-asked after the run's awaits: a vault switch mid-run must not publish
    // one vault's proposals into another's queue.
    const vault_held = this.deps.active_vault_id() === vault_id;
    const origin: ProposalOrigin = {
      session_id: run_id,
      run_id,
      trigger,
    };
    const created_at = this.deps.now_ms();

    const proposals: Proposal[] = [];
    if (vault_held) {
      for (const [index, input] of native.entries()) {
        try {
          proposals.push(
            build_native_proposal(input, origin, created_at, index, vault_id),
          );
        } catch (error) {
          log.warn(
            `Dropped an unattended proposal for ${input.path}: ${error_message(error)}`,
          );
        }
      }
      if (proposals.length > 0) this.deps.queue.add_many(proposals);
    } else {
      log.warn(
        "The active vault changed; unattended proposals were not queued.",
      );
    }

    const summary: UnattendedRunSummary = {
      run_id,
      trigger,
      started_at,
      num_turns: stats?.num_turns ?? 0,
      stopped_at_cap: stats?.stopped_at_cap ?? false,
      proposal_count: proposals.length,
      status,
    };
    this.deps.summaries.record(summary);
    return summary;
  }
}
