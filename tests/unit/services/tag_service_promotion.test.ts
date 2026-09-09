import { describe, it, expect, vi } from "vitest";
import { TagService } from "$lib/features/tags/application/tag_service";
import { TagStore } from "$lib/features/tags/state/tag_store.svelte";
import type { TagPort } from "$lib/features/tags/ports";
import type { TagInfo } from "$lib/features/tags/types";
import type { VaultSettingsPort } from "$lib/features/vault";

function make_vault_store(vault_id: string | null = "vault-1") {
  return {
    vault: vault_id ? { id: vault_id, name: "Test", path: "/test" } : null,
  } as never;
}

function make_service(
  tags: TagInfo[] = [],
  settings_overrides: Partial<VaultSettingsPort> = {},
  vault_id: string | null = "vault-1",
) {
  const calls: string[] = [];
  let persisted: unknown = null;
  const store = new TagStore();
  const port: TagPort = {
    list_all_tags: vi.fn(() => {
      calls.push("list_all_tags");
      return Promise.resolve(tags);
    }),
    get_notes_for_tag: vi.fn().mockResolvedValue([]),
    get_notes_for_tag_prefix: vi.fn().mockResolvedValue([]),
  };
  const settings_port: VaultSettingsPort = {
    get_vault_setting: vi.fn().mockImplementation((_vault_id, key) => {
      calls.push(`get:${String(key)}`);
      return Promise.resolve(persisted);
    }),
    set_vault_setting: vi.fn().mockImplementation((_vault_id, key, value) => {
      calls.push(`set:${String(key)}`);
      persisted = value;
      return Promise.resolve();
    }),
    get_local_setting: vi.fn().mockResolvedValue(null),
    set_local_setting: vi.fn().mockResolvedValue(undefined),
    ...settings_overrides,
  };
  const service = new TagService(
    port,
    store,
    make_vault_store(vault_id),
    settings_port,
  );
  return { service, store, port, settings_port, calls };
}

describe("TagService promotion", () => {
  it("refresh_tags loads the promoted setting before listing tags", async () => {
    const { service, store, settings_port, calls } = make_service([], {
      get_vault_setting: vi.fn().mockImplementation((_vault_id, key) => {
        calls.push(`get:${String(key)}`);
        return Promise.resolve(["#Rust", "rust", 42, "bad tag"]);
      }),
    });

    await service.refresh_tags();

    expect(settings_port.get_vault_setting).toHaveBeenCalledWith(
      "vault-1",
      "promoted_tags",
    );
    expect(calls).toEqual(["get:promoted_tags", "list_all_tags"]);
    expect(store.promoted_setting).toEqual(["Rust"]);
  });

  it("load_promoted_setting without a vault does not touch the port", async () => {
    const { service, settings_port } = make_service([], {}, null);

    await service.load_promoted_setting();

    expect(settings_port.get_vault_setting).not.toHaveBeenCalled();
  });

  it("promote writes the union to the setting and then refreshes", async () => {
    const { service, store, settings_port, calls } = make_service();
    store.set_promoted_setting(["rust"]);

    await service.promote("svelte");

    expect(store.promoted_setting).toEqual(["rust", "svelte"]);
    expect(settings_port.set_vault_setting).toHaveBeenCalledWith(
      "vault-1",
      "promoted_tags",
      ["rust", "svelte"],
    );
    expect(calls.indexOf("set:promoted_tags")).toBeLessThan(
      calls.indexOf("list_all_tags"),
    );
  });

  it("promote is a no-op when the tag is already listed", async () => {
    const { service, store, settings_port, port } = make_service();
    store.set_promoted_setting(["Rust"]);

    await service.promote("#rust");

    expect(store.promoted_setting).toEqual(["Rust"]);
    expect(settings_port.set_vault_setting).not.toHaveBeenCalled();
    expect(port.list_all_tags).not.toHaveBeenCalled();
  });

  it("demote removes the entry, persists, and refreshes", async () => {
    const { service, store, settings_port, port } = make_service();
    store.set_promoted_setting(["rust", "svelte"]);

    await service.demote("rust");

    expect(store.promoted_setting).toEqual(["svelte"]);
    expect(settings_port.set_vault_setting).toHaveBeenCalledWith(
      "vault-1",
      "promoted_tags",
      ["svelte"],
    );
    expect(port.list_all_tags).toHaveBeenCalledTimes(1);
  });

  it("demote of a tag promoted only by frontmatter writes nothing", async () => {
    const { service, store, settings_port, port } = make_service([
      { tag: "research", count: 2, promoted: true },
    ]);
    store.set_promoted_setting([]);

    await service.demote("research");

    expect(settings_port.set_vault_setting).not.toHaveBeenCalled();
    expect(port.list_all_tags).not.toHaveBeenCalled();
  });

  it("promote_all_candidates adds every candidate in store order", async () => {
    const { service, store, settings_port } = make_service();
    store.set_promoted_setting(["existing"]);
    store.set_tags([
      { tag: "alpha", count: 1, promoted: false },
      { tag: "beta", count: 2, promoted: true },
      { tag: "gamma", count: 3, promoted: false },
    ]);

    await service.promote_all_candidates();

    expect(settings_port.set_vault_setting).toHaveBeenCalledWith(
      "vault-1",
      "promoted_tags",
      ["existing", "alpha", "gamma"],
    );
  });

  it("promote_all_candidates with no candidates writes nothing", async () => {
    const { service, store, settings_port, port } = make_service();
    store.set_tags([{ tag: "beta", count: 2, promoted: true }]);

    await service.promote_all_candidates();

    expect(settings_port.set_vault_setting).not.toHaveBeenCalled();
    expect(port.list_all_tags).not.toHaveBeenCalled();
  });

  it("persist failure records the error but keeps the optimistic store value", async () => {
    const { service, store, port } = make_service([], {
      set_vault_setting: vi.fn().mockRejectedValue(new Error("disk full")),
    });

    await service.promote("rust");

    expect(store.promoted_setting).toEqual(["rust"]);
    expect(store.error).toBe("disk full");
    expect(port.list_all_tags).not.toHaveBeenCalled();
  });
});
