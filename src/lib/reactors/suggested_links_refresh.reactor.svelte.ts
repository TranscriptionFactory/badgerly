import type { EditorStore } from "$lib/features/editor";
import type { UIStore } from "$lib/app";
import type { LinksService } from "$lib/features/links";
import { create_debounced_task_controller } from "$lib/reactors/debounced_task";

const DEBOUNCE_MS = 300;

export function create_suggested_links_refresh_reactor(
  editor_store: EditorStore,
  ui_store: UIStore,
  links_service: LinksService,
): () => void {
  let last_note_path: string | null = null;

  const debounced = create_debounced_task_controller<{
    note_path: string;
    limit: number;
    threshold: number;
  }>({
    run: ({ note_path, limit, threshold }) => {
      void links_service.load_suggested_links(note_path, limit, threshold);
    },
  });

  return $effect.root(() => {
    $effect(() => {
      const note_path = editor_store.open_note?.meta.path ?? null;
      const panel_open =
        ui_store.context_rail_open && ui_store.context_rail_tab === "links";
      const limit = ui_store.editor_settings.semantic_suggested_links_limit;
      const threshold = ui_store.editor_settings.semantic_similarity_threshold;

      if (!note_path || !panel_open) {
        if (!note_path) {
          last_note_path = null;
          debounced.cancel();
          links_service.clear_suggested_links();
        }
        return;
      }

      if (note_path !== last_note_path) {
        last_note_path = note_path;
        debounced.schedule({ note_path, limit, threshold }, DEBOUNCE_MS);
      }
    });
  });
}
