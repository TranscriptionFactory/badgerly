# Merge & Stabilization Plan

**Date:** 2026-04-06
**Inputs:**
- `2026-04-06_branch_ancestry_and_merge_order.md` — branch topology (partially incorrect, corrected below)
- `2026-04-06_extended_tools_branch_audit.md` — audit of feat/extended-tools
- `2026-04-06_mcp_transports_terminal_plan.md` — MCP transport improvements + terminal bugs
- `2026-04-06_floating_toolbar_review.md` — formatting toolbar bugs

---

## Corrected Branch Topology

The ancestry doc states `feat/editor-drag-blocks` branched directly from `main`. This is wrong. It branched from `feat/extended-tools`:

```
main (39cab98d)  ←  1 commit ahead of extended-tools (agent automation docs)
  ↑
ff7fb7b1 (feat/extended-tools HEAD = merge base)
  ↑
feat/extended-tools  ←  72 commits above d6a4759 (original main)
  └─ feat/editor-drag-blocks  ←  9 commits on top
```

This means merging `feat/extended-tools` into main is NOT a fast-forward — main has diverged by 1 commit. It's a trivial merge commit (docs only), but not a fast-forward.

`feat/editor-drag-blocks` includes all `feat/extended-tools` commits plus its own 9. After `feat/extended-tools` is merged, `feat/editor-drag-blocks` becomes a simple 9-commit delta.

---

## Phase 1: Merge the Stack

**Decision: Merge everything.** The audit flagged plugin hardening and block embeddings as premature, but they are baked into the linear stack. Excising them via interactive rebase across 72 commits is more risk than keeping them. Refactoring happens post-merge.

### Commands

```bash
# 1. Ensure working tree is clean
git status

# 2. Merge the full feature stack into main
git checkout main
git merge feat/extended-tools -m "Merge feat/extended-tools: MCP server, HTTP API, CLI, smart links, plugin hardening, block embeddings, extended tools (Steps 1-12)"

# 3. Verify
pnpm check && pnpm lint && pnpm test
cd src-tauri && cargo check && cd ..

# 4. Merge editor drag blocks
git merge feat/editor-drag-blocks -m "Merge feat/editor-drag-blocks: block detection plugin + drag-and-drop (Step 13)"

# 5. Verify again (check for conflicts in extensions/index.ts, editor.css)
pnpm check && pnpm lint && pnpm test

# 6. Cleanup stale branch
git branch -d feat/smart-linking-plan

# 7. Cleanup merged stack branches (all contained in main now)
git branch -d feat/mcp-stdio feat/metadata-headings-cmd feat/metadata-foundations \
  feat/metadata-enrichment feat/smart-linking feat/http-cli feat/metadata-file-cache \
  feat/plugin-hardening feat/block-embeddings feat/extended-tools feat/editor-drag-blocks
```

### Expected Conflicts

The `feat/extended-tools` merge may conflict on files modified by `39cab98d` (agent automation docs). Likely trivial — docs-only.

The `feat/editor-drag-blocks` merge should be clean (it's a superset of `feat/extended-tools`), but watch `extensions/index.ts` for adjacent import conflicts.

---

## Phase 2: Bug Fixes (High Impact, Small Effort)

These fix real user-facing bugs. Ship before any refactoring.

### 2a. Terminal Bugs — 1 session, ~6 files

**Source:** `2026-04-06_mcp_transports_terminal_plan.md` → "Terminal Bug Fixes"
**Branch:** `fix/terminal-session-lifecycle`

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Tab switch destroys xterm instance, loses scrollback | `terminal_panel_content.svelte:155-159` | Remove `{#if}` guard — render all sessions, control visibility via `active` prop |
| 2 | `fixed_cwd` ignores stored session cwd | `terminal_session_view.svelte:39-44` | Read `session?.cwd` instead of always using vault path |
| 3 | Toggle/close kills all PTY processes | `terminal_actions.ts`, `terminal_store.svelte.ts` | Split `close()` into `hide()` (panel only) and `reset()` (destructive) |
| 4 | `reconcile_session` respawns manual-policy sessions | `terminal_service.ts:202-216` | Check `respawn_policy` before killing process |

### 2b. Floating Toolbar Fixes — 1 session, ~4 files

**Source:** `2026-04-06_floating_toolbar_review.md`
**Branch:** `fix/formatting-toolbar`

| # | Fix | Severity | Approach |
|---|-----|----------|----------|
| 1 | Strip `on_select` mode + all floating positioning code | High | Remove `create_anchor`, `backdrop_el`, `compute_floating_position`, the entire `on_select` branch |
| 2 | Fix stale view capture in Svelte mount | High | Pass `() => toolbar_view` getter instead of `view` directly |
| 3 | Use `wrapIn` for blockquote | Medium | Replace `setBlockType(blockquote)` with `wrapIn(blockquote)` |
| 4 | Use `wrapInList` for bullet/ordered lists | Medium | Replace manual list construction with `wrapInList` from prosemirror-schema-list |
| 5 | Replace `prompt()` with command event pattern | Medium | Gate link/image behind `is_command_available: false` until async input UI built |
| 6 | Remove `on_select` from `ToolbarVisibility` type | Cleanup | Remove the enum value, update settings type |

---

## Phase 3: Audit Refactoring

**Source:** `2026-04-06_extended_tools_branch_audit.md` → "Refactoring Roadmap"

Work in priority order. Each item is a separate branch.

### 3a. Extract shared service wrappers — `refactor/shared-ops`

**Priority 1 from audit. Highest-leverage refactor.**

Create `src-tauri/src/features/mcp/shared_ops.rs`:
- Extract vault path resolution + service call patterns from both `cli_routes.rs` and `tools/*.rs`
- Each shared op returns a structured result type
- MCP tools format as `ToolResult` text
- CLI routes return as JSON

Simultaneously:
- Add Axum auth middleware layer to the CLI router (kills 30+ copy-pasted `check_auth` calls)
- Consolidate overlapping param structs between `cli_routes.rs` and `tools/*.rs`

**Expected outcome:** `cli_routes.rs` shrinks significantly; `tools/*.rs` shrinks moderately; new `shared_ops.rs` is ~300-400 lines of clean service wrappers.

### 3b. DRY fixes — `refactor/mcp-dry`

Small, low-risk:
- Extract `prop()` helper to `tools/mod.rs` (currently copy-pasted in 7 modules)
- Extract `VaultArgs` to `tools/mod.rs` (duplicated in git.rs, graph.rs)
- Remove unused `SmartLinkRule.config` field from Rust types + TS types
- Consolidate `HttpServerState` three mutexes → single `Arc<Mutex<ServerInner>>`

### 3c. Stdio transport decision — `refactor/stdio-cleanup` or `feat/mcp-stdio-proxy`

**Choose one:**

**Option A — Remove unreachable stdio code (~340 lines):**
If the stdio proxy from the transports plan (Phase 4 below) replaces the in-process stdio transport, remove `server.rs`, `transport.rs`, and the unreachable `mcp_start`/`mcp_stop`/`mcp_status` Tauri commands. The CLI proxy approach makes the in-process transport unnecessary.

**Option B — Keep for future use:**
If in-process stdio is still desired (e.g., for a future non-Tauri binary), keep but document why it's currently unreachable.

**Recommendation: Option A.** The CLI proxy (`carbide mcp`) from Phase 4 is the right stdio solution — it avoids the Tauri stdout capture problem entirely.

---

## Phase 4: MCP Transport Improvements

**Source:** `2026-04-06_mcp_transports_terminal_plan.md` → Parts 1-3
**Depends on:** Phase 1 (merge), Phase 3a nice-to-have but not blocking

### 4a. Streamable HTTP — `feat/mcp-streamable-http`

Single Rust session. Adds SSE response support to existing `/mcp` POST handler:
- Branch on `Accept: text/event-stream` header
- `Mcp-Session-Id` header on initialize
- GET `/mcp` stub (empty SSE stream for spec compliance)
- Update Desktop config to include `"type": "http"`

### 4b. stdio via CLI proxy — `feat/mcp-stdio-proxy`

Single Rust session. Adds `carbide mcp` subcommand:
- Reads stdin line-by-line, POSTs to `/mcp`, writes response to stdout
- `ensure_running_with_timeout` extraction (30s for cold launch)
- Update Desktop setup to write stdio config (`"command": "/usr/local/bin/carbide", "args": ["mcp"]`)
- Add `carbide setup desktop` / `carbide setup code` CLI commands

### 4c. CLI polish (fold into 4a/4b sessions)

- `carbide status` shows MCP server address + CLI install state
- `SetupStatus.cli_installed` field

---

## Phase 5: carbide-lite Rebase

**Source:** `2026-04-06_branch_ancestry_and_merge_order.md` → "Phase 4 — Integrate carbide-lite"
**Depends on:** Phases 1-4 complete (main is stable with all features)

```bash
git rebase main carbide-lite
```

Expect ~10-15 conflicts concentrated in `create_app_context.ts`, `reactors/index.ts`, `app/mod.rs`, `Cargo.toml`. Pattern: new features go into full entrypoint path, lite path unchanged, new Rust modules gated behind `#[cfg(not(feature = "lite"))]`.

---

## Ordering Summary

```
Phase 1: Merge stack + drag blocks into main          ← do first, unblocks everything
  │
  ├─ Phase 2a: Terminal bug fixes                      ← high impact, independent
  ├─ Phase 2b: Floating toolbar fixes                  ← high impact, independent
  │
  ├─ Phase 3a: Extract shared service wrappers         ← biggest tech debt item
  ├─ Phase 3b: DRY fixes                               ← small, can parallelize
  ├─ Phase 3c: Stdio cleanup (remove dead code)        ← quick if doing 4b
  │
  ├─ Phase 4a: Streamable HTTP                         ← independent of 3
  ├─ Phase 4b: stdio CLI proxy                         ← depends on 4a
  │
  └─ Phase 5: carbide-lite rebase                      ← after main is stable
```

Phases 2a, 2b, 3a, 3b can all run in parallel. Phase 4 can start as soon as Phase 1 is done. Phase 5 waits for everything else.
