import type { UnattendedRunSummary } from "$lib/features/assistant/types/unattended";
import type { RunId } from "$lib/features/assistant/types/run";

// In-memory only, like notices and pending proposals: a summary describes a run
// this app session performed. The proposals it produced are what persist.
const MAX_SUMMARIES = 20;

export class AssistantUnattendedStore {
  summaries = $state<UnattendedRunSummary[]>([]);

  // Newest first, one entry per run: a re-recorded run replaces its earlier
  // entry rather than appearing twice.
  record(summary: UnattendedRunSummary): void {
    this.summaries = [
      summary,
      ...this.summaries.filter((entry) => entry.run_id !== summary.run_id),
    ].slice(0, MAX_SUMMARIES);
  }

  by_run(run_id: RunId): UnattendedRunSummary | null {
    return this.summaries.find((entry) => entry.run_id === run_id) ?? null;
  }

  // Summaries name proposals in one vault's queue; a switch retires them.
  clear(): void {
    this.summaries = [];
  }
}
