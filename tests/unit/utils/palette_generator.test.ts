import { describe, it, expect } from "vitest";
import {
  generate_palette,
  apply_auto_palette,
} from "$lib/shared/utils/palette_generator";
import type { Theme } from "$lib/shared/types/theme";
import { BUILTIN_NORDIC_DARK } from "$lib/shared/types/theme";

const OKLCH_RE = /^oklch\(\d+\.\d+ \d+\.\d+ \d+(\.\d+)?\)$/;

describe("generate_palette", () => {
  it("produces valid OKLch strings for all roles", () => {
    const palette = generate_palette(155, 0.11, "light");
    for (const [key, value] of Object.entries(palette)) {
      expect(value, `${key} should be valid OKLch`).toMatch(OKLCH_RE);
    }
  });

  it("generates all 12 semantic color roles", () => {
    const palette = generate_palette(200, 0.15, "dark");
    const keys = Object.keys(palette);
    expect(keys).toHaveLength(12);
    expect(keys).toContain("editor_text_color");
    expect(keys).toContain("link_color");
    expect(keys).toContain("highlight_bg");
    expect(keys).toContain("highlight_text_color");
  });

  it("light scheme has lower lightness for text roles than dark scheme", () => {
    const light = generate_palette(155, 0.11, "light");
    const dark = generate_palette(155, 0.11, "dark");

    const extract_lightness = (s: string) => {
      const m = s.match(/oklch\((\d+\.\d+)/);
      return parseFloat(m?.[1] ?? "0");
    };

    expect(extract_lightness(light.link_color)).toBeLessThan(
      extract_lightness(dark.link_color),
    );
    expect(extract_lightness(light.editor_text_color)).toBeLessThan(
      extract_lightness(dark.editor_text_color),
    );
  });

  it("uses hue offset for highlights", () => {
    const palette = generate_palette(100, 0.15, "light");
    expect(palette.highlight_bg).toContain("130.0");
    expect(palette.link_color).toContain("100.0");
  });
});

describe("apply_auto_palette", () => {
  function make_theme(overrides: Partial<Theme> = {}): Theme {
    return { ...BUILTIN_NORDIC_DARK, is_builtin: false, ...overrides };
  }

  it("fills null color fields when auto_palette is true", () => {
    const theme = make_theme({ auto_palette: true, link_color: null });
    const result = apply_auto_palette(theme);
    expect(result.link_color).not.toBeNull();
    expect(result.link_color).toMatch(OKLCH_RE);
  });

  it("preserves non-null overrides", () => {
    const custom_link = "oklch(0.6 0.2 300)";
    const theme = make_theme({
      auto_palette: true,
      link_color: custom_link,
    });
    const result = apply_auto_palette(theme);
    expect(result.link_color).toBe(custom_link);
  });

  it("returns theme unchanged when auto_palette is false", () => {
    const theme = make_theme({ auto_palette: false, link_color: null });
    const result = apply_auto_palette(theme);
    expect(result.link_color).toBeNull();
  });

  it("does not mutate the original theme object", () => {
    const theme = make_theme({ auto_palette: true });
    const result = apply_auto_palette(theme);
    expect(result).not.toBe(theme);
    expect(theme.link_color).toBeNull();
  });
});
