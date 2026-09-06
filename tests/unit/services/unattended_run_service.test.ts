import { describe, expect, it } from "vitest";
import {
  UNATTENDED_RUN_OP,
  UnattendedRunService,
  type UnattendedRunDeps,
} from "$lib/features/assistant/application/unattended_run_service";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { UNATTENDED_TOOL_NAMES } from "$lib/features/ai";
import { UNATTENDED_MAX_ITERATIONS } from "$lib/features/assistant/domain/unattended_policy";
import type { NativeProposal } from "$lib/generated/bindings";
import type { Proposal } from "$lib/features/assistant/types/proposal";
import type { RunEvent } from "$lib/features/assistant";
import type { UnattendedRunSummary } from "$lib/features/assistant/types/unattended";
import { create_test_run_starter } from "../../adapters/test_run_starter";
import fixtures from "../../fixtures/2026-09-05_native_edit_proposals.json";
import { require_fixture } from "../helpers/require_fixture";

// Reuses Lane 3's native-proposal fixture rather than hand-rolling one: the
// operations there already satisfy validate_edit_operations, so this test
// exercises the service, not a fixture's shape.
const VAULT = "vault-1";

const watcher_trigger = {
  kind: "watcher" as const,
  note_path: "Inbox/new.md",
  folder: "Inbox",
};

function native_proposal(path: string): NativeProposal {
  const template = require_fixture(fixtures[0]) as NativeProposal;
  return { ...template, path };
}

function proposal_events(paths: string[], stats?: RunEvent): RunEvent[] {
  return [
    {
      type: "tool_end",
      id: "c1",
      name: "edit_note",
      ok: true,
      proposals: paths.map(native_proposal),
      paths,
      mutating: true,
    },
    stats ?? { type: "done", stats: { num_turns: 2 } },
  ];
}

function harness(
  events: RunEvent[],
  overrides: Partial<UnattendedRunDeps> = {},
) {
  const queued: Proposal[][] = [];
  const summaries: UnattendedRunSummary[] = [];
  const starter = create_test_run_starter(() => events);
  const deps: UnattendedRunDeps = {
    run_starter: starter,
    queue: { add_many: (p) => queued.push(p) },
    summaries: { record: (s) => summaries.push(s) },
    ops: new OpStore(),
    active_vault_id: () => VAULT,
    build_prompt: () => "triage the inbox",
    now_ms: () => 1000,
    ...overrides,
  };
  return {
    service: new UnattendedRunService(deps),
    starter,
    queued,
    summaries,
    deps,
  };
}

describe("UnattendedRunService spec", () => {
  it("runs as a background, unattended, native run", async () => {
    const { service, starter } = harness(proposal_events([]));
    await service.run(watcher_trigger);

    const spec = require_fixture(starter.specs[0]);
    expect(spec.kind).toBe("background");
    expect(spec.request.mode).toBe("agent");
    if (spec.request.mode !== "agent") throw new Error("expected agent mode");
    expect(spec.request.backend).toBe("native");
    expect(spec.request.max_iterations).toBe(UNATTENDED_MAX_ITERATIONS);
  });

  it("advertises only the unattended toolset", async () => {
    const { service, starter } = harness(proposal_events([]));
    await service.run(watcher_trigger);

    const request = require_fixture(starter.specs[0]).request;
    if (request.mode !== "agent") throw new Error("expected agent mode");
    expect(request.toolset).toEqual({
      kind: "only",
      names: UNATTENDED_TOOL_NAMES,
    });
  });

  // Nothing the run can call reaches disk, so there is no consent to collect
  // and a prompt would park a run nobody is there to answer.
  it("auto-approves, because nothing it can call can write", async () => {
    const { service, starter } = harness(proposal_events([]));
    await service.run(watcher_trigger);

    const request = require_fixture(starter.specs[0]).request;
    if (request.mode !== "agent") throw new Error("expected agent mode");
    expect(request.auto_approve).toBe(true);
  });
});

describe("UnattendedRunService proposals", () => {
  it("queues the run's proposals stamped with the trigger", async () => {
    const { service, queued } = harness(proposal_events(["a.md", "b.md"]));
    const result = await service.run(watcher_trigger);

    expect(result.status).toBe("started");
    expect(queued).toHaveLength(1);
    expect(require_fixture(queued[0])).toHaveLength(2);
    for (const proposal of require_fixture(queued[0])) {
      expect(proposal.origin.trigger).toEqual(watcher_trigger);
      expect(proposal.origin.run_id).toBe("run-1");
      expect(proposal.status).toBe("pending");
    }
  });

  // The anchor is deliberately absent: proposals may be reviewed hours later,
  // and reverting to a run-start anchor would discard unrelated work.
  it("carries no anchor", async () => {
    const { service, queued } = harness(proposal_events(["a.md"]));
    await service.run(watcher_trigger);

    expect(
      require_fixture(require_fixture(queued[0])[0]).origin.anchor,
    ).toBeUndefined();
  });

  it("queues nothing when the run produced no proposals", async () => {
    const { service, queued, summaries } = harness(proposal_events([]));
    await service.run(watcher_trigger);

    expect(queued).toHaveLength(0);
    expect(require_fixture(summaries[0]).proposal_count).toBe(0);
  });

  it("does not queue into a vault the run did not start in", async () => {
    let vault = VAULT;
    const { service, queued, summaries } = harness(proposal_events(["a.md"]), {
      active_vault_id: () => vault,
    });
    const pending = service.run(watcher_trigger);
    vault = "v2";
    await pending;

    expect(queued).toHaveLength(0);
    expect(require_fixture(summaries[0]).proposal_count).toBe(0);
  });
});

describe("UnattendedRunService summary", () => {
  it("reports iterations and the capped flag", async () => {
    const { service, summaries } = harness(
      proposal_events(["a.md"], {
        type: "done",
        stats: { num_turns: 48, stopped_at_cap: true },
      }),
    );
    await service.run(watcher_trigger);

    expect(require_fixture(summaries[0])).toMatchObject({
      run_id: "run-1",
      trigger: watcher_trigger,
      num_turns: 48,
      stopped_at_cap: true,
      proposal_count: 1,
      status: "done",
    });
  });

  it("records a failed run rather than dropping it", async () => {
    const { service, summaries } = harness([
      { type: "error", message: "provider exploded" },
    ]);
    await service.run(watcher_trigger);

    expect(require_fixture(summaries[0]).status).toBe("error");
    expect(require_fixture(summaries[0]).proposal_count).toBe(0);
  });
});

describe("UnattendedRunService refusals", () => {
  it("refuses a second run while one is in flight", async () => {
    const { service } = harness(proposal_events([]));
    const first = service.run(watcher_trigger);
    const second = await service.run(watcher_trigger);

    expect(second).toEqual({
      status: "refused",
      reason: "A run is already in progress.",
    });
    await first;
  });

  it("releases the lock once the run finishes", async () => {
    const { service, deps } = harness(proposal_events([]));
    await service.run(watcher_trigger);

    expect(deps.ops.is_pending(UNATTENDED_RUN_OP)).toBe(false);
    expect((await service.run(watcher_trigger)).status).toBe("started");
  });

  it("refuses without a vault", async () => {
    const no_vault = harness(proposal_events([]), {
      active_vault_id: () => null,
    });
    expect((await no_vault.service.run(watcher_trigger)).status).toBe(
      "refused",
    );
  });

  // The kernel owns provider resolution and settles a refusal through the
  // outcome, so an unresolvable provider is a recorded failed run, not a
  // silently dropped trigger.
  it("records an unresolved provider as a failed run", async () => {
    const { service, summaries } = harness([
      { type: "error", message: "no provider resolved" },
    ]);
    const result = await service.run(watcher_trigger);

    expect(result.status).toBe("started");
    expect(require_fixture(summaries[0]).status).toBe("error");
  });

  it("does not start a run when it refuses", async () => {
    const { service, starter } = harness(proposal_events([]), {
      active_vault_id: () => null,
    });
    await service.run(watcher_trigger);
    expect(starter.specs).toHaveLength(0);
  });
});
