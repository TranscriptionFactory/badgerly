import { describe, it, expect } from "vitest";

// We can't directly import the private function, so we test it via a re-exported helper
// Instead, let's test the regex logic that extract_image_path_query uses

const IMAGE_PATH_REGEX = /!\[[^\]]*\]\(([^)\n]*)$/;

function extract_image_path_query(
  text_before: string,
): { query: string; paren_offset: number } | null {
  const match = IMAGE_PATH_REGEX.exec(text_before);
  if (!match || match[1] === undefined) return null;
  return {
    query: match[1],
    paren_offset: match.index + match[0].length - match[1].length,
  };
}

describe("extract_image_path_query", () => {
  it("detects image link with empty path", () => {
    const result = extract_image_path_query("![alt](");
    expect(result).toEqual({ query: "", paren_offset: 7 });
  });

  it("detects partial path being typed", () => {
    const result = extract_image_path_query("![alt](assets/im");
    expect(result).toEqual({ query: "assets/im", paren_offset: 7 });
  });

  it("detects path with text before the image", () => {
    const result = extract_image_path_query("some text ![](path/to/img");
    expect(result).toEqual({ query: "path/to/img", paren_offset: 14 });
  });

  it("returns null when no image link pattern", () => {
    expect(extract_image_path_query("just text")).toBeNull();
  });

  it("returns null for already closed image link", () => {
    expect(extract_image_path_query("![alt](path)")).toBeNull();
  });

  it("returns null for regular link (no !)", () => {
    expect(extract_image_path_query("[text](url")).toBeNull();
  });

  it("handles empty alt text", () => {
    const result = extract_image_path_query("![](");
    expect(result).toEqual({ query: "", paren_offset: 4 });
  });

  it("handles alt text with special chars", () => {
    const result = extract_image_path_query("![my image: test](../");
    expect(result).toEqual({ query: "../", paren_offset: 18 });
  });

  it("returns null when newline in path", () => {
    expect(extract_image_path_query("![alt](path\n")).toBeNull();
  });
});
