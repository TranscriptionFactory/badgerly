import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_SETTINGS,
  GLOBAL_ONLY_SETTING_KEYS,
  omit_global_only_keys,
} from "$lib/shared/types/editor_settings";
import { SETTINGS_REGISTRY } from "$lib/features/settings/domain/settings_catalog";

const ENABLED = "unattended_runs_enabled";
const FOLDER = "unattended_trigger_folder";
const KEYS = [ENABLED, FOLDER] as const;

describe("unattended run settings", () => {
  // Starting an agent with nobody watching is opt-in, like ambient before it.
  it("defaults to off", () => {
    expect(DEFAULT_EDITOR_SETTINGS[ENABLED]).toBe(false);
  });

  // The folder has a useful default so enabling the toggle alone is enough to
  // get the documented behaviour; the toggle is what gates it.
  it("defaults the trigger folder to Inbox", () => {
    expect(DEFAULT_EDITOR_SETTINGS[FOLDER]).toBe("Inbox");
  });

  // Vault-scoped is the default and global is the opt-out, so these keys are
  // vault-scoped precisely by surviving the filter — a trigger folder names a
  // folder in one vault and is meaningless in another.
  it.each(KEYS)("%s is vault-scoped", (key) => {
    expect(omit_global_only_keys({ [key]: "x" })).toHaveProperty(key, "x");
    expect(GLOBAL_ONLY_SETTING_KEYS).not.toContain(key);
  });

  it.each(KEYS)("%s is discoverable under AI", (key) => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === key);

    expect(entry).toBeDefined();
    expect(entry?.category).toBe("AI");
    expect(entry?.label).toBeTruthy();
    expect(entry?.description).toBeTruthy();
    expect(entry?.keywords).toContain("unattended");
  });

  // The promise the description makes is the one the backend gate enforces.
  // If someone softens either, this fails next to the code that changed.
  it("promises review rather than a direct write", () => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === ENABLED);

    expect(entry?.description).toMatch(/never writes/i);
    expect(entry?.description).toMatch(/review/i);
  });

  it("tells the user that an empty folder disables the trigger", () => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === FOLDER);

    expect(entry?.description).toMatch(/empty disables/i);
    expect(entry?.description).toMatch(/nested/i);
  });
});
