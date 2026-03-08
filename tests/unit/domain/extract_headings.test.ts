import { describe, expect, it } from "vitest";
import { extract_headings_from_markdown } from "$lib/features/editor/domain/extract_headings";

describe("extract_headings_from_markdown", () => {
  it("returns empty array for empty string", () => {
    expect(extract_headings_from_markdown("")).toEqual([]);
  });

  it("extracts a single heading", () => {
    const result = extract_headings_from_markdown("# Hello");
    expect(result).toEqual([{ id: "h-0", level: 1, text: "Hello", pos: 0 }]);
  });

  it("extracts headings of all levels", () => {
    const md = [
      "# H1",
      "## H2",
      "### H3",
      "#### H4",
      "##### H5",
      "###### H6",
    ].join("\n");
    const result = extract_headings_from_markdown(md);
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ id: "h-0", level: 1, text: "H1", pos: 0 });
    expect(result[5]).toEqual({ id: "h-5", level: 6, text: "H6", pos: 5 });
  });

  it("strips trailing hashes", () => {
    const result = extract_headings_from_markdown("## Title ##");
    expect(result[0]?.text).toBe("Title");
  });

  it("skips non-heading lines", () => {
    const md = "Some text\n# Real Heading\nMore text\n##Not a heading";
    const result = extract_headings_from_markdown(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "h-1",
      level: 1,
      text: "Real Heading",
      pos: 1,
    });
  });

  it("handles headings with inline formatting", () => {
    const result = extract_headings_from_markdown("## **Bold** and *italic*");
    expect(result[0]?.text).toBe("**Bold** and *italic*");
  });
});
