import {
  BUILTIN_PROVIDER_PRESETS,
  type AiProviderConfig,
} from "$lib/shared/types/ai_provider_config";

type LegacyAiSettings = {
  ai_default_backend?: string;
  ai_claude_command?: string;
  ai_codex_command?: string;
  ai_ollama_command?: string;
  ai_ollama_model?: string;
};

type MigratedAiFields = {
  ai_providers: AiProviderConfig[];
  ai_default_provider_id: string;
};

export function migrate_ai_settings(
  raw: Record<string, unknown>,
): MigratedAiFields | null {
  if (Array.isArray(raw["ai_providers"])) {
    return null;
  }

  const legacy = raw as LegacyAiSettings;
  const has_legacy =
    "ai_default_backend" in raw ||
    "ai_claude_command" in raw ||
    "ai_codex_command" in raw ||
    "ai_ollama_command" in raw ||
    "ai_ollama_model" in raw;

  if (!has_legacy) {
    return null;
  }

  const providers: AiProviderConfig[] = BUILTIN_PROVIDER_PRESETS.map(
    (preset) => {
      const copy = { ...preset };
      if (
        preset.id === "claude" &&
        legacy.ai_claude_command &&
        legacy.ai_claude_command.trim() !== ""
      ) {
        copy.command = legacy.ai_claude_command.trim();
      }
      if (
        preset.id === "codex" &&
        legacy.ai_codex_command &&
        legacy.ai_codex_command.trim() !== ""
      ) {
        copy.command = legacy.ai_codex_command.trim();
      }
      if (preset.id === "ollama") {
        if (
          legacy.ai_ollama_command &&
          legacy.ai_ollama_command.trim() !== ""
        ) {
          copy.command = legacy.ai_ollama_command.trim();
        }
        if (legacy.ai_ollama_model && legacy.ai_ollama_model.trim() !== "") {
          copy.model = legacy.ai_ollama_model.trim();
        }
      }
      return copy;
    },
  );

  const default_provider_id = legacy.ai_default_backend ?? "auto";

  return {
    ai_providers: providers,
    ai_default_provider_id: default_provider_id,
  };
}
