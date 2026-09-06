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

// The instruction an unattended run is given. States the proposal-only contract
// in the prompt as well as enforcing it at the gate, so the model spends its
// budget proposing rather than rediscovering that writes are refused.
export function build_unattended_prompt(trigger: UnattendedTrigger): string {
  const subject =
    trigger.kind === "watcher" && trigger.note_path
      ? `The note "${trigger.note_path}" was just added to the vault.`
      : "Review the vault for work that needs doing.";

  return [
    subject,
    "Read it and any notes it relates to, then propose improvements: fix broken links, add links to related notes, and correct obvious errors.",
    "You cannot write to disk. Use edit_note with a typed `operation` argument to propose a change; every proposal is reviewed by a person before it lands.",
    "If nothing needs changing, say so and stop rather than inventing work.",
  ].join(" ");
}
