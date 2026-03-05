import { describe, it, expect, vi } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import {
  extract_slash_query_from_state,
  filter_commands,
  create_commands,
} from "$lib/features/editor/adapters/slash_command_plugin";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";

function create_schema() {
  return new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: {
        group: "block",
        content: "inline*",
        toDOM: () => ["p", 0] as const,
        parseDOM: [{ tag: "p" }],
      },
      heading: {
        attrs: { level: { default: 1 } },
        group: "block",
        content: "inline*",
        toDOM: (node) =>
          [`h${String(node.attrs["level"])}`, 0] as [
            "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
            0,
          ],
        parseDOM: [1, 2, 3, 4, 5, 6].map((i) => ({
          tag: `h${String(i)}`,
          attrs: { level: i },
        })),
      },
      code_block: {
        group: "block",
        content: "text*",
        code: true,
        toDOM: () => ["pre", ["code", 0]] as const,
        parseDOM: [{ tag: "pre" }],
      },
      text: { group: "inline" },
    },
  });
}

function make_state(text: string, cursor_offset?: number): EditorState {
  const schema = create_schema();
  const para = schema.nodes["paragraph"].create(
    null,
    text.length > 0 ? schema.text(text) : [],
  );
  const doc = schema.nodes["doc"].create(null, [para]);
  const state = EditorState.create({ doc });
  const pos = cursor_offset ?? 1 + text.length;
  return state.apply(state.tr.setSelection(TextSelection.create(doc, pos)));
}

function make_code_block_state(text: string): EditorState {
  const schema = create_schema();
  const block = schema.nodes["code_block"].create(
    null,
    text.length > 0 ? schema.text(text) : [],
  );
  const doc = schema.nodes["doc"].create(null, [block]);
  const state = EditorState.create({ doc });
  const pos = 1 + text.length;
  return state.apply(state.tr.setSelection(TextSelection.create(doc, pos)));
}

describe("extract_slash_query_from_state", () => {
  it("returns null for empty paragraph with no slash", () => {
    expect(extract_slash_query_from_state(make_state(""))).toBeNull();
  });

  it("returns null when paragraph text does not start with /", () => {
    expect(extract_slash_query_from_state(make_state("hello"))).toBeNull();
    expect(
      extract_slash_query_from_state(make_state("hello /world")),
    ).toBeNull();
  });

  it("returns empty query for bare /", () => {
    const result = extract_slash_query_from_state(make_state("/"));
    expect(result).not.toBeNull();
    expect(result?.query).toBe("");
  });

  it("extracts query from /heading", () => {
    const result = extract_slash_query_from_state(make_state("/heading"));
    expect(result).not.toBeNull();
    expect(result?.query).toBe("heading");
  });

  it("returns the correct from position (start of paragraph text)", () => {
    const state = make_state("/h1");
    const result = extract_slash_query_from_state(state);
    expect(result).not.toBeNull();
    expect(result?.from).toBe(1);
  });

  it("returns null when inside a code block", () => {
    expect(
      extract_slash_query_from_state(make_code_block_state("/code")),
    ).toBeNull();
  });

  it("returns null when selection is not empty (range selection)", () => {
    const schema = create_schema();
    const para = schema.nodes["paragraph"].create(null, schema.text("/h1"));
    const doc = schema.nodes["doc"].create(null, [para]);
    const state = EditorState.create({ doc });
    const with_range = state.apply(
      state.tr.setSelection(TextSelection.create(doc, 1, 4)),
    );
    expect(extract_slash_query_from_state(with_range)).toBeNull();
  });

  it("updates query as text grows: /h → /h1", () => {
    expect(extract_slash_query_from_state(make_state("/h"))?.query).toBe("h");
    expect(extract_slash_query_from_state(make_state("/h1"))?.query).toBe("h1");
  });

  it("returns null when cursor is before /", () => {
    const state = make_state("/h1", 1);
    const result = extract_slash_query_from_state(state);
    expect(result).toBeNull();
  });
});

describe("filter_commands", () => {
  const noop_parser = () => ({}) as ProsemirrorNode;
  const all = create_commands(noop_parser);

  it("returns all commands for empty query", () => {
    expect(filter_commands(all, "")).toHaveLength(all.length);
  });

  it("returns only heading commands for 'heading'", () => {
    const results = filter_commands(all, "heading");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.keywords.includes("heading"))).toBe(true);
  });

  it("finds code block by 'code'", () => {
    const results = filter_commands(all, "code");
    expect(results.some((c) => c.id === "code")).toBe(true);
  });

  it("finds h1 by id prefix 'h1'", () => {
    const results = filter_commands(all, "h1");
    expect(results.some((c) => c.id === "h1")).toBe(true);
  });

  it("finds table by 'tab'", () => {
    const results = filter_commands(all, "tab");
    expect(results.some((c) => c.id === "table")).toBe(true);
  });

  it("finds divider by 'hr'", () => {
    const results = filter_commands(all, "hr");
    expect(results.some((c) => c.id === "divider")).toBe(true);
  });

  it("finds blockquote by 'quote'", () => {
    const results = filter_commands(all, "quote");
    expect(results.some((c) => c.id === "blockquote")).toBe(true);
  });

  it("returns empty for unmatched query", () => {
    expect(filter_commands(all, "zzznomatch")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    expect(filter_commands(all, "CODE")).toHaveLength(
      filter_commands(all, "code").length,
    );
    expect(filter_commands(all, "Heading")).toHaveLength(
      filter_commands(all, "heading").length,
    );
  });
});

describe("create_commands", () => {
  it("contains all expected command ids", () => {
    const noop_parser = () => ({}) as ProsemirrorNode;
    const commands = create_commands(noop_parser);
    const ids = commands.map((c) => c.id);

    expect(ids).toContain("h1");
    expect(ids).toContain("h2");
    expect(ids).toContain("h3");
    expect(ids).toContain("h4");
    expect(ids).toContain("h5");
    expect(ids).toContain("h6");
    expect(ids).toContain("code");
    expect(ids).toContain("table");
    expect(ids).toContain("bullet");
    expect(ids).toContain("ordered");
    expect(ids).toContain("blockquote");
    expect(ids).toContain("divider");
  });

  it("each command has a non-empty label and icon", () => {
    const noop_parser = () => ({}) as ProsemirrorNode;
    const commands = create_commands(noop_parser);

    for (const cmd of commands) {
      expect(cmd.label.length).toBeGreaterThan(0);
      expect(cmd.icon.length).toBeGreaterThan(0);
    }
  });

  it("heading commands have a level keyword matching their id", () => {
    const noop_parser = () => ({}) as ProsemirrorNode;
    const commands = create_commands(noop_parser);
    const headings = commands.filter(
      (c) => c.id.startsWith("h") && c.id.length === 2,
    );

    for (const h of headings) {
      expect(h.keywords).toContain(h.id);
    }
  });

  it("heading insert calls setBlockType via dispatch", () => {
    const schema = create_schema();
    const para = schema.nodes["paragraph"].create(null, schema.text("/h1"));
    const doc = schema.nodes["doc"].create(null, [para]);
    const initial_state = EditorState.create({ doc });
    const state_with_cursor = initial_state.apply(
      initial_state.tr.setSelection(TextSelection.create(doc, 4)),
    );

    const dispatched: unknown[] = [];
    const mock_view = {
      state: state_with_cursor,
      dispatch: (tr: unknown) => dispatched.push(tr),
      focus: vi.fn(),
    } as unknown as import("@milkdown/kit/prose/view").EditorView;

    const noop_parser = () => ({}) as ProsemirrorNode;
    const commands = create_commands(noop_parser);
    const h1 = commands.find((c) => c.id === "h1");
    if (!h1) throw new Error("h1 command not found");

    h1.insert(mock_view, 1);
    expect(dispatched).toHaveLength(1);
  });
});
