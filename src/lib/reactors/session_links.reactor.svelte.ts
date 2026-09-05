import { untrack } from "svelte";
import type { AssistantSessionStore } from "$lib/features/assistant";
import type { EditorService } from "$lib/features/editor";
import type { VaultStore } from "$lib/features/vault";

export function create_session_links_reactor(
  sessions: AssistantSessionStore,
  vault: VaultStore,
  editor: EditorService,
): () => void {
  let previous_snapshot = "";
  return $effect.root(() => {
    $effect(() => {
      const snapshot = JSON.stringify([
        vault.active_vault_id,
        sessions.vault_id,
        sessions.sessions.map(({ id, title }) => [id, title]),
      ]);
      if (snapshot === previous_snapshot) return;
      previous_snapshot = snapshot;
      untrack(() => {
        editor.refresh_session_links();
      });
    });
  });
}
