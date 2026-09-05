// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { AssistantSessionStore } from "$lib/features/assistant";
import type { EditorService } from "$lib/features/editor";
import { create_session_links_reactor } from "$lib/reactors/session_links.reactor.svelte";
import { create_test_vault, vault_store_for } from "../helpers/test_fixtures";
import { make_session } from "../helpers/assistant_session_fixtures";

describe("session link refresh", () => {
  it("refreshes on hydration, rename, removal and vault switch, then stops on disposal", () => {
    const sessions = new AssistantSessionStore();
    const vault = vault_store_for("vault-1");
    const refresh_session_links = vi.fn();
    const stop = create_session_links_reactor(sessions, vault, {
      refresh_session_links,
    } as unknown as EditorService);
    flushSync();
    const initial = refresh_session_links.mock.calls.length;
    sessions.hydrate([make_session()], vault.active_vault_id);
    flushSync();
    const after_hydration = refresh_session_links.mock.calls.length;
    sessions.append_message("session-1", {
      id: "message-1",
      role: "assistant",
      content: "First token",
      citations: [],
    });
    flushSync();
    sessions.update_message("session-1", "message-1", {
      content: "First token and more",
    });
    flushSync();
    expect(refresh_session_links).toHaveBeenCalledTimes(after_hydration);
    sessions.rename("session-1", "New title");
    flushSync();
    sessions.delete_session("session-1");
    flushSync();
    vault.set_vault(create_test_vault({ id: "other" as never }));
    flushSync();
    expect(refresh_session_links).toHaveBeenCalledTimes(initial + 4);
    stop();
    sessions.hydrate([make_session()], vault.active_vault_id);
    flushSync();
    expect(refresh_session_links).toHaveBeenCalledTimes(initial + 4);
  });
});
