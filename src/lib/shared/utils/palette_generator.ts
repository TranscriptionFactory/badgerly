import type { Theme, ThemeColorScheme } from "$lib/shared/types/theme";

export type GeneratedPalette = {
  editor_text_color: string;
  link_color: string;
  bold_color: string;
  italic_color: string;
  blockquote_border_color: string;
  blockquote_text_color: string;
  code_block_bg: string;
  code_block_text_color: string;
  inline_code_bg: string;
  inline_code_text_color: string;
  highlight_bg: string;
  highlight_text_color: string;
};

function oklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(4)} ${(h % 360).toFixed(1)})`;
}

type PaletteSpec = {
  [K in keyof GeneratedPalette]: {
    light: [l: number, c_factor: number, h_offset: number];
    dark: [l: number, c_factor: number, h_offset: number];
  };
};

const SPEC: PaletteSpec = {
  editor_text_color: {
    light: [0.25, 0.02 / 0.11, 0],
    dark: [0.88, 0.02 / 0.11, 0],
  },
  link_color: {
    light: [0.5, 1, 0],
    dark: [0.72, 1, 0],
  },
  bold_color: {
    light: [0.42, 0.6, 0],
    dark: [0.75, 0.6, 0],
  },
  italic_color: {
    light: [0.48, 0.4, 0],
    dark: [0.7, 0.4, 0],
  },
  blockquote_border_color: {
    light: [0.6, 0.5, 0],
    dark: [0.55, 0.5, 0],
  },
  blockquote_text_color: {
    light: [0.45, 0.2, 0],
    dark: [0.7, 0.2, 0],
  },
  code_block_bg: {
    light: [0.95, 0.08, 0],
    dark: [0.18, 0.08, 0],
  },
  code_block_text_color: {
    light: [0.35, 0.3, 0],
    dark: [0.8, 0.3, 0],
  },
  inline_code_bg: {
    light: [0.93, 0.12, 0],
    dark: [0.2, 0.12, 0],
  },
  inline_code_text_color: {
    light: [0.4, 0.4, 0],
    dark: [0.78, 0.4, 0],
  },
  highlight_bg: {
    light: [0.88, 0.3, 30],
    dark: [0.3, 0.3, 30],
  },
  highlight_text_color: {
    light: [0.25, 0.1, 30],
    dark: [0.9, 0.1, 30],
  },
};

export function generate_palette(
  hue: number,
  chroma: number,
  scheme: ThemeColorScheme,
): GeneratedPalette {
  const result = {} as GeneratedPalette;
  for (const [key, spec] of Object.entries(SPEC) as [
    keyof GeneratedPalette,
    PaletteSpec[keyof GeneratedPalette],
  ][]) {
    const [l, c_factor, h_offset] = spec[scheme];
    result[key] = oklch(l, chroma * c_factor, hue + h_offset);
  }
  return result;
}

const PALETTE_KEYS: (keyof GeneratedPalette)[] = [
  "editor_text_color",
  "link_color",
  "bold_color",
  "italic_color",
  "blockquote_border_color",
  "blockquote_text_color",
  "code_block_bg",
  "code_block_text_color",
  "inline_code_bg",
  "inline_code_text_color",
  "highlight_bg",
  "highlight_text_color",
];

export function apply_auto_palette(theme: Theme): Theme {
  if (!theme.auto_palette) return theme;

  const palette = generate_palette(
    theme.accent_hue,
    theme.accent_chroma,
    theme.color_scheme,
  );

  const patched = { ...theme };
  for (const key of PALETTE_KEYS) {
    if (patched[key] === null) {
      (patched as unknown as Record<string, string | null>)[key] = palette[key];
    }
  }
  return patched;
}
