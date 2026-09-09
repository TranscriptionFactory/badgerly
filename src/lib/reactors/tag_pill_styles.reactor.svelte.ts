import type { TagService, TagStore } from "$lib/features/tags";
import type { VaultStore } from "$lib/features/vault";
import { apply_tag_pill_styles } from "$lib/shared/utils/tag_pill_styles";

export function create_tag_pill_styles_reactor(
  tag_store: TagStore,
  vault_store: VaultStore,
  tag_service: TagService,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      const vault_id = vault_store.vault?.id;
      if (vault_id) void tag_service.load_tag_colors();
    });

    $effect(() => {
      const promoted = new Set([
        ...tag_store.promoted_setting,
        ...tag_store.promoted_tags.map((t) => t.tag),
      ]);
      apply_tag_pill_styles([...promoted], tag_store.tag_colors);
    });
  });
}
