import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse_markdown } from "$lib/features/editor/adapters/markdown_pipeline";
import { find_inline_tag_ranges } from "$lib/features/editor/domain/tag_ranges";

const HERE = dirname(fileURLToPath(import.meta.url));

type FixtureCase = {
  name: string;
  markdown: string;
  expected_tags: string[];
  rust_only?: boolean;
};

type Fixture = { cases: FixtureCase[] };

function load_fixture(): Fixture {
  const path = resolve(HERE, "../../fixtures/tag_grammar_cases.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

const fixture = load_fixture();
const shared_cases = fixture.cases.filter((c) => !c.rust_only);

describe("tag grammar shared fixture", () => {
  it("is well-formed with unique names", () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(20);
    const names = new Set(fixture.cases.map((c) => c.name));
    expect(names.size).toBe(fixture.cases.length);
    expect(shared_cases.length).toBeGreaterThan(0);
  });

  it.each(shared_cases.map((c) => [c.name, c] as const))(
    "%s",
    (_name, c) => {
      const doc = parse_markdown(c.markdown);
      const tags = find_inline_tag_ranges(doc).map((r) => r.tag);
      expect(tags).toEqual(c.expected_tags);
    },
  );
});
