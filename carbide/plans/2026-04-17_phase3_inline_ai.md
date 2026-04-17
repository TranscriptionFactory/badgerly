# Phase 3: Inline AI Menu + Streaming — Implementation Plan

**Date:** 2026-04-17
**Reference:** `carbide/research/mdit_comparison.md`, `carbide/plans/2026-04-17_mdit_port_plan.md`

---

## Context

Phase 1 (quick wins) and Phase 2 (callout blocks) of the mdit port are complete. Phase 3 is the highest-value item: bringing AI from sidebar-only to inline editing flow with streaming text insertion. Currently, Carbide's AI is panel-based with no streaming — the `AiPort.execute()` interface returns full output after completion. The mdit reference app uses Vercel AI SDK with React/Plate.js for inline AI with real-time streaming.

## Scope

**This phase: 3.1 (AI Menu Plugin) + 3.2 (Streaming Text Insertion)**

Items 3.3 (Vault Tools), 3.4 (Custom Commands), 3.5 (Multi-Provider) deferred to follow-up phases.

## Key Decision: Custom Streaming Adapter (not Vercel AI SDK)

**Use a thin custom `fetch()` + SSE parser** instead of the Vercel AI SDK. Rationale:

- The AI SDK adds ~300 KB (186 KB core + provider packages) for what is fundamentally a JSON API wrapper + SSE stream parser
- A custom adapter is ~150-200 lines total — covers OpenAI and Anthropic SSE formats
- Zero dependency risk, full control over retry/abort/buffering
- Fits cleanly into the existing `AiPort` pattern (the adapter *is* the thin fetch+SSE layer)
- The AI SDK's value (multi-provider abstraction, tool calling protocol, experimental transforms) only matters at Phase 3.5 scope — not needed for 3.1+3.2
- Can always adopt AI SDK later if multi-provider complexity warrants it

> **Note:** The Vercel AI SDK evaluation is preserved in `~/.claude/plans/peppy-munching-wren.md` for future reference.

### Provider-specific differences (all handled in ~80 lines of config mapping)

| Concern | OpenAI | Anthropic |
|---|---|---|
| Endpoint | `POST /v1/chat/completions` | `POST /v1/messages` |
| Auth header | `Authorization: Bearer $key` | `x-api-key: $key` |
| Body shape | `{ model, messages, stream: true }` | `{ model, messages, stream: true, max_tokens }` |
| Chunk path | `choices[0].delta.content` | `delta.text` (inside `content_block_delta` event) |
| SSE format | Standard `data:` lines | Typed events (`event: content_block_delta\ndata: ...`) |

---

## Architecture

### New Port: `AiStreamPort`

```
src/lib/features/ai/
├── ports.ts                          # Add AiStreamPort interface
├── adapters/
│   └── ai_stream_adapter.ts         # NEW: Custom fetch+SSE streaming adapter
├── domain/
│   └── ai_stream_types.ts           # NEW: Streaming domain types
```

```ts
interface AiStreamPort {
  stream_text(input: AiStreamRequest): AsyncIterable<AiStreamChunk>;
  abort(): void;
}

type AiStreamRequest = {
  provider: AiProviderConfig;
  system_prompt: string;
  messages: AiMessage[];
  model?: string;
};

type AiStreamChunk =
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };
```

The adapter implements `stream_text()` as an `async function*` that:
1. Resolves provider config → endpoint URL, headers, body shape
2. Calls `fetch()` with `stream: true` in the body
3. Reads `response.body` via `ReadableStream` + `TextDecoder`
4. Parses SSE lines (`data: {...}\n\n`) per provider format
5. Yields `AiStreamChunk` objects
6. Uses `AbortController` for cancellation via `abort()`

### ProseMirror Plugin: `ai_menu_plugin.ts`

```
src/lib/features/editor/adapters/
├── ai_menu_plugin.ts                # NEW: ProseMirror plugin (keymap + state + decorations)
```

**Plugin responsibilities:**
- Keymap: `Cmd+J` (Mac) / `Ctrl+J` (other) opens menu when cursor is in editor
- Plugin state tracks: `{ open, mode, streaming, anchor_pos, original_doc, ai_range_from, ai_range_to }`
- Decorations: highlight on AI-inserted range, animated dot at stream end
- Transaction metadata: `ai_menu_open`, `ai_menu_close`, `ai_accept`, `ai_reject`

**Menu modes** (matching mdit's three-state model):
- `cursor_command`: no selection → "Continue writing", "Summarize", "Expand"
- `selection_command`: text selected → "Improve", "Simplify", "Fix grammar", "Translate"
- `cursor_suggestion`: AI has returned text → "Accept", "Discard", "Try again"

### Floating Menu UI

```
src/lib/features/editor/ui/
├── ai_inline_menu.svelte            # NEW: floating popover component
```

Uses existing `@floating-ui/dom` (already installed) + `suggest_dropdown_utils.ts` patterns:
- `create_cursor_anchor(view)` for positioning
- `position_suggest_dropdown()` for flip/shift
- `mount_dropdown()` / `destroy_dropdown()` for lifecycle
- `attach_outside_dismiss()` for click-away

UI structure:
```
<div class="ai-inline-menu">
  {#if streaming}
    <LoadingBar /> (animated progress with "Writing..." text)
  {:else}
    <textarea /> (prompt input, auto-expand, Shift+Enter for newlines)
    <ModelSelector /> (dropdown from vault AI settings)
    <SubmitButton /> (ArrowUp icon, Cmd+Enter shortcut)
    <CommandList /> (filtered by menu mode)
  {/if}
</div>
```

### Editor Extension: `ai_inline_extension.ts`

```
src/lib/features/editor/extensions/
├── ai_inline_extension.ts           # NEW: thin wiring into assemble_extensions()
```

---

## Streaming Flow

1. User presses `Cmd+J` → plugin opens menu, anchored below selection/cursor
2. User types prompt or picks command → `ai.execute_inline` action fires
3. Action calls `AiService.stream_inline()` which:
   a. Snapshots current doc state (for reject/undo)
   b. Builds system + user prompt via `build_ai_prompt()`
   c. Calls `ai_stream_port.stream_text()`
   d. For each chunk: dispatches ProseMirror transaction inserting text at tracked position
4. During streaming: highlight decoration on AI range, dot cursor at end
5. On complete: menu switches to `cursor_suggestion` mode (Accept/Discard/Try again)
6. Accept: removes AI mark, keeps text, closes menu
7. Reject: replaces doc with snapshot, closes menu

---

## Decoration Strategy

- **AI text mark**: New ProseMirror mark `ai_generated` in schema — applied during streaming
- **Highlight**: Inline decoration from plugin matching `ai_generated` mark
  - `background: oklch(0.93 0.03 250)` (blue tint, matches Carbide's OKLCH palette)
  - Subtle, no colored text (respects Carbide's design language)
- **Stream cursor**: Widget decoration at end of AI range — small animated dot
  - CSS `@keyframes pulse` on a 10×10px circle
- On accept: remove all `ai_generated` marks from the range
- On reject: restore snapshot doc

---

## Service Layer

```ts
// In ai_service.ts — new method
async stream_inline(input: AiInlineRequest): AsyncGenerator<AiStreamChunk> {
  const prompt = build_ai_prompt({ mode: input.mode, ... });
  yield* this.ai_stream_port.stream_text({ ... });
}
```

---

## Actions

New actions in `ai_actions.ts`:

| Action ID | Purpose |
|---|---|
| `ai.open_inline_menu` | Open inline AI menu (Cmd+J handler) |
| `ai.execute_inline` | Start streaming with current prompt |
| `ai.accept_inline` | Accept AI text, remove marks |
| `ai.reject_inline` | Reject AI text, restore snapshot |
| `ai.close_inline_menu` | Close menu without accepting |

---

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/features/ai/adapters/ai_stream_adapter.ts` | Custom fetch+SSE streaming adapter (~150 lines) |
| `src/lib/features/ai/domain/ai_stream_types.ts` | Streaming types (AiStreamPort, AiStreamRequest, AiStreamChunk) |
| `src/lib/features/editor/adapters/ai_menu_plugin.ts` | ProseMirror plugin (keymap, state, decorations) |
| `src/lib/features/editor/ui/ai_inline_menu.svelte` | Floating menu UI component |
| `src/lib/features/editor/extensions/ai_inline_extension.ts` | Extension wiring |
| `tests/unit/adapters/ai_menu_plugin.test.ts` | Plugin tests |
| `tests/unit/adapters/ai_stream.test.ts` | Streaming adapter tests |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/features/ai/ports.ts` | Add `AiStreamPort` interface |
| `src/lib/features/ai/index.ts` | Re-export new types |
| `src/lib/features/ai/application/ai_service.ts` | Add `stream_inline()` method + `ai_stream_port` dep |
| `src/lib/features/ai/application/ai_actions.ts` | Register new inline AI actions |
| `src/lib/features/ai/domain/ai_prompt_builder.ts` | Add inline AI prompt templates |
| `src/lib/features/editor/adapters/schema.ts` | Add `ai_generated` mark spec |
| `src/lib/features/editor/extensions/index.ts` | Register `create_ai_inline_extension()` |
| `src/lib/app/di/create_app_context.ts` | Wire `AiStreamPort` adapter |
| `src/styles/editor.css` | AI highlight + cursor animation styles |

## No New Dependencies

Zero new npm packages. The streaming adapter uses native `fetch()`, `ReadableStream`, `TextDecoder`, and `AbortController` — all available in WebKit/Tauri webview.

---

## Reusable Existing Code

- `suggest_dropdown_utils.ts` — `create_cursor_anchor`, `position_suggest_dropdown`, `mount_dropdown`, `destroy_dropdown`, `attach_outside_dismiss`
- `floating_toolbar_utils.ts` — additional floating UI patterns
- `build_ai_prompt()` from `ai_prompt_builder.ts` — XML prompt construction
- `AiProviderConfig`, `AiProviderId` types from `ai_types.ts` — reuse for stream adapter config
- `slash_command_plugin.ts` — reference for ProseMirror plugin + dropdown pattern
- `callout_view_plugin.ts` — reference for node view with custom rendering

---

## Implementation Order

1. **Types + Port** — `ai_stream_types.ts`, `AiStreamPort` in `ports.ts`
2. **Stream Adapter** — `ai_stream_adapter.ts` with fetch+SSE
3. **Schema** — Add `ai_generated` mark to ProseMirror schema
4. **Plugin** — `ai_menu_plugin.ts` with keymap, state, decorations
5. **Menu UI** — `ai_inline_menu.svelte` floating component
6. **Extension** — `ai_inline_extension.ts` wiring
7. **Service** — `stream_inline()` in `ai_service.ts`
8. **Actions** — Register inline AI actions
9. **DI** — Wire in `create_app_context.ts`
10. **CSS** — AI highlight + animation styles
11. **Tests** — Plugin behavior + streaming adapter

---

## Verification

1. `pnpm check` — TypeScript/Svelte type checking passes
2. `pnpm lint` — Layering lint passes (stream adapter is in adapters/, service doesn't import it directly)
3. `pnpm test` — All existing + new tests pass
4. `cd src-tauri && cargo check` — Rust unchanged, should pass
5. Manual: Open editor → Cmd+J → see floating menu → type prompt → observe streaming text insertion with highlight → accept/reject works
