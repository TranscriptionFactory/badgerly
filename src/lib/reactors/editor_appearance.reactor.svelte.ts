import type { UIStore } from "$lib/app";
import { apply_editor_appearance } from "$lib/shared/utils/apply_editor_appearance";

export function create_editor_appearance_reactor(
  ui_store: UIStore,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      apply_editor_appearance(ui_store.editor_settings);
    });
  });
}
