import type { ActionRegistry } from "$lib/app/action_registry/action_registry";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { EditorService } from "$lib/features/editor";

export function register_links_actions(
  registry: ActionRegistry,
  editor_service: EditorService,
): void {
  registry.register({
    id: ACTION_IDS.links_insert_suggested_link,
    label: "Insert Suggested Link",
    execute: (title: unknown) => {
      if (typeof title === "string") {
        editor_service.insert_text(`[[${title}]]`);
      }
    },
  });
}
