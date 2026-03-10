import { toast } from "svelte-sonner";
import type { ActionRegistrationInput } from "$lib/app";
import { ACTION_IDS } from "$lib/app";
import type { AiProvider } from "$lib/features/ai/domain/ai_types";
import { AI_PROVIDER_DISPLAY } from "$lib/features/ai/domain/ai_types";
import type { AiService } from "$lib/features/ai/application/ai_service";
import type { AiStore } from "$lib/features/ai/state/ai_store.svelte";
import { error_message } from "$lib/shared/utils/error_message";

export function register_ai_actions(
  input: ActionRegistrationInput & {
    ai_store: AiStore;
    ai_service: AiService;
  },
) {
  const { registry, services, ai_service, ai_store } = input;
  let dialog_revision = 0;

  async function open_ai_dialog(provider: AiProvider) {
    const context = services.editor.get_ai_context();
    if (!context) {
      toast.info("Open a note first to use AI editing");
      return;
    }

    const selection = context.selection;
    ai_store.open_dialog(provider, {
      note_path: context.note_path,
      note_title: context.note_title,
      note_markdown: context.markdown,
      selection,
      target:
        selection && selection.text.trim() !== "" ? "selection" : "full_note",
    });

    const revision = ++dialog_revision;
    ai_store.set_cli_status("checking");

    if (provider === "ollama") {
      void ai_service.load_ollama_model().then((model) => {
        if (revision !== dialog_revision) return;
        if (!ai_store.dialog.open || ai_store.dialog.provider !== provider)
          return;
        ai_store.set_ollama_model(model);
      });
    }

    try {
      const available = await ai_service.check_cli(provider);
      if (revision !== dialog_revision) return;
      if (!ai_store.dialog.open || ai_store.dialog.provider !== provider)
        return;
      ai_store.set_cli_status(available ? "available" : "unavailable");
    } catch (error) {
      if (revision !== dialog_revision) return;
      if (!ai_store.dialog.open || ai_store.dialog.provider !== provider)
        return;
      ai_store.set_cli_status("error", error_message(error));
    }
  }

  function close_ai_dialog() {
    dialog_revision += 1;
    ai_store.close_dialog();
  }

  registry.register({
    id: ACTION_IDS.ai_open_claude,
    label: AI_PROVIDER_DISPLAY.claude.command_label,
    execute: async () => {
      await open_ai_dialog("claude");
    },
  });

  registry.register({
    id: ACTION_IDS.ai_open_codex,
    label: AI_PROVIDER_DISPLAY.codex.command_label,
    execute: async () => {
      await open_ai_dialog("codex");
    },
  });

  registry.register({
    id: ACTION_IDS.ai_open_ollama,
    label: AI_PROVIDER_DISPLAY.ollama.command_label,
    execute: async () => {
      await open_ai_dialog("ollama");
    },
  });

  registry.register({
    id: ACTION_IDS.ai_close_dialog,
    label: "Close AI Dialog",
    execute: () => {
      close_ai_dialog();
    },
  });

  registry.register({
    id: ACTION_IDS.ai_update_prompt,
    label: "Update AI Prompt",
    execute: (prompt: unknown) => {
      ai_store.set_prompt(String(prompt));
    },
  });

  registry.register({
    id: ACTION_IDS.ai_update_ollama_model,
    label: "Update Ollama Model",
    execute: (model: unknown) => {
      ai_store.set_ollama_model(String(model));
    },
  });

  registry.register({
    id: ACTION_IDS.ai_clear_result,
    label: "Clear AI Result",
    execute: () => {
      ai_store.clear_result();
    },
  });

  registry.register({
    id: ACTION_IDS.ai_execute,
    label: "Execute AI Edit",
    execute: async () => {
      const dialog = ai_store.dialog;
      if (!dialog.open || !dialog.context) return;
      if (dialog.is_executing) return;
      if (dialog.cli_status !== "available") return;
      if (dialog.prompt.trim() === "") {
        toast.info("Describe how you want to edit the note");
        return;
      }

      const revision = dialog_revision;
      ai_store.start_execution();

      try {
        if (dialog.provider === "ollama") {
          await ai_service.save_ollama_model(dialog.ollama_model);
        }
        const result = await ai_service.execute({
          provider: dialog.provider,
          prompt: dialog.prompt,
          context: dialog.context,
          ollama_model: dialog.ollama_model,
        });
        if (revision !== dialog_revision) return;
        if (
          !ai_store.dialog.open ||
          ai_store.dialog.provider !== dialog.provider
        )
          return;
        ai_store.finish_execution(result);
      } catch (error) {
        if (revision !== dialog_revision) return;
        if (
          !ai_store.dialog.open ||
          ai_store.dialog.provider !== dialog.provider
        )
          return;
        ai_store.finish_execution({
          success: false,
          output: "",
          error: error_message(error),
        });
      }
    },
  });

  registry.register({
    id: ACTION_IDS.ai_apply_result,
    label: "Apply AI Result",
    execute: () => {
      const dialog = ai_store.dialog;
      if (!dialog.open || !dialog.context || !dialog.result?.success) return;

      const applied = services.editor.apply_ai_output(
        dialog.context.target,
        dialog.result.output,
        dialog.context.selection,
      );

      if (!applied) {
        toast.error("Failed to apply AI edit");
        return;
      }

      toast.success(
        `${AI_PROVIDER_DISPLAY[dialog.provider].name} suggestion applied`,
      );
      close_ai_dialog();
    },
  });
}
