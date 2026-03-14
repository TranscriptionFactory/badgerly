import { describe, it, expect } from "vitest";
import { GraphStore } from "$lib/features/graph/state/graph_store.svelte";
import type { VaultGraphSnapshot } from "$lib/features/graph/ports";

describe("GraphStore vault mode", () => {
  const mock_vault_snapshot: VaultGraphSnapshot = {
    nodes: [
      { path: "a.md", title: "A" },
      { path: "b.md", title: "B" },
    ],
    edges: [{ source: "a.md", target: "b.md" }],
    stats: { node_count: 2, edge_count: 1 },
  };

  it("defaults to neighborhood view mode", () => {
    const store = new GraphStore();
    expect(store.view_mode).toBe("neighborhood");
  });

  it("sets view mode", () => {
    const store = new GraphStore();
    store.set_view_mode("vault");
    expect(store.view_mode).toBe("vault");
  });

  it("start_loading_vault sets loading state and clears vault snapshot", () => {
    const store = new GraphStore();
    store.set_vault_snapshot(mock_vault_snapshot);
    store.start_loading_vault();

    expect(store.status).toBe("loading");
    expect(store.vault_snapshot).toBeNull();
    expect(store.error).toBeNull();
  });

  it("set_vault_snapshot stores data and transitions to ready", () => {
    const store = new GraphStore();
    store.start_loading_vault();
    store.set_vault_snapshot(mock_vault_snapshot);

    expect(store.vault_snapshot).toBe(mock_vault_snapshot);
    expect(store.status).toBe("ready");
    expect(store.error).toBeNull();
  });

  it("clear resets vault state", () => {
    const store = new GraphStore();
    store.set_view_mode("vault");
    store.set_vault_snapshot(mock_vault_snapshot);
    store.clear();

    expect(store.view_mode).toBe("neighborhood");
    expect(store.vault_snapshot).toBeNull();
    expect(store.panel_open).toBe(false);
  });
});
