import { describe, expect, it } from "vitest";
import { migrate_ai_settings } from "$lib/features/ai/domain/ai_settings_migration";

describe("migrate_ai_settings", () => {
  it("returns null when ai_providers already exists", () => {
    const result = migrate_ai_settings({
      ai_providers: [{ id: "claude", name: "Claude", command: "claude" }],
    });

    expect(result).toBeNull();
  });

  it("returns null when no legacy fields exist", () => {
    const result = migrate_ai_settings({ some_other_key: "value" });

    expect(result).toBeNull();
  });

  it("migrates legacy fields to provider configs", () => {
    const result = migrate_ai_settings({
      ai_default_backend: "ollama",
      ai_claude_command: "/custom/claude",
      ai_codex_command: "codex",
      ai_ollama_command: "/opt/ollama",
      ai_ollama_model: "llama3:8b",
    });

    expect(result).not.toBeNull();
    expect(result!.ai_default_provider_id).toBe("ollama");
    expect(result!.ai_providers).toHaveLength(3);

    const claude = result!.ai_providers.find((p) => p.id === "claude");
    expect(claude?.command).toBe("/custom/claude");

    const ollama = result!.ai_providers.find((p) => p.id === "ollama");
    expect(ollama?.command).toBe("/opt/ollama");
    expect(ollama?.model).toBe("llama3:8b");
  });

  it("uses preset defaults for empty or missing legacy commands", () => {
    const result = migrate_ai_settings({
      ai_default_backend: "auto",
    });

    expect(result).not.toBeNull();
    expect(result!.ai_default_provider_id).toBe("auto");

    const claude = result!.ai_providers.find((p) => p.id === "claude");
    expect(claude?.command).toBe("claude");

    const ollama = result!.ai_providers.find((p) => p.id === "ollama");
    expect(ollama?.command).toBe("ollama");
    expect(ollama?.model).toBe("qwen3:8b");
  });

  it("preserves preset is_preset flag", () => {
    const result = migrate_ai_settings({
      ai_default_backend: "auto",
    });

    expect(result).not.toBeNull();
    for (const provider of result!.ai_providers) {
      expect(provider.is_preset).toBe(true);
    }
  });
});
