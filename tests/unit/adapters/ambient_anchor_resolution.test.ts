/**
 * @vitest-environment jsdom
 */
import { create_ambient_section_anchor_resolver } from "$lib/features/editor/adapters/ambient_section_anchor";
import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import {
  create_wiki_link_converter_prose_plugin,
  wiki_link_plugin_key,
} from "$lib/features/editor/adapters/wiki_link_plugin";
import { parse_markdown } from "$lib/features/editor/adapters/markdown_pipeline";
import { schema } from "$lib/features/editor/adapters/schema";
import type { FindMatchRange } from "$lib/features/editor/domain/find_types";
import { resolve_ambient_anchor } from "$lib/features/editor/domain/ambient_anchor";

function make_doc(text: string) {
  return schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
}

function resolved(range: FindMatchRange | null): FindMatchRange {
  if (!range) throw new Error("expected the anchor to resolve");
  return range;
}

describe("resolve_ambient_anchor", () => {
  it("resolves a note-level anchor to no range", () => {
    expect(resolve_ambient_anchor(make_doc("anything"), { kind: "note" })).toBe(
      null,
    );
  });

  it("resolves a single occurrence to the range covering it", () => {
    const doc = make_doc("links to fusion-weights today");

    const range = resolved(
      resolve_ambient_anchor(doc, {
        kind: "text",
        match: "fusion-weights",
        occurrence: 0,
      }),
    );

    expect(doc.textBetween(range.from, range.to)).toBe("fusion-weights");
  });

  it("selects the nth occurrence, zero-based", () => {
    const doc = make_doc("x1 then x2 then x3");

    const range = resolved(
      resolve_ambient_anchor(doc, {
        kind: "text",
        match: "x",
        occurrence: 2,
      }),
    );

    expect(doc.textBetween(range.from, range.to + 1)).toBe("x3");
  });

  it("degrades to null when the occurrence index exceeds the matches found", () => {
    const doc = make_doc("x and x");

    expect(
      resolve_ambient_anchor(doc, { kind: "text", match: "x", occurrence: 2 }),
    ).toBeNull();
  });

  it("degrades to null when the anchor text is absent entirely", () => {
    expect(
      resolve_ambient_anchor(make_doc("nothing here"), {
        kind: "text",
        match: "fusion-weights",
        occurrence: 0,
      }),
    ).toBeNull();
  });

  it("degrades to null for an empty match instead of matching everywhere", () => {
    expect(
      resolve_ambient_anchor(make_doc("some prose"), {
        kind: "text",
        match: "",
        occurrence: 0,
      }),
    ).toBeNull();
  });

  it("does not resolve across a mark boundary rather than reporting a partial range", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text("fusion-"),
        schema.text("weights", [schema.marks.strong.create()]),
      ]),
    ]);

    expect(
      resolve_ambient_anchor(doc, {
        kind: "text",
        match: "fusion-weights",
        occurrence: 0,
      }),
    ).toBeNull();
  });

  it("is case sensitive, so a differently cased phrase is not underlined", () => {
    expect(
      resolve_ambient_anchor(make_doc("Fusion-Weights"), {
        kind: "text",
        match: "fusion-weights",
        occurrence: 0,
      }),
    ).toBeNull();
  });

  it("never throws for any degenerate anchor", () => {
    const doc = make_doc("prose");

    expect(() =>
      resolve_ambient_anchor(doc, {
        kind: "text",
        match: "absent",
        occurrence: 99,
      }),
    ).not.toThrow();
  });
});

describe("indexed section anchors", () => {
  it.each<[string, number, number, string, number]>([
    ["Results in prose.\n\n## **Results**\nBody", 2, 3, "Results", 0],
    ["## Results\nFirst\n\n## **Results**\nSecond", 3, 4, "Results", 1],
    [
      "Before\n\n## Mixed **formatting** here\nBody",
      2,
      3,
      "Mixed formatting here",
      0,
    ],
    [
      "---\ntitle: A\n---\n\nPreamble **text**.\n\n## Later\nBody",
      3,
      5,
      "Preamble text.",
      0,
    ],
    ["Setext\n======\n\n## Results\nBody", 3, 4, "Results", 0],
  ])(
    "resolves the indexed source section in %s",
    (markdown, start, end, text, occurrence) => {
      const anchor = create_ambient_section_anchor(markdown, start, end);
      expect(anchor).toMatchObject({ kind: "block", match: text, occurrence });
      const doc = parse_markdown(markdown);
      const range = resolved(
        resolve_ambient_anchor(doc, anchor ?? { kind: "note" }),
      );
      expect(doc.textBetween(range.from, range.to)).toBe(text);
      const expected: number[] = [];
      doc.descendants((node, pos) => {
        if (node.isTextblock && node.textContent === text)
          expected.push(pos + 1);
      });
      expect(range.from).toBe(expected[occurrence]);
    },
  );

  it.each<[string, number, number]>([
    ["## **Results** in [[notes/B#Details|the details]]\nBody", 0, 1],
    [
      "See [[notes/A|earlier link]].\n\n## **Results** in [[notes/B#Details|the details]]\nBody",
      2,
      3,
    ],
  ])(
    "uses runtime wiki conversion and mapped source positions for %s",
    (markdown, start_line, end_line) => {
      const anchor = create_ambient_section_anchor(
        markdown,
        start_line,
        end_line,
      );
      const state = EditorState.create({
        doc: parse_markdown(markdown),
        plugins: [
          create_wiki_link_converter_prose_plugin({
            link_type: schema.marks.link,
          }),
        ],
      });
      const rendered = state.applyTransaction(
        state.tr.setMeta(wiki_link_plugin_key, { action: "full_scan" }),
      ).state.doc;
      const range = resolve_ambient_anchor(
        rendered,
        anchor ?? { kind: "note" },
      );
      expect(range).not.toBeNull();
      let heading_text = "";
      rendered.descendants((node) => {
        if (node.type.name === "heading") heading_text = node.textContent;
      });
      expect(range?.text).toBe(heading_text);
      expect(range?.text).not.toContain("[[");
    },
  );

  it("does not relocate a removed section onto ordinary prose", () => {
    const anchor = create_ambient_section_anchor("## Results\nBody", 0, 1);
    expect(anchor).not.toBeNull();
    expect(
      resolve_ambient_anchor(
        parse_markdown("Results in prose."),
        anchor ?? { kind: "note" },
      ),
    ).toBeNull();
  });
});

function create_ambient_section_anchor(
  markdown: string,
  start_line: number,
  end_line: number,
) {
  return create_ambient_section_anchor_resolver(markdown)(start_line, end_line);
}
