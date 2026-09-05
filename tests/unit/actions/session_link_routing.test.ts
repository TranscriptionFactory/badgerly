import { describe, expect, it, vi } from "vitest";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import { create_note_routing_harness } from "../helpers/note_routing_harness";

vi.mock("svelte-sonner", () => ({ toast: { error: vi.fn() } }));

describe("session link action routing", () => {
  it.each(["◈ session-1", "◈ v1.2 #3: https://host/path?x=%23"])(
    "opens %s through the session action",
    async (raw_path) => {
      const { registry, services } = create_note_routing_harness();
      const open = vi.fn();
      registry.register({
        id: ACTION_IDS.assistant_open_session,
        label: "Open session",
        execute: open,
      });
      services.search.resolve_session_link.mockReturnValue({
        id: "session-1",
        title: "Title",
      });
      await registry.execute(ACTION_IDS.note_open_wiki_link, {
        raw_path,
        base_note_path: "note.md",
        source: "wiki",
      });
      expect(services.search.resolve_session_link).toHaveBeenCalledWith(
        raw_path,
      );
      expect(open).toHaveBeenCalledWith("session-1");
      expect(services.search.resolve_wiki_link).not.toHaveBeenCalled();
      expect(services.note.create_new_note).not.toHaveBeenCalled();
    },
  );

  it.each(["◈ missing", "◈", "◈ bad|target"])(
    "does not create a note or fall back for %s",
    async (raw_path) => {
      const { registry, services } = create_note_routing_harness();
      services.search.resolve_session_link.mockReturnValue(null);
      await expect(
        registry.execute(ACTION_IDS.note_open_wiki_link, {
          raw_path,
          base_note_path: "note.md",
          source: "wiki",
        }),
      ).resolves.toBeUndefined();
      expect(services.search.resolve_wiki_link).not.toHaveBeenCalled();
      expect(services.search.resolve_note_link).not.toHaveBeenCalled();
      expect(services.note.create_new_note).not.toHaveBeenCalled();
    },
  );
});
