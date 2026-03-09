# 2026 CLI Configuration Comparison: Claude Code, Gemini CLI, GitHub Copilot, and Codex

In 2026, the industry has largely converged on a layered configuration model, but Codex should not be grouped with GitHub Copilot. Codex has its own CLI config and instruction system.

## Core Configuration Hierarchy

| Feature                   | **Claude Code**                        | **Gemini CLI**                         | **GitHub Copilot**                            | **Codex**                                                                         |
| :------------------------ | :------------------------------------- | :------------------------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Primary Config File**   | `.claude/settings.json`                | `.gemini/settings.json`                | `.github/copilot-instructions.md`             | `~/.codex/config.toml`                                                            |
| **Global User Config**    | `~/.claude/settings.json`              | `~/.gemini/settings.json`              | Surface-dependent                             | `~/.codex/config.toml`                                                            |
| **Project "Rules" File**  | `CLAUDE.md`                            | `GEMINI.md`                            | `.github/copilot-instructions.md`             | `AGENTS.md`                                                                       |
| **Project Trust / Scope** | Project-local settings override global | Project-local settings override global | Repo instructions apply in supported surfaces | Per-project trust is stored in `~/.codex/config.toml` under `[projects."<path>"]` |
| **Reasoning Control**     | "Thinking Mode" toggle                 | "Thinking Budget" (time-based)         | Surface-dependent                             | `model_reasoning_effort` (`low` / `medium` / `high`)                              |
| **Extension Protocol**    | MCP (Model Context Protocol)           | MCP and native plugins                 | GitHub extensions / ecosystem integrations    | MCP, plus Codex skills/plugins                                                    |
| **Ignore Patterns**       | `.gitignore` (automatic)               | `.geminiignore`                        | `.gitignore` plus editor/repo context rules   | `.gitignore` and global gitignore support                                         |
| **CLI Overrides**         | Session flags                          | Session flags                          | Prompt / editor surface controls              | `-c key=value`, `--profile`, `--sandbox`, `--ask-for-approval`                    |

---

## Key Similarities

### 1. Hierarchical Overrides

All of these tools support some combination of persistent user preferences plus repository-specific instructions. The exact mechanism differs: Claude and Gemini lean on project config directories, GitHub Copilot leans on repository instruction files, and Codex combines `~/.codex/config.toml` with hierarchical `AGENTS.md` files.

### 2. Markdown-Based "House Rules"

Markdown remains the standard way to provide persistent project context:

- **Claude Code:** `CLAUDE.md`
- **Gemini CLI:** `GEMINI.md`
- **GitHub Copilot:** `.github/copilot-instructions.md`
- **Codex:** `AGENTS.md`

These files are typically used to define:

- **Coding Standards:** (e.g., "Use functional components," "Strict TypeScript").
- **Tech Stack Details:** (e.g., "We use pnpm and Vitest").
- **Common Commands:** Standardized build, test, and lint scripts.

### 3. Context & Reasoning Management

- **Ignore Files:** Automatic `.gitignore` handling is common, with tool-specific additions such as `.geminiignore`.
- **Reasoning Controls:** Each tool exposes some form of reasoning or thinking budget control, but the UI and naming differ.

---

## Key Differences & Unique Features

- **Claude Code:** Focuses on autonomous execution with specific flags like `dangerouslySkipPermissions` ("YOLO mode") and `autoAcceptEdits` to minimize user friction during large refactors.
- **Gemini CLI:** Emphasizes security through "Trusted Folders," which act as sandboxes for high-privilege tool execution and MCP server integration.
- **GitHub Copilot:** Centers repository instructions around `.github/copilot-instructions.md` and related GitHub/editor workflows.
- **Codex:** Uses a real CLI config file at `~/.codex/config.toml`, supports per-project trust entries, reads hierarchical `AGENTS.md` files, and exposes direct CLI controls for profiles, sandboxing, approvals, and config overrides.

## Codex-Specific Notes

The previous version of this doc was not correct for Codex because it treated Codex like a GitHub Copilot instruction surface.

For Codex specifically:

- **User config lives in:** `~/.codex/config.toml`
- **Project instructions live in:** `AGENTS.md`
- **Instruction scoping is hierarchical:** deeper `AGENTS.md` files override higher-level ones for files in their subtree
- **Project trust is explicit:** trusted workspaces are recorded in `~/.codex/config.toml`

---

_Generated on March 9, 2026_
