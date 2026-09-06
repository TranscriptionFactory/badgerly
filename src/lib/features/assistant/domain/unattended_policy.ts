import type { RunKind } from "$lib/features/assistant/types/run";

// Mirrors native_agent.rs. The frontend picks the number; the backend clamps to
// the same ceiling independently, so a spec that never went through here still
// terminates. Two enforcements of one rule, deliberately — not two policies.
export const INTERACTIVE_MAX_ITERATIONS = 16;
export const UNATTENDED_MAX_ITERATIONS = 48;
export const MAX_ITERATIONS_HARD_CAP = 128;

export function is_unattended_kind(kind: RunKind): boolean {
  return kind === "background";
}

// `requested` of null/undefined, or any non-positive or non-finite value, means
// "no opinion" and takes the kind's default. A fractional request floors rather
// than refuses: the caller asked for a budget, not a specific float.
export function resolve_max_iterations(
  kind: RunKind,
  requested?: number | null,
): number {
  const fallback = is_unattended_kind(kind)
    ? UNATTENDED_MAX_ITERATIONS
    : INTERACTIVE_MAX_ITERATIONS;
  const chosen =
    typeof requested === "number" &&
    Number.isFinite(requested) &&
    Math.floor(requested) > 0
      ? Math.floor(requested)
      : fallback;
  return Math.min(chosen, MAX_ITERATIONS_HARD_CAP);
}
