import type { EditorStore } from "$lib/features/editor";
import type { UIStore } from "$lib/app";
import type { LinksService } from "$lib/features/links";

export function create_related_notes_refresh_reactor(
  editor_store: EditorStore,
  ui_store: UIStore,
  links_service: LinksService,
): () => void {
  let last_note_path: string | null = null;

  return $effect.root(() => {
    $effect(() => {
      const note_path = editor_store.open_note?.meta.path ?? null;
      const panel_open =
        ui_store.context_rail_open && ui_store.context_rail_tab === "related";
      const limit = ui_store.editor_settings.semantic_related_notes_limit;

      if (!note_path) {
        last_note_path = null;
        links_service.clear_related_notes();
        return;
      }

      if (!panel_open) {
        return;
      }

      if (note_path !== last_note_path) {
        last_note_path = note_path;
        void links_service.load_related_notes(note_path, limit);
      }
    });
  });
}
