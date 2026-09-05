import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_SETTINGS,
  GLOBAL_ONLY_SETTING_KEYS,
  omit_global_only_keys,
} from "$lib/shared/types/editor_settings";
import { SETTINGS_REGISTRY } from "$lib/features/settings/domain/settings_catalog";

const KEY = "ambient_notices_enabled";

describe("ambient notices opt-in", () => {
  // G1 — I6: opt-in means OFF until asked for.
  it("defaults to off", () => {
    expect(DEFAULT_EDITOR_SETTINGS[KEY]).toBe(false);
  });

  // G3 — the behavioural assertion for "vault-scoped". A grep over
  // editor_settings.ts cannot express "absent from a list inside that same
  // file"; this can. Vault-scoped is the DEFAULT and global is the opt-out, so
  // the key is vault-scoped precisely by surviving this filter.
  it("is vault-scoped: survives the global-only filter", () => {
    const filtered = omit_global_only_keys({ [KEY]: true });

    expect(filtered).toHaveProperty(KEY, true);
  });

  it("is not listed as a global-only key", () => {
    expect(GLOBAL_ONLY_SETTING_KEYS).not.toContain(KEY);
  });

  // Guards the ruling itself: every other ai_*/assistant_* key is app-global,
  // so this is the first vault-scoped one. If someone "fixes" the asymmetry by
  // adding it to the list, this fails loudly.
  it("is the exception among assistant settings, which are global", () => {
    expect(GLOBAL_ONLY_SETTING_KEYS).toContain(
      "assistant_session_retention_days",
    );
    expect(GLOBAL_ONLY_SETTING_KEYS).toContain("ai_enabled");
    expect(GLOBAL_ONLY_SETTING_KEYS).not.toContain(KEY);
  });

  // G4 — C1's retention setting is missing from the registry and is therefore
  // invisible to settings search. Not propagating that omission.
  it("is discoverable through settings search", () => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === KEY);

    expect(entry).toBeDefined();
    expect(entry?.label).toBeTruthy();
    expect(entry?.description).toBeTruthy();
    expect(entry?.category).toBeTruthy();
    expect(entry?.keywords.length).toBeGreaterThan(0);
  });

  it("is searchable by the words a user would type", () => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === KEY);

    expect(entry?.keywords).toContain("ambient");
    expect(entry?.keywords).toContain("notices");
  });
});

const MISSING_LINK_KEYS = [
  "ambient_missing_link_min_score",
  "ambient_missing_link_max_notices",
] as const;

describe("ambient missing-link settings", () => {
  it("default to a 0.6 similarity floor and 3 notices", () => {
    expect(DEFAULT_EDITOR_SETTINGS.ambient_missing_link_min_score).toBe(0.6);
    expect(DEFAULT_EDITOR_SETTINGS.ambient_missing_link_max_notices).toBe(3);
  });

  // Same ruling as the toggle they refine: ambient scans a vault's index, so
  // its knobs are per-vault too.
  it.each(MISSING_LINK_KEYS)("%s is vault-scoped", (key) => {
    expect(omit_global_only_keys({ [key]: 1 })).toHaveProperty(key, 1);
    expect(GLOBAL_ONLY_SETTING_KEYS).not.toContain(key);
  });

  it.each(MISSING_LINK_KEYS)("%s is discoverable under AI", (key) => {
    const entry = SETTINGS_REGISTRY.find((setting) => setting.key === key);

    expect(entry?.category).toBe("AI");
    expect(entry?.keywords).toContain("missing");
    expect(entry?.keywords).toContain("link");
  });

  // The score is a similarity, the opposite polarity of the inline-AI
  // "Max Context Distance"; the label must say so and must not be mistaken
  // for either existing threshold.
  it("labels the score as a similarity distinct from both existing thresholds", () => {
    const entry = SETTINGS_REGISTRY.find(
      (setting) => setting.key === "ambient_missing_link_min_score",
    );

    expect(entry?.label).toMatch(/similarity/i);
    expect(entry?.description).toMatch(/higher keeps fewer/i);
    expect(entry?.label).not.toBe("Max Context Distance");
    expect(entry?.label).not.toBe("Min Semantic Similarity");
  });
});
