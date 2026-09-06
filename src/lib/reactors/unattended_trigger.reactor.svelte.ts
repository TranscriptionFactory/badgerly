import { create_debounced_task_controller } from "$lib/reactors/debounced_task";
import { resolve_unattended_trigger } from "$lib/features/assistant";
import type { UnattendedTrigger } from "$lib/features/assistant";
import type { UIStore } from "$lib/app";
import type { VaultStore } from "$lib/features/vault";
import type { VaultFsEvent, WatcherService } from "$lib/features/watcher";

// A single note write can surface as several watcher events, and a folder can
// receive a batch at once. Coalescing to the last one keeps that from becoming
// a run per event; the service's own lock is the backstop, not the plan.
const TRIGGER_DEBOUNCE_MS = 1500;

export type UnattendedRunLauncher = (
  trigger: UnattendedTrigger,
) => Promise<unknown> | unknown;

export function create_unattended_trigger_reactor(
  ui_store: UIStore,
  vault_store: VaultStore,
  watcher_service: WatcherService,
  launch: UnattendedRunLauncher,
): () => void {
  const pending = create_debounced_task_controller<UnattendedTrigger>({
    run: (trigger) => void launch(trigger),
  });

  return $effect.root(() => {
    function handle_event(event: VaultFsEvent) {
      // Only a note arriving in the folder starts a run. A change to a note
      // already there is the user editing, and a removal has nothing to read.
      if (event.type !== "note_added") return;

      const decision = resolve_unattended_trigger({
        settings_loaded: ui_store.editor_settings_loaded,
        enabled: ui_store.editor_settings.unattended_runs_enabled,
        trigger_folder: ui_store.editor_settings.unattended_trigger_folder,
        active_vault_id: vault_store.active_vault_id
          ? String(vault_store.active_vault_id)
          : null,
        event_vault_id: event.vault_id,
        note_path: event.note_path,
      });
      if (decision.action !== "run") return;

      pending.schedule(
        {
          kind: "watcher",
          note_path: decision.note_path,
          folder: ui_store.editor_settings.unattended_trigger_folder,
        },
        TRIGGER_DEBOUNCE_MS,
      );
    }

    // Turning the trigger off drops work already scheduled, rather than letting
    // a debounce that started while it was on fire after. This is the other
    // half of "no runs for events queued while disabled" — the decision
    // function drops events at arrival, and this drops the ones already in
    // flight. Switching vaults cancels for the same reason.
    $effect(() => {
      const enabled =
        ui_store.editor_settings_loaded &&
        ui_store.editor_settings.unattended_runs_enabled;
      const vault_id = vault_store.active_vault_id;
      if (!enabled || !vault_id) pending.cancel();
    });

    $effect(() => {
      if (!vault_store.vault) return;
      const unsub = watcher_service.subscribe(handle_event);
      return () => {
        unsub();
        pending.cancel();
      };
    });

    return () => {
      pending.cancel();
    };
  });
}
