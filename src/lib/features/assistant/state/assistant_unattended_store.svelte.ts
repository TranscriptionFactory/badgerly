import type { UnattendedRunSummary } from "$lib/features/assistant/types/unattended";

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
}
