import { describe, it, expect } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import {
  generate_date_presets,
  extract_date_trigger,
} from "$lib/features/editor/adapters/date_suggest_plugin";

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

describe("generate_date_presets", () => {
  it("returns today, tomorrow, and yesterday", () => {
    const now = new Date(2024, 0, 15);
    const presets = generate_date_presets(now);
    expect(presets).toHaveLength(3);
    expect(presets[0]?.label).toBe("Today");
    expect(presets[1]?.label).toBe("Tomorrow");
    expect(presets[2]?.label).toBe("Yesterday");
  });

  it("formats today as YYYY-MM-DD", () => {
    const now = new Date(2024, 0, 15);
    const presets = generate_date_presets(now);
    expect(presets[0]?.date_str).toBe("2024-01-15");
  });

  it("formats tomorrow correctly", () => {
    const now = new Date(2024, 0, 15);
    const presets = generate_date_presets(now);
    expect(presets[1]?.date_str).toBe("2024-01-16");
  });

  it("formats yesterday correctly", () => {
    const now = new Date(2024, 0, 15);
    const presets = generate_date_presets(now);
    expect(presets[2]?.date_str).toBe("2024-01-14");
  });

  it("handles month boundary for tomorrow", () => {
    const now = new Date(2024, 0, 31);
    const presets = generate_date_presets(now);
    expect(presets[0]?.date_str).toBe("2024-01-31");
    expect(presets[1]?.date_str).toBe("2024-02-01");
    expect(presets[2]?.date_str).toBe("2024-01-30");
  });

  it("handles year boundary", () => {
    const now = new Date(2024, 11, 31);
    const presets = generate_date_presets(now);
    expect(presets[0]?.date_str).toBe("2024-12-31");
    expect(presets[1]?.date_str).toBe("2025-01-01");
    expect(presets[2]?.date_str).toBe("2024-12-30");
  });

  it("pads month and day with leading zeros", () => {
    const now = new Date(2024, 1, 5);
    const presets = generate_date_presets(now);
    expect(presets[0]?.date_str).toBe("2024-02-05");
  });

  it("each preset has a non-empty description", () => {
    const presets = generate_date_presets(new Date());
    for (const preset of presets) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

describe("extract_date_trigger", () => {
  it("returns null for empty paragraph", () => {
    expect(extract_date_trigger(make_state(""))).toBeNull();
  });

  it("returns null when no @ present", () => {
    expect(extract_date_trigger(make_state("hello world"))).toBeNull();
  });

  it("returns trigger for bare @", () => {
    const result = extract_date_trigger(make_state("@"));
    expect(result).not.toBeNull();
    expect(result?.query).toBe("");
  });

  it("returns trigger for @ at start of line", () => {
    const result = extract_date_trigger(make_state("@tod"));
    expect(result).not.toBeNull();
    expect(result?.query).toBe("tod");
  });

  it("returns trigger for @ preceded by whitespace", () => {
    const result = extract_date_trigger(make_state("hello @tod"));
    expect(result).not.toBeNull();
    expect(result?.query).toBe("tod");
  });

  it("returns null when @ is preceded by non-whitespace (email-like)", () => {
    expect(extract_date_trigger(make_state("user@example"))).toBeNull();
  });

  it("returns null when inside code block", () => {
    expect(extract_date_trigger(make_code_block_state("@today"))).toBeNull();
  });

  it("returns null when query contains a space after @", () => {
    expect(extract_date_trigger(make_state("@ today"))).toBeNull();
  });

  it("returns correct from position for @ at start", () => {
    const result = extract_date_trigger(make_state("@tod"));
    expect(result?.from).toBe(1);
  });

  it("returns correct from position for @ after text", () => {
    const result = extract_date_trigger(make_state("hello @tod"));
    expect(result?.from).toBe(1 + "hello ".length);
  });

  it("returns null for range selection", () => {
    const schema = create_schema();
    const para = schema.nodes["paragraph"].create(null, schema.text("@today"));
    const doc = schema.nodes["doc"].create(null, [para]);
    const state = EditorState.create({ doc });
    const with_range = state.apply(
      state.tr.setSelection(TextSelection.create(doc, 1, 4)),
    );
    expect(extract_date_trigger(with_range)).toBeNull();
  });
});

describe("filter logic (via generate_date_presets)", () => {
  const now = new Date(2024, 0, 15);

  function filter(query: string) {
    const q = query.toLowerCase();
    return generate_date_presets(now).filter((item) =>
      item.label.toLowerCase().includes(q),
    );
  }

  it("query 'tom' matches Tomorrow but not Today or Yesterday", () => {
    const results = filter("tom");
    expect(results.some((r) => r.label === "Tomorrow")).toBe(true);
    expect(results.some((r) => r.label === "Today")).toBe(false);
    expect(results.some((r) => r.label === "Yesterday")).toBe(false);
  });

  it("query 'tod' matches Today but not Tomorrow or Yesterday", () => {
    const results = filter("tod");
    expect(results.some((r) => r.label === "Today")).toBe(true);
    expect(results.some((r) => r.label === "Tomorrow")).toBe(false);
    expect(results.some((r) => r.label === "Yesterday")).toBe(false);
  });

  it("query 'yes' matches Yesterday but not Today or Tomorrow", () => {
    const results = filter("yes");
    expect(results.some((r) => r.label === "Yesterday")).toBe(true);
    expect(results.some((r) => r.label === "Today")).toBe(false);
    expect(results.some((r) => r.label === "Tomorrow")).toBe(false);
  });

  it("empty query matches all three presets", () => {
    expect(filter("")).toHaveLength(3);
  });

  it("query 'zzz' matches nothing", () => {
    expect(filter("zzz")).toHaveLength(0);
  });
});
