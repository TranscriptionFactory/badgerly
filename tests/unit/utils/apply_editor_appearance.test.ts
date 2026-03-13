import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apply_editor_appearance } from "$lib/shared/utils/apply_editor_appearance";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/shared/types/editor_settings";

const original_document = globalThis.document;

describe("apply_editor_appearance", () => {
  let properties: Map<string, string>;

  beforeEach(() => {
    properties = new Map<string, string>();
    globalThis.document = {
      documentElement: {
        style: {
          setProperty: (name: string, value: string) => {
            properties.set(name, value);
          },
          removeProperty: (name: string) => {
            properties.delete(name);
          },
        },
      },
    } as Document;
  });

  afterEach(() => {
    globalThis.document = original_document;
  });

  it("applies the expected appearance variables", () => {
    apply_editor_appearance({
      ...DEFAULT_EDITOR_SETTINGS,
      editor_selection_color: "#112233",
      editor_paragraph_spacing_density: "relaxed",
      editor_list_spacing_density: "compact",
      editor_code_block_padding: "relaxed",
      editor_code_block_radius: "soft",
      editor_blockquote_padding: "compact",
      editor_blockquote_border_width: 4,
      editor_link_underline_style: "wavy",
    });

    expect(properties.get("--editor-selection-bg")).toBe("#112233");
    expect(properties.get("--editor-paragraph-spacing")).toBe(
      "calc(var(--editor-spacing) * 1.2)",
    );
    expect(properties.get("--editor-list-item-spacing")).toBe(
      "calc(var(--editor-spacing) * 0.2)",
    );
    expect(properties.get("--editor-code-block-padding")).toBe(
      "calc(var(--editor-spacing) * 1.25)",
    );
    expect(properties.get("--editor-code-block-radius")).toBe(
      "calc(var(--radius) * 1)",
    );
    expect(properties.get("--editor-blockquote-padding-y")).toBe(
      "calc(var(--editor-spacing) * 0.6)",
    );
    expect(properties.get("--editor-blockquote-border-width")).toBe("4px");
    expect(properties.get("--editor-link-underline-style")).toBe("wavy");
  });

  it("clears stale properties when settings return to defaults", () => {
    apply_editor_appearance({
      ...DEFAULT_EDITOR_SETTINGS,
      editor_selection_color: "#112233",
      editor_link_underline_style: "dotted",
    });

    apply_editor_appearance({
      ...DEFAULT_EDITOR_SETTINGS,
    });

    expect(properties.has("--editor-selection-bg")).toBe(false);
    expect(properties.get("--editor-link-underline-style")).toBe("solid");
  });

  it("does not throw when document is undefined", () => {
    (globalThis as { document: Document | undefined }).document = undefined;

    expect(() => {
      apply_editor_appearance(DEFAULT_EDITOR_SETTINGS);
    }).not.toThrow();

    globalThis.document = original_document;
  });
});
