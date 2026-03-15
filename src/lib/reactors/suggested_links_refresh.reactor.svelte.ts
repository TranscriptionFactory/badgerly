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

  const debounced = create_debounced_task_controller<string>({
    run: (note_path) => {
      void links_service.load_suggested_links(note_path);
    },
  });

  return $effect.root(() => {
    $effect(() => {
      const note_path = editor_store.open_note?.meta.path ?? null;
      const panel_open =
        ui_store.context_rail_open && ui_store.context_rail_tab === "links";

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
        debounced.schedule(note_path, DEBOUNCE_MS);
      }
    });
  });
}
