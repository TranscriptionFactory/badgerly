import { describe, expect, it } from "vitest";
import {
  is_in_trigger_folder,
  normalize_trigger_folder,
  resolve_unattended_trigger,
  type UnattendedTriggerInput,
} from "$lib/features/assistant/domain/unattended_trigger";

const base: UnattendedTriggerInput = {
  settings_loaded: true,
  enabled: true,
  trigger_folder: "Inbox",
  active_vault_id: "v1",
  event_vault_id: "v1",
  note_path: "Inbox/note.md",
};

const decide = (patch: Partial<UnattendedTriggerInput> = {}) =>
  resolve_unattended_trigger({ ...base, ...patch });

describe("is_in_trigger_folder", () => {
  it("claims direct children and nested descendants", () => {
    expect(is_in_trigger_folder("Inbox/a.md", "Inbox")).toBe(true);
    expect(is_in_trigger_folder("Inbox/sub/deep/b.md", "Inbox")).toBe(true);
  });

  it("does not claim a sibling folder sharing the prefix", () => {
    expect(is_in_trigger_folder("Inbox2/c.md", "Inbox")).toBe(false);
    expect(is_in_trigger_folder("InboxArchive/c.md", "Inbox")).toBe(false);
  });

  it("does not claim the folder note itself or an unrelated path", () => {
    expect(is_in_trigger_folder("Inbox", "Inbox")).toBe(false);
    expect(is_in_trigger_folder("Notes/a.md", "Inbox")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(is_in_trigger_folder("inbox/a.md", "Inbox")).toBe(true);
    expect(is_in_trigger_folder("Inbox/a.md", "INBOX")).toBe(true);
  });

  it("tolerates stray slashes in the configured folder", () => {
    expect(is_in_trigger_folder("Inbox/a.md", "/Inbox/")).toBe(true);
    expect(normalize_trigger_folder("  /Inbox//  ")).toBe("Inbox");
  });

  it("claims nothing when no folder is configured", () => {
    expect(is_in_trigger_folder("Inbox/a.md", "")).toBe(false);
    expect(is_in_trigger_folder("Inbox/a.md", "   ")).toBe(false);
  });
});

describe("resolve_unattended_trigger", () => {
  it("runs for a note added under the configured folder", () => {
    expect(decide()).toEqual({
      action: "run",
      vault_id: "v1",
      note_path: "Inbox/note.md",
    });
  });

  it("runs for a nested note", () => {
    expect(decide({ note_path: "Inbox/sub/deep.md" }).action).toBe("run");
  });

  it("ignores a note outside the folder", () => {
    expect(decide({ note_path: "Notes/a.md" })).toEqual({
      action: "ignore",
      reason: "outside_trigger_folder",
    });
  });

  it("ignores everything while the trigger is disabled", () => {
    expect(decide({ enabled: false })).toEqual({
      action: "ignore",
      reason: "disabled",
    });
  });

  // The gate order is the point: with settings unloaded, `enabled` still holds
  // its default, so reading it first would act on a value nobody chose.
  it("ignores everything before settings have loaded, even when enabled", () => {
    expect(decide({ settings_loaded: false, enabled: true })).toEqual({
      action: "ignore",
      reason: "settings_not_loaded",
    });
  });

  it("ignores an event for a vault that is no longer active", () => {
    expect(decide({ event_vault_id: "v2" })).toEqual({
      action: "ignore",
      reason: "vault_mismatch",
    });
  });

  it("ignores an event when no vault is open", () => {
    expect(decide({ active_vault_id: null })).toEqual({
      action: "ignore",
      reason: "no_vault",
    });
  });

  it("ignores everything when no trigger folder is configured", () => {
    expect(decide({ trigger_folder: "" })).toEqual({
      action: "ignore",
      reason: "no_trigger_folder",
    });
  });
});
