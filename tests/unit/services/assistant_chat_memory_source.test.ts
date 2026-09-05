import { describe, expect, it, vi } from "vitest";
import { create_chat_seam } from "../helpers/assistant_chat_seam";
import { create_test_run_starter } from "../../adapters/test_run_starter";
import type { RunEvent } from "$lib/features/assistant";
import type { AiProviderConfig } from "$lib/shared/types/ai_provider_config";
import type { HybridSearchHit } from "$lib/shared/types/search";
import type {
  AssistantChatSourceInfo,
  AssistantChatStreamEvent,
  MemoryIndexPort,
} from "$lib/features/assistant";

const provider: AiProviderConfig = {
  id: "ollama",
  name: "Ollama",
  transport: { kind: "cli", command: "ollama", args: ["run", "{model}"] },
  model: "qwen3:8b",
};

const TWIN_PATH = "notes/twin.md";
const MEMORY_PATH = "Memory/region.md";
const TWIN_TEXT = "Untagged twin: we deploy to eu-west every night.";
const MEMORY_TEXT = "Saved memory: we deploy to eu-west every night.";

function hit(
  path: string,
  title: string,
  id: string,
  score: number,
): HybridSearchHit {
  const note = {
    id,
    path,
    name: title.toLowerCase(),
    title,
    blurb: "",
    mtime_ms: 0,
    ctime_ms: 0,
    size_bytes: 100,
    file_type: "md",
  };
  return { note: note as never, score, source: "both" };
}

function text_stream(text: string) {
  return create_test_run_starter(() => [
    { type: "text", text } as RunEvent,
    { type: "done" } as RunEvent,
  ]);
}

function memory_index(paths: string[]): MemoryIndexPort {
  return { list_memory_paths: () => Promise.resolve(paths) };
}

function notes_port(markdown_by_id: Record<string, string>) {
  return {
    read_note: vi.fn((_vault: string, id: string) =>
      Promise.resolve({ markdown: markdown_by_id[id] ?? "" }),
    ),
  };
}

function search_port(hits: HybridSearchHit[]) {
  return {
    hybrid_search: vi.fn().mockResolvedValue(hits),
    search_blocks: vi.fn().mockResolvedValue([]),
  };
}

async function run(
  gen: AsyncGenerator<AssistantChatStreamEvent>,
): Promise<{ sources: AssistantChatSourceInfo[]; error: string | null }> {
  let sources: AssistantChatSourceInfo[] = [];
  let error: string | null = null;
  for await (const event of gen) {
    if (event.type === "sources") sources = event.sources;
    else if (event.type === "error") error = event.error;
  }
  return { sources, error };
}

function user_prompt(stream: ReturnType<typeof text_stream>): string {
  const request = stream.specs[0]?.request;
  if (request?.mode !== "text") throw new Error("expected a text run");
  const content = request.messages[0]?.content;
  if (typeof content !== "string") throw new Error("expected text");
  return content;
}

describe("AssistantChatService memory source", () => {
  const twin_first = [
    hit(TWIN_PATH, "Twin", "1", 0.9),
    hit(MEMORY_PATH, "Region", "2", 0.8),
  ];
  const bodies = { "1": TWIN_TEXT, "2": MEMORY_TEXT };

  it("assembles a memory-tagged note that matches the prompt even when the RAG budget only has room for its untagged twin", async () => {
    const stream = text_stream("eu-west [1][2].");
    const service = create_chat_seam({
      search: search_port(twin_first),
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: memory_index([MEMORY_PATH]),
    }).chat;

    const { sources, error } = await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
        retrieve_limit: 1,
      }),
    );

    expect(error).toBeNull();
    const prompt = user_prompt(stream);
    expect(prompt).toContain(TWIN_TEXT);
    expect(prompt).toContain(MEMORY_TEXT);
    expect(sources.map((s) => s.note_path).sort()).toEqual(
      [MEMORY_PATH, TWIN_PATH].sort(),
    );
  });

  it("does not treat the untagged twin as a memory when nothing is tagged memory: true", async () => {
    const stream = text_stream("eu-west [1].");
    const service = create_chat_seam({
      search: search_port(twin_first),
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: memory_index([]),
    }).chat;

    const { sources } = await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
        retrieve_limit: 1,
      }),
    );

    const prompt = user_prompt(stream);
    expect(prompt).toContain(TWIN_TEXT);
    expect(prompt).not.toContain(MEMORY_TEXT);
    expect(sources.map((s) => s.note_path)).toEqual([TWIN_PATH]);
  });

  it("offers a memory note once when RAG retrieved it as well", async () => {
    const stream = text_stream("eu-west [1].");
    const search = search_port([hit(MEMORY_PATH, "Region", "2", 0.9)]);
    const service = create_chat_seam({
      search,
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: memory_index([MEMORY_PATH]),
    }).chat;

    const { sources } = await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
      }),
    );

    expect(search.hybrid_search).toHaveBeenCalledTimes(2);
    expect(user_prompt(stream).split(MEMORY_TEXT)).toHaveLength(2);
    expect(sources.map((s) => s.note_path)).toEqual([MEMORY_PATH]);
  });

  it("skips the memory retrieval entirely when no note carries memory: true", async () => {
    const stream = text_stream("eu-west [1].");
    const search = search_port(twin_first);
    const service = create_chat_seam({
      search,
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: memory_index([]),
    }).chat;

    await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
      }),
    );

    expect(search.hybrid_search).toHaveBeenCalledTimes(1);
  });

  it("answers without memories when memory retrieval rejects", async () => {
    const stream = text_stream("eu-west [1].");
    const seam = create_chat_seam({
      search: search_port(twin_first),
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: memory_index([MEMORY_PATH]),
    });
    const retrieve = seam.retrieval.retrieve.bind(seam.retrieval);
    const calls = vi
      .spyOn(seam.retrieval, "retrieve")
      .mockImplementation((request) =>
        request.scope
          ? Promise.reject(new Error("memory retrieval unavailable"))
          : retrieve(request),
      );

    const { error } = await run(
      seam.chat.query({
        question: "where do we deploy?",
        provider_config: provider,
      }),
    );
    expect(error).toBeNull();
    expect(user_prompt(stream)).toContain(TWIN_TEXT);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("answers without memories when the memory lookup fails", async () => {
    const stream = text_stream("eu-west [1].");
    const service = create_chat_seam({
      search: search_port(twin_first),
      notes: notes_port(bodies),
      run_starter: stream as never,
      memory_index: {
        list_memory_paths: () => Promise.reject(new Error("index locked")),
      },
    }).chat;

    const { sources, error } = await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
        retrieve_limit: 1,
      }),
    );

    expect(error).toBeNull();
    expect(sources.map((s) => s.note_path)).toEqual([TWIN_PATH]);
    expect(user_prompt(stream)).toContain(TWIN_TEXT);
  });

  it("caps the memory source at its own limit", async () => {
    const memory_paths = Array.from(
      { length: 7 },
      (_, i) => `Memory/m${String(i)}.md`,
    );
    const hits = [
      hit(TWIN_PATH, "Twin", "1", 0.99),
      ...memory_paths.map((path, i) =>
        hit(path, `M${String(i)}`, `m${String(i)}`, 0.9 - i * 0.01),
      ),
    ];
    const markdown = Object.fromEntries<string>([
      ["1", TWIN_TEXT],
      ...memory_paths.map((_, i): [string, string] => [
        `m${String(i)}`,
        `Memory ${String(i)}: deploy detail.`,
      ]),
    ]);
    const stream = text_stream("eu-west [1].");
    const service = create_chat_seam({
      search: search_port(hits),
      notes: notes_port(markdown),
      run_starter: stream as never,
      memory_index: memory_index(memory_paths),
    }).chat;

    const { sources } = await run(
      service.query({
        question: "where do we deploy?",
        provider_config: provider,
        retrieve_limit: 1,
      }),
    );

    const memory_sources = sources.filter((s) => s.note_path !== TWIN_PATH);
    expect(memory_sources).toHaveLength(5);
    expect(sources.map((s) => s.note_path)).toContain(TWIN_PATH);
  });
});
