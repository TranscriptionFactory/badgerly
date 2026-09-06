import type { RunId } from "$lib/features/assistant/types/run";

export type UnattendedTriggerKind = "watcher" | "manual";

// What started a run nobody asked for interactively. Carried on every proposal
// the run produces, so the review center can say where a change came from
// without consulting the run store, which does not outlive the app.
export type UnattendedTrigger = {
  kind: UnattendedTriggerKind;
  // The note whose arrival started the run; null for a manual run-now.
  note_path: string | null;
  // The trigger folder as configured when the run started; null for manual. A
  // snapshot rather than a live read, so a later settings change does not
  // rewrite the history of why this run happened.
  folder: string | null;
};

export type UnattendedRunStatus = "done" | "error" | "aborted";

export type UnattendedRunSummary = {
  run_id: RunId;
  trigger: UnattendedTrigger;
  started_at: number;
  num_turns: number;
  // The run exhausted its iteration budget rather than finishing.
  stopped_at_cap: boolean;
  proposal_count: number;
  status: UnattendedRunStatus;
};
