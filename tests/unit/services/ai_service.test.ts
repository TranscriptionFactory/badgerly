import { describe, expect, it, vi } from "vitest";
import { AiService, DEFAULT_OLLAMA_MODEL } from "$lib/features/ai";
import { VaultStore } from "$lib/features/vault";
import { create_test_vault } from "../helpers/test_fixtures";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";

describe("AiService", () => {
  it("loads the saved ollama model with fallback", async () => {
    const ai_port = {
      check_cli: vi.fn(),
      execute: vi.fn(),
    };
    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn(),
    };
    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault());
    const service = new AiService(
      ai_port as never,
      settings_port as never,
      vault_store,
    );

    expect(await service.load_ollama_model()).toBe(DEFAULT_OLLAMA_MODEL);
  });

  it("builds and executes a full-note request against the active vault", async () => {
    const ai_port = {
      check_cli: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: "# Updated",
        error: null,
      }),
    };
    const settings_port = {
      get_setting: vi.fn(),
      set_setting: vi.fn().mockResolvedValue(undefined),
    };
    const vault_store = new VaultStore();
    vault_store.set_vault(create_test_vault({ path: "/vault/demo" as never }));
    const service = new AiService(
      ai_port as never,
      settings_port as never,
      vault_store,
    );

    const result = await service.execute({
      provider: "ollama",
      prompt: "Tighten this note",
      ollama_model: "llama3:8b",
      context: {
        note_path: as_note_path("docs/demo.md"),
        note_title: "demo",
        note_markdown: as_markdown_text("# Demo"),
        selection: null,
        target: "full_note",
      },
    });

    expect(result.success).toBe(true);
    expect(ai_port.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "ollama",
        vault_path: "/vault/demo",
        note_path: as_note_path("docs/demo.md"),
        ollama_model: "llama3:8b",
      }),
    );
    const call = ai_port.execute.mock.calls[0];
    const request = call?.[0] as { prompt: string } | undefined;
    expect(request?.prompt).toContain("Tighten this note");
  });
});
