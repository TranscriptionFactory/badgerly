export type AiArgsTemplate =
  | { kind: "claude" }
  | { kind: "codex" }
  | { kind: "ollama" }
  | { kind: "stdin" }
  | { kind: "args"; args: string[] };

export type AiProviderConfig = {
  id: string;
  name: string;
  command: string;
  args_template: AiArgsTemplate;
  model?: string;
  install_url?: string;
  is_preset?: boolean;
};

export const BUILTIN_PROVIDER_PRESETS: AiProviderConfig[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    args_template: { kind: "claude" },
    install_url: "https://code.claude.com/docs/en/quickstart",
    is_preset: true,
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    args_template: { kind: "codex" },
    install_url: "https://github.com/openai/codex",
    is_preset: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    command: "ollama",
    args_template: { kind: "ollama" },
    model: "qwen3:8b",
    install_url: "https://ollama.com",
    is_preset: true,
  },
];
