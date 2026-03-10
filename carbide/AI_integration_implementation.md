# AI Integration Implementation Plan

## Goal

Redesign Otterly's AI integration so it feels like one assistant rather than three branded provider entrypoints, while preserving explicit apply boundaries, local CLI execution, vault safety checks, and clear user control.

## Product decisions

- The primary feature is **AI Assistant**
- Claude, Codex, and Ollama remain supported as backends, not first-class product surfaces
- AI must have a clear **Enable AI** setting
- Disabling AI must hide or block user-facing AI entrypoints and prevent CLI execution
- AI output remains draft-only until the user explicitly applies it

## Invariants

- No direct AI writes to note content without explicit user apply
- No note path outside the vault is ever executed against
- AI execution remains behind the existing adapter and Tauri command boundary
- Provider-specific configuration stays in settings, but provider branding is de-emphasized in the main UX

## Phases

### Phase 1 — Foundation

- Add `ai_enabled` global setting
- Replace provider-first command palette entries with a single `AI Assistant` command
- Add a single `ai.open_assistant` action
- Keep provider-specific actions only as internal compatibility wrappers
- Add backend selection inside the AI dialog
- Gate AI actions and command visibility behind `ai_enabled`

### Phase 2 — Better current dialog

- Keep prompt visible after runs instead of hard-swapping to a raw result-only flow
- Add a clearer backend selector and context summary
- Make the current experience feel like one assistant with multiple backends

### Phase 3 — Assistant panel

- Move from modal dialog to persistent assistant panel
- Add conversation history
- Keep draft/result review separate from apply

### Phase 4 — Diff-first review

- Show proposed edits as diff instead of only raw output
- Support refined follow-up turns without losing context

## Initial implementation scope for this branch

1. Add `ai_enabled` setting and settings UI toggle
2. Add a single `AI Assistant` command/action surface
3. Add backend selection inside the existing AI dialog
4. Hide AI command palette entry when AI is disabled
5. Add focused tests for settings persistence and command filtering

## Progress log

### 2026-03-10

- Reviewed current AI implementation across frontend store/actions/UI and Rust execution boundary
- Confirmed current pain points: provider-first entrypoints, one-shot modal flow, no conversational loop, and weak trust UX around raw output review
- Began Phase 1 foundation work on branch `feat-ai-assistant-foundation`
- Added global `ai_enabled` setting and surfaced it as the first AI settings toggle
- Disabled AI now hides the unified AI command from command search and blocks AI action execution with an explicit settings-driven guard
- Replaced provider-first command palette entries with a single `AI Assistant` command/action surface
- Added backend selection inside the current AI dialog so provider choice is secondary instead of the main entrypoint
- Added tests for AI action gating, command filtering, and settings persistence
- Validation:
  - `pnpm check` ✅
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `cargo check` ✅
  - `pnpm format` ✅

## Open follow-ups

- Add explicit scope switching in the assistant surface
- Preserve session history across repeated AI runs
- Add structured diff preview before apply
- Consider a default backend setting or auto-selection strategy after the unified assistant flow is stable
