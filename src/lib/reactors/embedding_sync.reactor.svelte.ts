import type { SearchStore } from "$lib/features/search";
import type { VaultStore } from "$lib/features/vault";
import type { WorkspaceIndexPort } from "$lib/features/search";
import { create_logger } from "$lib/shared/utils/logger";

const log = create_logger("embedding_sync_reactor");

export function create_embedding_sync_reactor(
  search_store: SearchStore,
  vault_store: VaultStore,
  workspace_index_port: WorkspaceIndexPort,
): () => void {
  let last_index_status: SearchStore["index_progress"]["status"] = "idle";

  return $effect.root(() => {
    $effect(() => {
      const current_status = search_store.index_progress.status;
      const index_just_completed =
        current_status === "completed" && last_index_status !== "completed";
      last_index_status = current_status;

      if (!index_just_completed) return;

      const vault_id = vault_store.vault?.id ?? null;
      if (!vault_id) return;

      void workspace_index_port.embed_sync(vault_id).catch((error: unknown) => {
        log.error("Embedding sync after index failed", { error });
      });
    });
  });
}
