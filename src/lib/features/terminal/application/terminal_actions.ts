import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type {
  TerminalService,
  TerminalSessionRequest,
} from "$lib/features/terminal/application/terminal_service";
import type { TerminalStore } from "$lib/features/terminal/state/terminal_store.svelte";

export function register_terminal_actions(
  input: ActionRegistrationInput & {
    terminal_store: TerminalStore;
    terminal_service: TerminalService;
  },
) {
  const { registry, terminal_store, terminal_service } = input;

  registry.register({
    id: ACTION_IDS.terminal_toggle,
    label: "Toggle Terminal",
    execute: () => {
      if (terminal_store.panel_open) {
        terminal_service.close_all_sessions();
        return;
      }

      terminal_store.open();
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_close,
    label: "Close Terminal",
    execute: () => {
      terminal_service.close_all_sessions();
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_new_session,
    label: "New Terminal Session",
    execute: async (request: unknown) => {
      await terminal_service.create_session(request as TerminalSessionRequest);
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_activate_session,
    label: "Activate Terminal Session",
    execute: (session_id: unknown) => {
      terminal_service.activate_session(session_id as string);
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_close_session,
    label: "Close Terminal Session",
    execute: (session_id: unknown) => {
      terminal_service.close_session(session_id as string);
      if (terminal_store.session_ids.length === 0) {
        terminal_store.close();
      }
    },
  });

  registry.register({
    id: ACTION_IDS.terminal_respawn_session,
    label: "Respawn Terminal Session",
    execute: async (session_id: unknown, request: unknown) => {
      await terminal_service.respawn_session(
        session_id as string,
        request as TerminalSessionRequest,
      );
    },
  });
}
