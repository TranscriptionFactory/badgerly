import { describe, expect, it } from "vitest";
import { AssistantUnattendedStore } from "$lib/features/assistant";
import type { UnattendedRunSummary } from "$lib/features/assistant";
import { require_fixture } from "../helpers/require_fixture";

const summary = (
  run_id: string,
  patch: Partial<UnattendedRunSummary> = {},
): UnattendedRunSummary => ({
  run_id,
  trigger: { kind: "manual", note_path: null, folder: null },
  started_at: 0,
  num_turns: 1,
  stopped_at_cap: false,
  proposal_count: 0,
  status: "done",
  ...patch,
});

describe("AssistantUnattendedStore", () => {
  it("keeps the newest run first", () => {
    const store = new AssistantUnattendedStore();
    store.record(summary("run-1"));
    store.record(summary("run-2"));

    expect(store.summaries.map((s) => s.run_id)).toEqual(["run-2", "run-1"]);
  });

  it("replaces a re-recorded run rather than duplicating it", () => {
    const store = new AssistantUnattendedStore();
    store.record(summary("run-1", { proposal_count: 0 }));
    store.record(summary("run-1", { proposal_count: 3 }));

    expect(store.summaries).toHaveLength(1);
    expect(require_fixture(store.summaries[0]).proposal_count).toBe(3);
  });

  it("caps the history rather than growing without bound", () => {
    const store = new AssistantUnattendedStore();
    for (let i = 0; i < 30; i += 1) store.record(summary(`run-${String(i)}`));

    expect(store.summaries).toHaveLength(20);
    expect(require_fixture(store.summaries[0]).run_id).toBe("run-29");
  });
});
