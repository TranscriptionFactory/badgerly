import { describe, expect, it } from "vitest";
import { build_tag_pill_css } from "$lib/shared/utils/tag_pill_styles";

const PROMOTED_PREFIX = ".ProseMirror .tag-pill:is(";

function promoted_selector(css: string): string {
  const start = css.indexOf(PROMOTED_PREFIX);
  if (start === -1) throw new Error("promoted rule missing");
  const end = css.indexOf(")", start);
  return css.slice(start + PROMOTED_PREFIX.length, end);
}

describe("build_tag_pill_css", () => {
  it("returns an empty string for empty inputs", () => {
    expect(build_tag_pill_css([], {})).toBe("");
  });

  it("lists exact and prefix selectors for each promoted tag, sorted", () => {
    const css = build_tag_pill_css(["zeta", "alpha"], {});

    expect(promoted_selector(css)).toBe(
      [
        '[data-tag="alpha" i]',
        '[data-tag^="alpha/" i]',
        '[data-tag="zeta" i]',
        '[data-tag^="zeta/" i]',
      ].join(", "),
    );
    expect(css).toContain("var(--tag-pill-color, var(--primary))");
  });

  it("emits a hover twin for the promoted rule", () => {
    const css = build_tag_pill_css(["rust"], {});
    const selector = `${PROMOTED_PREFIX}${promoted_selector(css)})`;

    expect(css).toContain(`${selector}:hover {`);
    expect(css.indexOf(selector)).toBeLessThan(css.indexOf(`${selector}:hover`));
  });

  it("emits the colour rules unchanged when no tag is promoted", () => {
    expect(build_tag_pill_css([], { zeta: "teal", alpha: "#ff0000" })).toBe(
      [
        '.tag-pill[data-tag="alpha" i] { --tag-pill-color: #ff0000; }',
        '.tag-pill[data-tag="zeta" i] { --tag-pill-color: teal; }',
      ].join("\n"),
    );
  });

  it("places the promoted rules before the colour rules", () => {
    const css = build_tag_pill_css(["rust"], { rust: "red" });

    expect(css.indexOf(PROMOTED_PREFIX)).toBeLessThan(
      css.indexOf('.tag-pill[data-tag="rust" i] { --tag-pill-color: red; }'),
    );
  });

  it("escapes quotes and backslashes in tag names", () => {
    const css = build_tag_pill_css(['a"b\\c'], { 'a"b\\c': "red" });

    expect(promoted_selector(css)).toBe(
      '[data-tag="a\\"b\\\\c" i], [data-tag^="a\\"b\\\\c/" i]',
    );
    expect(css).toContain(
      '.tag-pill[data-tag="a\\"b\\\\c" i] { --tag-pill-color: red; }',
    );
  });
});
