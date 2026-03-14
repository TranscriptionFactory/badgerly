import { describe, it, expect } from "vitest";
import {
  apply_global_only_overrides,
  DEFAULT_EDITOR_SETTINGS,
} from "$lib/shared/types/editor_settings";

describe("apply_global_only_overrides", () => {
  it("does not override array settings with null", async () => {
    const base = { ...DEFAULT_EDITOR_SETTINGS };
    const get_setting = async () => null;

    const result = await apply_global_only_overrides(base, get_setting);

    expect(result.ai_providers).toEqual(DEFAULT_EDITOR_SETTINGS.ai_providers);
    expect(Array.isArray(result.ai_providers)).toBe(true);
  });

  it("does not override array settings with a plain object", async () => {
    const base = { ...DEFAULT_EDITOR_SETTINGS };
    const get_setting = async () => ({ not: "an array" });

    const result = await apply_global_only_overrides(base, get_setting);

    expect(result.ai_providers).toEqual(DEFAULT_EDITOR_SETTINGS.ai_providers);
  });

  it("applies valid overrides of matching type", async () => {
    const base = { ...DEFAULT_EDITOR_SETTINGS };
    const get_setting = async (key: string) => {
      if (key === "ai_enabled") return false;
      return undefined;
    };

    const result = await apply_global_only_overrides(base, get_setting);

    expect(result.ai_enabled).toBe(false);
  });
});
