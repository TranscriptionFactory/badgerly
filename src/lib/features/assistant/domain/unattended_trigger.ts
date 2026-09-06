import { normalize_path_key } from "$lib/shared/utils/path";

export type UnattendedTriggerReason =
  | "settings_not_loaded"
  | "disabled"
  | "no_vault"
  | "vault_mismatch"
  | "no_trigger_folder"
  | "outside_trigger_folder";

export type UnattendedTriggerDecision =
  | { action: "ignore"; reason: UnattendedTriggerReason }
  | { action: "run"; vault_id: string; note_path: string };

export type UnattendedTriggerInput = {
  settings_loaded: boolean;
  enabled: boolean;
  trigger_folder: string;
  active_vault_id: string | null;
  event_vault_id: string;
  note_path: string;
};

// Trailing and leading slashes are a user-typed accident, not meaning.
export function normalize_trigger_folder(folder: string): string {
  return folder.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

// Segment-wise containment, so `Inbox` claims `Inbox/a.md` and `Inbox/sub/b.md`
// but not `Inbox2/c.md`. Matching is case-insensitive to agree with the rest of
// the path helpers, which treat vault paths as case-insensitive keys.
export function is_in_trigger_folder(
  note_path: string,
  trigger_folder: string,
): boolean {
  const folder = normalize_trigger_folder(trigger_folder);
  if (folder === "") return false;
  const prefix = normalize_path_key(folder) + "/";
  return normalize_path_key(note_path).startsWith(prefix);
}

// Gate order is load-bearing, as in the ambient reactor: `settings_loaded` is
// read FIRST, because until settings land `enabled` still reads as its default
// and acting on it would start a run the user never opted into.
//
// There is no queue. An event that arrives while the trigger is off is decided
// against here and dropped, never buffered for a later enable — that is what
// "no runs for events queued while disabled" means.
export function resolve_unattended_trigger(
  input: UnattendedTriggerInput,
): UnattendedTriggerDecision {
  if (!input.settings_loaded) {
    return { action: "ignore", reason: "settings_not_loaded" };
  }
  if (!input.enabled) {
    return { action: "ignore", reason: "disabled" };
  }
  if (!input.active_vault_id) {
    return { action: "ignore", reason: "no_vault" };
  }
  if (input.active_vault_id !== input.event_vault_id) {
    return { action: "ignore", reason: "vault_mismatch" };
  }
  if (normalize_trigger_folder(input.trigger_folder) === "") {
    return { action: "ignore", reason: "no_trigger_folder" };
  }
  if (!is_in_trigger_folder(input.note_path, input.trigger_folder)) {
    return { action: "ignore", reason: "outside_trigger_folder" };
  }
  return {
    action: "run",
    vault_id: input.active_vault_id,
    note_path: input.note_path,
  };
}
