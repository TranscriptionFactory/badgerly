import { describe, expect, it } from "vitest";
import {
  describe_unattended_run,
  describe_unattended_trigger,
} from "$lib/features/assistant/domain/unattended_summary";
import type { UnattendedRunSummary } from "$lib/features/assistant/types/unattended";

const watcher = {
  kind: "watcher" as const,
  note_path: "Inbox/new.md",
  folder: "Inbox",
};
const manual = { kind: "manual" as const, note_path: null, folder: null };

const summary = (patch: Partial<UnattendedRunSummary> = {}) =>
  describe_unattended_run({
    run_id: "run-1",
    trigger: watcher,
    started_at: 0,
    num_turns: 3,
    stopped_at_cap: false,
    proposal_count: 2,
    status: "done",
    ...patch,
  });

describe("describe_unattended_trigger", () => {
  it("names the note that started a watcher run", () => {
    expect(describe_unattended_trigger(watcher)).toBe("Inbox/new.md added");
  });

  it("names a manual run plainly", () => {
    expect(describe_unattended_trigger(manual)).toBe("run now");
  });

  it("falls back to the folder when no note path was recorded", () => {
    expect(describe_unattended_trigger({ ...watcher, note_path: null })).toBe(
      "Inbox changed",
    );
  });
});

describe("describe_unattended_run", () => {
  it("reports the trigger, the proposals and the iterations", () => {
    expect(summary()).toBe("Inbox/new.md added · 2 proposals · 3 iterations");
  });

  it("singularizes a single proposal and a single iteration", () => {
    expect(summary({ proposal_count: 1, num_turns: 1 })).toBe(
      "Inbox/new.md added · 1 proposal · 1 iteration",
    );
  });

  it("says nothing was proposed rather than omitting the count", () => {
    expect(summary({ proposal_count: 0 })).toContain("0 proposals");
  });

  it("flags a run that exhausted its budget", () => {
    expect(summary({ stopped_at_cap: true })).toContain(
      "hit the iteration limit",
    );
  });

  it("reports a failure instead of a proposal count", () => {
    const text = summary({ status: "error", proposal_count: 0 });
    expect(text).toContain("failed");
    expect(text).not.toContain("proposal");
  });

  it("reports a stopped run", () => {
    expect(summary({ status: "aborted" })).toContain("stopped");
  });
});
