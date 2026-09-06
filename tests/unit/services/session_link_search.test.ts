import { describe, expect, it, vi } from "vitest";
import { SearchService } from "$lib/features/search";
import { AssistantSessionStore } from "$lib/features/assistant";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { create_mock_search_port } from "../helpers/mock_ports";
import { create_test_vault, vault_store_for } from "../helpers/test_fixtures";
import { make_session } from "../helpers/assistant_session_fixtures";

function setup() {
  const vault = vault_store_for("vault-1");
  const sessions = new AssistantSessionStore();
  const port = create_mock_search_port();
  const suggest_wiki_links = vi.spyOn(port, "suggest_wiki_links");
  const suggest_planned_links = vi.spyOn(port, "suggest_planned_links");
  const service = new SearchService(
    port,
    vault,
    new OpStore(),
    () => 0,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    (id) => (sessions.vault_id === id ? sessions.sessions : []),
  );
  sessions.hydrate(
    [make_session({ title: "Link review" })],
    vault.active_vault_id,
  );
  return {
    vault,
    sessions,
    suggest_wiki_links,
    suggest_planned_links,
    service,
  };
}

describe("session link search", () => {
  it("suggests current sessions by title or ID without note IO", async () => {
    const { service, suggest_wiki_links, suggest_planned_links } = setup();
    for (const term of ["◈", "◈ REVIEW", "◈ session-1"]) {
      expect(await service.suggest_wiki_links(term)).toEqual({
        status: "success",
        results: [{ kind: "session", id: "session-1", title: "Link review" }],
      });
    }
    expect(suggest_wiki_links).not.toHaveBeenCalled();
    expect(suggest_planned_links).not.toHaveBeenCalled();
  });

  it("suggests sessions for the ~ typing alias", async () => {
    const { service, suggest_wiki_links } = setup();
    for (const term of ["~", "~REVIEW", "~ session-1"]) {
      expect(await service.suggest_wiki_links(term)).toEqual({
        status: "success",
        results: [{ kind: "session", id: "session-1", title: "Link review" }],
      });
    }
    expect(suggest_wiki_links).not.toHaveBeenCalled();
  });

  it("fails closed immediately on vault switch, including before hydration", async () => {
    const { vault, sessions, service } = setup();
    expect(service.resolve_session_link("◈ session-1")?.id).toBe("session-1");
    vault.set_vault(create_test_vault({ id: "other" as never }));
    expect(service.resolve_session_link("◈ session-1")).toBeNull();
    expect(await service.suggest_wiki_links("◈")).toEqual({
      status: "success",
      results: [],
    });
    sessions.hydrate(
      [make_session({ id: "other-session" })],
      vault.active_vault_id,
    );
    expect(service.resolve_session_link("◈ other-session")?.id).toBe(
      "other-session",
    );
    expect(service.resolve_session_link("◈ session-1")).toBeNull();
  });

  it("uses current titles and caps results per query", async () => {
    const { sessions, vault, service } = setup();
    sessions.rename("session-1", "Renamed", "manual");
    expect(service.resolve_session_link("◈ Renamed")?.id).toBe("session-1");
    expect(service.resolve_session_link("◈ Link review")).toBeNull();
    sessions.hydrate(
      Array.from({ length: 20 }, (_, i) =>
        make_session({ id: `id-${String(i)}` }),
      ),
      vault.active_vault_id,
    );
    expect((await service.suggest_wiki_links("◈")).results).toHaveLength(15);
  });

  it("invalidates a pending note query when session autocomplete takes over", async () => {
    const { suggest_wiki_links, service } = setup();
    let finish: (() => void) | undefined;
    suggest_wiki_links.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            resolve([]);
          };
        }),
    );
    const pending = service.suggest_wiki_links("note");
    await service.suggest_wiki_links("◈");
    finish?.();
    expect((await pending).status).toBe("stale");
  });
});
