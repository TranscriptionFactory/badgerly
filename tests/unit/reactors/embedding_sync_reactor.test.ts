import { describe, expect, it, vi } from "vitest";
import { create_embedding_sync_reactor } from "$lib/reactors/embedding_sync.reactor.svelte";

describe("embedding_sync.reactor", () => {
  it("returns a cleanup function", () => {
    const unmount = create_embedding_sync_reactor(
      {
        index_progress: { status: "idle", indexed: 0, total: 0, error: null },
      } as never,
      { vault: null } as never,
      { embed_sync: vi.fn() } as never,
    );

    expect(typeof unmount).toBe("function");
    unmount();
  });
});
