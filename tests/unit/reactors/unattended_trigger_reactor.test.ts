/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create_unattended_trigger_reactor } from "$lib/reactors/unattended_trigger.reactor.svelte";
import type { UnattendedTrigger } from "$lib/features/assistant";
import type { VaultFsEvent } from "$lib/features/watcher";
import { WatcherService } from "$lib/features/watcher/application/watcher_service";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { UIStore } from "$lib/app/orchestration/ui_store.svelte";
import { create_mock_watcher_port } from "../helpers/mock_ports";
import { create_test_vault } from "../helpers/test_fixtures";
import { flush_effects } from "../helpers/tauri_event_mock";

const TRIGGER_DEBOUNCE_MS = 1500;

function added_event(note_path: string, vault_id: string): VaultFsEvent {
  return { type: "note_added", vault_id, note_path, mtime_ms: 1 };
}

async function mount({
  enabled = true,
  folder = "Inbox",
  loaded = true,
}: { enabled?: boolean; folder?: string; loaded?: boolean } = {}) {
  const vault_store = new VaultStore();
  const ui_store = new UIStore();
  const watcher_port = create_mock_watcher_port();
  const watcher_service = new WatcherService(watcher_port);
  const launched: UnattendedTrigger[] = [];

  const vault = create_test_vault();
  vault_store.set_vault(vault);
  await watcher_service.start(vault.id);

  ui_store.editor_settings.unattended_runs_enabled = enabled;
  ui_store.editor_settings.unattended_trigger_folder = folder;
  ui_store.editor_settings_loaded = loaded;

  const unmount = create_unattended_trigger_reactor(
    ui_store,
    vault_store,
    watcher_service,
    (trigger) => {
      launched.push(trigger);
    },
  );
  await flush_effects();

  return {
    ui_store,
    watcher_port,
    launched,
    unmount,
    vault_id: String(vault.id),
  };
}

const settle = () => vi.advanceTimersByTime(TRIGGER_DEBOUNCE_MS);

describe("unattended_trigger_reactor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts one run for a note added under the trigger folder", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    settle();

    expect(t.launched).toEqual([
      { kind: "watcher", note_path: "Inbox/new.md", folder: "Inbox" },
    ]);
    t.unmount();
  });

  it("coalesces a batch of arrivals into a single run", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Inbox/a.md", t.vault_id));
    t.watcher_port._emit(added_event("Inbox/b.md", t.vault_id));
    t.watcher_port._emit(added_event("Inbox/c.md", t.vault_id));
    settle();

    expect(t.launched).toHaveLength(1);
    t.unmount();
  });

  it("ignores a note added outside the folder", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Notes/a.md", t.vault_id));
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  it("ignores a change to a note already in the folder", async () => {
    const t = await mount();

    t.watcher_port._emit({
      type: "note_changed_externally",
      vault_id: t.vault_id,
      note_path: "Inbox/a.md",
      mtime_ms: 2,
    });
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  it("starts nothing while the trigger is disabled", async () => {
    const t = await mount({ enabled: false });

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  it("starts nothing before settings have loaded", async () => {
    const t = await mount({ loaded: false });

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  // The queued-event rule. An event that arrived while the trigger was on must
  // not fire after it is switched off mid-debounce.
  it("drops a scheduled run when the trigger is switched off", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    t.ui_store.editor_settings.unattended_runs_enabled = false;
    await flush_effects();
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  // The other half: an event that arrived while off is not replayed by a later
  // enable, because it was never queued in the first place.
  it("does not replay an event that arrived while disabled", async () => {
    const t = await mount({ enabled: false });

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    t.ui_store.editor_settings.unattended_runs_enabled = true;
    await flush_effects();
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  it("ignores an event for another vault", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Inbox/new.md", "some-other-vault"));
    settle();

    expect(t.launched).toEqual([]);
    t.unmount();
  });

  it("starts nothing once unmounted", async () => {
    const t = await mount();

    t.watcher_port._emit(added_event("Inbox/new.md", t.vault_id));
    t.unmount();
    settle();

    expect(t.launched).toEqual([]);
  });
});
