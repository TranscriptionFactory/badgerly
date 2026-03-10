<script lang="ts">
  import OptionalSurface from "$lib/shared/ui/optional_surface.svelte";
  import type {
    AiApplyTarget,
    AiCliStatus,
    AiExecutionResult,
    AiProvider,
  } from "$lib/features/ai/domain/ai_types";

  type AiEditDialogProps = {
    open: boolean;
    provider: AiProvider;
    prompt: string;
    ollama_model: string;
    cli_status: AiCliStatus;
    cli_error: string | null;
    target: AiApplyTarget;
    note_title: string | null;
    selection_text: string | null;
    is_executing: boolean;
    result: AiExecutionResult | null;
    on_open_change: (open: boolean) => void;
    on_prompt_change: (prompt: string) => void;
    on_ollama_model_change: (model: string) => void;
    on_execute: () => void;
    on_apply: () => void;
    on_clear_result: () => void;
  };

  let component_props: AiEditDialogProps = $props();

  const load_ai_edit_dialog = () =>
    import("$lib/features/ai/ui/ai_edit_dialog_content.svelte");
</script>

<OptionalSurface
  loader={load_ai_edit_dialog}
  {component_props}
  loading_label="Loading AI…"
  error_label="Failed to load AI dialog"
/>
