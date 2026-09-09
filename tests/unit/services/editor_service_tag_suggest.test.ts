import { describe, expect, it, vi } from "vitest";
import type {
  EditorPort,
  EditorSession,
  EditorSessionConfig,
} from "$lib/features/editor/ports";
import {
  EditorService,
  type EditorServiceCallbacks,
} from "$lib/features/editor/application/editor_service";
import { EditorStore } from "$lib/features/editor/state/editor_store.svelte";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import type { OpenNoteState } from "$lib/shared/types/editor";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";
import type { TagPort } from "$lib/features/tags";
import type { TagInfo } from "$lib/features/tags/types";
import { create_test_vault } from "../helpers/test_fixtures";

function create_open_note(note_path: string, markdown: string): OpenNoteState {
  const path = as_note_path(note_path);
  return {
    meta: {
      id: path,
      path,
      name: note_path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "",
      title: note_path.replace(/\.md$/i, ""),
      blurb: "",
      mtime_ms: 0,
      ctime_ms: 0,
      size_bytes: markdown.length,
      file_type: null,
    },
    markdown: as_markdown_text(markdown),
    buffer_id: path,
    is_dirty: false,
  };
}

type TagSuggestion = { tag: string; count: number; promoted: boolean };

function create_session_with_tag_suggest(): EditorSession & {
  captured_tag_suggestions: TagSuggestion[][];
  captured_at_palette_tags: Array<{
    category: string;
    tag: string;
    count: number;
  }>[];
} {
  const captured_tag_suggestions: TagSuggestion[][] = [];
  const captured_at_palette_tags: Array<{
    category: string;
    tag: string;
    count: number;
  }>[] = [];
  return {
    destroy: vi.fn(),
    set_markdown: vi.fn(),
    get_markdown: vi.fn(() => ""),
    insert_text_at_cursor: vi.fn(),
    mark_clean: vi.fn(),
    is_dirty: vi.fn(() => false),
    focus: vi.fn(),
    open_buffer: vi.fn(),
    rename_buffer: vi.fn(),
    close_buffer: vi.fn(),
    set_tag_suggestions: (items) => {
      captured_tag_suggestions.push(items);
    },
    set_at_palette_suggestions: (category, items) => {
      if (category === "tags") {
        captured_at_palette_tags.push(
          items as Array<{ category: string; tag: string; count: number }>,
        );
      }
    },
    captured_tag_suggestions,
    captured_at_palette_tags,
  };
}

function create_setup(
  session: ReturnType<typeof create_session_with_tag_suggest>,
  tags: TagInfo[],
) {
  const editor_store = new EditorStore();
  const vault_store = new VaultStore();
  const op_store = new OpStore();
  vault_store.set_vault(create_test_vault());

  let session_config: EditorSessionConfig | undefined;
  const editor_port: EditorPort = {
    start_session: vi.fn((config: EditorSessionConfig) => {
      session_config = config;
      return Promise.resolve(session);
    }),
  };

  const tag_port: TagPort = {
    list_all_tags: vi.fn(() => Promise.resolve(tags)),
    get_notes_for_tag: vi.fn(() => Promise.resolve([])),
    get_notes_for_tag_prefix: vi.fn(() => Promise.resolve([])),
  };

  const on_tag_accepted = vi.fn();
  const callbacks: EditorServiceCallbacks = {
    on_internal_link_click: vi.fn(),
    on_external_link_click: vi.fn(),
    on_image_paste_requested: vi.fn(),
    on_file_drop_requested: vi.fn(),
    on_tag_accepted,
  };

  const service = new EditorService(
    editor_port,
    vault_store,
    editor_store,
    op_store,
    callbacks,
    undefined,
    undefined,
    undefined,
    tag_port,
  );

  return { service, get_config: () => session_config, on_tag_accepted };
}

function require_config(
  config: EditorSessionConfig | undefined,
): EditorSessionConfig {
  if (!config) throw new Error("session_config not set — mount() not called");
  return config;
}

function require_first<T>(arr: T[]): T {
  const item = arr[0];
  if (item === undefined)
    throw new Error("Expected at least one captured item");
  return item;
}

const SAMPLE_TAGS: TagInfo[] = [
  { tag: "parent/child", count: 3, promoted: true },
  { tag: "parent", count: 5, promoted: true },
  { tag: "unrelated", count: 1, promoted: true },
  { tag: "other/child", count: 2, promoted: true },
];

const MIXED_TAGS: TagInfo[] = [
  { tag: "child/a", count: 9, promoted: false },
  { tag: "child/b", count: 1, promoted: true },
  { tag: "child/c", count: 4, promoted: false },
  { tag: "child", count: 2, promoted: true },
];

describe("handle_tag_suggest_query — fuzzy/hierarchical ranking", () => {
  it("returns parent/child ranked above unrelated when querying 'child'", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, SAMPLE_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_query?.("child");
    await vi.waitUntil(() => session.captured_tag_suggestions.length > 0);

    const results = require_first(session.captured_tag_suggestions);
    const tags = results.map((r) => r.tag);
    expect(tags).toContain("parent/child");
    expect(tags).toContain("other/child");
    const child_idx = tags.indexOf("parent/child");
    const unrelated_idx = tags.indexOf("unrelated");
    expect(child_idx).toBeLessThan(
      unrelated_idx === -1 ? Infinity : unrelated_idx,
    );
  });

  it("returns parent/child when querying its leaf segment 'child'", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, SAMPLE_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_query?.("child");
    await vi.waitUntil(() => session.captured_tag_suggestions.length > 0);

    const tags = require_first(session.captured_tag_suggestions).map(
      (r) => r.tag,
    );
    expect(tags).toContain("parent/child");
  });

  it("fuzzy-matches 'prnt' against 'parent'", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, SAMPLE_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_query?.("prnt");
    await vi.waitUntil(() => session.captured_tag_suggestions.length > 0);

    const tags = require_first(session.captured_tag_suggestions).map(
      (r) => r.tag,
    );
    expect(tags).toContain("parent");
  });

  it("preserves tag count from original TagInfo", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, SAMPLE_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_query?.("parent");
    await vi.waitUntil(() => session.captured_tag_suggestions.length > 0);

    const results = require_first(session.captured_tag_suggestions);
    const parent_entry = results.find((r) => r.tag === "parent");
    expect(parent_entry?.count).toBe(5);
  });

  it("ranks promoted tags before candidates and flags candidates", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, MIXED_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_query?.("child");
    await vi.waitUntil(() => session.captured_tag_suggestions.length > 0);

    const results = require_first(session.captured_tag_suggestions);
    expect(results.map((r) => r.promoted)).toEqual([true, true, false, false]);
    expect(results.slice(0, 2).map((r) => r.tag).sort()).toEqual([
      "child",
      "child/b",
    ]);
    expect(results.slice(2).map((r) => r.tag).sort()).toEqual([
      "child/a",
      "child/c",
    ]);
  });

  it("accepting a suggestion calls on_tag_accepted", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config, on_tag_accepted } = create_setup(
      session,
      SAMPLE_TAGS,
    );
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_tag_suggest_accept?.("parent/child");

    expect(on_tag_accepted).toHaveBeenCalledWith("parent/child");
  });
});

describe("handle_at_palette_tag_query — fuzzy/hierarchical ranking", () => {
  it("returns parent/child when querying leaf 'child'", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, SAMPLE_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_at_palette_tag_query?.("child");
    await vi.waitUntil(() => session.captured_at_palette_tags.length > 0);

    const tags = require_first(session.captured_at_palette_tags).map(
      (r) => r.tag,
    );
    expect(tags).toContain("parent/child");
    expect(tags).not.toContain("unrelated");
  });

  it("lists promoted tags only", async () => {
    const session = create_session_with_tag_suggest();
    const { service, get_config } = create_setup(session, MIXED_TAGS);
    const note = create_open_note("test.md", "# Test");
    await service.mount({ root: {} as HTMLDivElement, note });

    const config = require_config(get_config());
    config.events.on_at_palette_tag_query?.("child");
    await vi.waitUntil(() => session.captured_at_palette_tags.length > 0);

    const tags = require_first(session.captured_at_palette_tags)
      .map((r) => r.tag)
      .sort();
    expect(tags).toEqual(["child", "child/b"]);
  });
});
