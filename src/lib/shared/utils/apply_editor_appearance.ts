import type { EditorSettings } from "$lib/shared/types/editor_settings";

const paragraph_spacing_map = {
  compact: "calc(var(--editor-spacing) * 0.8)",
  normal: "var(--editor-spacing)",
  relaxed: "calc(var(--editor-spacing) * 1.2)",
} as const;

const list_spacing_map = {
  compact: "calc(var(--editor-spacing) * 0.85)",
  normal: "var(--editor-spacing)",
  relaxed: "calc(var(--editor-spacing) * 1.2)",
} as const;

const list_item_spacing_map = {
  compact: "calc(var(--editor-spacing) * 0.2)",
  normal: "calc(var(--editor-spacing) * 0.35)",
  relaxed: "calc(var(--editor-spacing) * 0.5)",
} as const;

const code_block_padding_map = {
  compact: "calc(var(--editor-spacing) * 0.75)",
  normal: "calc(var(--editor-spacing) * 1)",
  relaxed: "calc(var(--editor-spacing) * 1.25)",
} as const;

const code_block_radius_map = {
  tight: "calc(var(--radius) * 0.5)",
  normal: "calc(var(--radius) * 0.75)",
  soft: "calc(var(--radius) * 1)",
} as const;

const blockquote_padding_map = {
  compact: {
    y: "calc(var(--editor-spacing) * 0.6)",
    x: "calc(var(--editor-spacing) * 0.85)",
  },
  normal: {
    y: "calc(var(--editor-spacing) * 0.75)",
    x: "calc(var(--editor-spacing) * 1)",
  },
  relaxed: {
    y: "calc(var(--editor-spacing) * 0.95)",
    x: "calc(var(--editor-spacing) * 1.2)",
  },
} as const;

let applied_property_keys: string[] = [];

export function apply_editor_appearance(settings: EditorSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const blockquote_padding =
    blockquote_padding_map[settings.editor_blockquote_padding];

  for (const key of applied_property_keys) {
    root.style.removeProperty(key);
  }

  const entries: [string, string][] = [
    [
      "--editor-paragraph-spacing",
      paragraph_spacing_map[settings.editor_paragraph_spacing_density],
    ],
    [
      "--editor-list-spacing",
      list_spacing_map[settings.editor_list_spacing_density],
    ],
    [
      "--editor-list-item-spacing",
      list_item_spacing_map[settings.editor_list_spacing_density],
    ],
    [
      "--editor-code-block-padding",
      code_block_padding_map[settings.editor_code_block_padding],
    ],
    [
      "--editor-code-block-radius",
      code_block_radius_map[settings.editor_code_block_radius],
    ],
    ["--editor-blockquote-padding-y", blockquote_padding.y],
    ["--editor-blockquote-padding-x", blockquote_padding.x],
    [
      "--editor-blockquote-border-width",
      `${String(settings.editor_blockquote_border_width)}px`,
    ],
    ["--editor-link-underline-style", settings.editor_link_underline_style],
  ];

  if (settings.editor_selection_color.trim() !== "") {
    entries.push(["--editor-selection-bg", settings.editor_selection_color]);
  }

  applied_property_keys = entries.map(([key]) => key);

  for (const [key, value] of entries) {
    root.style.setProperty(key, value);
  }
}
