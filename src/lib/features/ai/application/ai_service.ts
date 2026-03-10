import { create_logger } from "$lib/shared/utils/logger";
import type { SettingsPort } from "$lib/features/settings";
import type { VaultStore } from "$lib/features/vault";
import type { AiPort } from "$lib/features/ai/ports";
import {
  AI_PROVIDER_DISPLAY,
  DEFAULT_OLLAMA_MODEL,
  type AiDialogContext,
  type AiExecutionResult,
  type AiProvider,
} from "$lib/features/ai/domain/ai_types";
import { build_ai_prompt } from "$lib/features/ai/domain/ai_prompt_builder";

const log = create_logger("ai_service");
const OLLAMA_MODEL_SETTING_KEY = "ai_ollama_model";

export class AiService {
  constructor(
    private readonly ai_port: AiPort,
    private readonly settings_port: SettingsPort,
    private readonly vault_store: VaultStore,
  ) {}

  async check_cli(provider: AiProvider): Promise<boolean> {
    return await this.ai_port.check_cli(provider);
  }

  async load_ollama_model(): Promise<string> {
    const value = await this.settings_port.get_setting<string>(
      OLLAMA_MODEL_SETTING_KEY,
    );
    if (typeof value !== "string") return DEFAULT_OLLAMA_MODEL;
    const trimmed = value.trim();
    return trimmed === "" ? DEFAULT_OLLAMA_MODEL : trimmed;
  }

  async save_ollama_model(model: string): Promise<void> {
    const trimmed = model.trim();
    await this.settings_port.set_setting(
      OLLAMA_MODEL_SETTING_KEY,
      trimmed === "" ? DEFAULT_OLLAMA_MODEL : trimmed,
    );
  }

  async execute(input: {
    provider: AiProvider;
    prompt: string;
    context: AiDialogContext;
    ollama_model?: string;
  }): Promise<AiExecutionResult> {
    const vault_path = this.vault_store.vault?.path;
    if (!vault_path) {
      throw new Error("No active vault");
    }

    const prompt = build_ai_prompt({
      note_path: input.context.note_path,
      note_markdown: input.context.note_markdown,
      selection: input.context.selection,
      user_prompt: input.prompt,
      target: input.context.target,
    });

    const result = await this.ai_port.execute({
      provider: input.provider,
      vault_path,
      note_path: input.context.note_path,
      prompt,
      ollama_model:
        input.provider === "ollama"
          ? (input.ollama_model?.trim() ?? DEFAULT_OLLAMA_MODEL)
          : null,
    });

    if (!result.success) {
      log.warn("AI execution failed", {
        provider: input.provider,
        error: result.error,
      });
    }

    return {
      ...result,
      error:
        result.error ??
        (result.success
          ? null
          : `${AI_PROVIDER_DISPLAY[input.provider].name} failed to edit the note`),
    };
  }
}
