import { describe, expect, it } from "vitest";
import { SETTINGS_REGISTRY } from "$lib/features/settings/domain/settings_catalog";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/shared/types/editor_settings";

describe("memory_folder setting", () => {
  it("defaults to Memory and is catalogued under Files", () => {
    expect(DEFAULT_EDITOR_SETTINGS.memory_folder).toBe("Memory");

    const entry = SETTINGS_REGISTRY.find((d) => d.key === "memory_folder");
    expect(entry?.category).toBe("Files");
    expect(entry?.keywords).toContain("memory");
    expect(entry?.description).toContain("memory: true");
  });
});
