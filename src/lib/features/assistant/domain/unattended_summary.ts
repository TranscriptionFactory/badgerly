import type {
  UnattendedRunSummary,
  UnattendedTrigger,
} from "$lib/features/assistant/types/unattended";

export function describe_unattended_trigger(trigger: UnattendedTrigger): string {
  if (trigger.kind === "manual") return "run now";
  if (trigger.note_path) return `${trigger.note_path} added`;
  return trigger.folder ? `${trigger.folder} changed` : "folder changed";
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// The "while you were away" line. Deliberately states the iteration count even
// on a clean run: the number is how a user judges whether raising the budget
// would have helped, and it is the only place it is visible.
export function describe_unattended_run(summary: UnattendedRunSummary): string {
  const parts = [describe_unattended_trigger(summary.trigger)];

  if (summary.status === "error") {
    parts.push("failed");
  } else if (summary.status === "aborted") {
    parts.push("stopped");
  } else {
    parts.push(plural(summary.proposal_count, "proposal"));
  }

  parts.push(plural(summary.num_turns, "iteration"));
  if (summary.stopped_at_cap) parts.push("hit the iteration limit");

  return parts.join(" · ");
}
