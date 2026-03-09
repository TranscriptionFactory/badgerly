# Git Features Implementation Checklist

## Goal

Finish the still-pending Git/GitHub-adjacent product work from `carbide/` and fix the sluggish version-history open path without introducing architecture shortcuts.

## Architecture Constraints

Per `docs/architecture.md`:

- IO stays in ports/adapters
- async orchestration stays in services
- user-triggered behavior goes through the action registry
- ephemeral dialog state lives in `UIStore`
- persistent side effects belong in reactors

## Scope For This Pass

### In scope

- add remote UX
- fetch action + UI exposure
- omnibar/command-palette exposure for git remote ops
- hotkeys for remote ops
- version-history loading optimization

### Out of scope unless this work proves trivial

- periodic background fetch
- full remote-management settings page
- auto-commit settings and interval workflow

## Current State Summary

Already present:

- backend remote commands
- frontend port/adapter/service support for push, pull, fetch, add remote, push-with-upstream
- action ids for `git_push`, `git_pull`, `git_sync`, `git_add_remote`
- registered actions for push, pull, sync, add remote
- push/pull buttons and ahead/behind counts in `git_status_widget.svelte`

Still missing or incomplete:

- add-remote dialog and entry flow
- fetch exposure in UI
- command-palette entries for remote ops
- remote-op hotkeys
- version-history pagination/caching
- docs reconciliation because `carbide/TODO.md` and `carbide/git_remote_ops.md` are partly stale relative to code

## Phase 1 — Version History Performance

### Goal

Make the history dialog feel instant enough on open, especially for files with long commit history.

### Checklist

- [ ] Add history pagination contract to frontend
  - files:
    - `src/lib/features/git/ports.ts`
    - `src/lib/features/git/adapters/git_tauri_adapter.ts`
    - `src/lib/features/git/application/git_service.ts`
    - `src/lib/features/git/state/git_store.svelte.ts`
- [ ] Replace single `load_history(note_path, 50)` flow with initial page load
  - target initial page size: `20`
  - keep note-specific history support
- [ ] Add `load more history` action/service method
  - files:
    - `src/lib/app/action_registry/action_ids.ts`
    - `src/lib/features/git/application/git_actions.ts`
    - `src/lib/features/git/application/git_service.ts`
- [ ] Extend `GitStore` with pagination metadata
  - suggested fields:
    - `history_limit`
    - `has_more_history`
    - `is_loading_more_history`
    - cached key based on `note_path`
- [ ] Keep diff/file-content loading lazy on commit select
  - do not preload diffs for the entire history list
- [ ] Add UI affordance in `version_history_dialog.svelte`
  - initial loading state
  - incremental loading state
  - `Load more` button at timeline bottom
- [ ] Cache history per note path in service/store so reopening the dialog does not immediately refetch
- [ ] Invalidate history cache after git mutations
  - commit
  - restore
  - pull
  - push if status changes materially
  - sync

### Backend follow-up if needed

- [ ] If pagination + cache still feels slow, change note-specific history backend to a cheaper path
  - preferred fallback: CLI `git log --follow --max-count ... -- <file>`
  - file:
    - `src-tauri/src/features/git/service.rs`

## Phase 2 — Add Remote UX

### Goal

Let users configure a remote without needing payload hacks or hidden command execution.

### Checklist

- [ ] Add add-remote dialog state to `UIStore`
  - file:
    - `src/lib/app/orchestration/ui_store.svelte.ts`
  - suggested shape:
    - `open`
    - `url`
    - `submitting`
- [ ] Add dialog UI
  - files:
    - `src/lib/features/git/ui/add_remote_dialog.svelte`
    - `src/lib/app/bootstrap/ui/app_shell_dialogs.svelte`
- [ ] Add actions for:
  - open add-remote dialog
  - update remote URL input
  - confirm add remote
  - cancel add remote
  - files:
    - `src/lib/app/action_registry/action_ids.ts`
    - `src/lib/features/git/application/git_actions.ts`
- [ ] Use `GitService.add_remote(url)` from the confirm action
- [ ] After successful remote add:
  - close dialog
  - refresh git status
  - show success toast
- [ ] Add UX entry points:
  - button/state in `git_status_widget.svelte` when no remote exists
  - command-palette item

## Phase 3 — Fetch Exposure

### Goal

Expose fetch separately from pull so users can refresh remote state without merging.

### Checklist

- [ ] Add `git_fetch` action id
  - file:
    - `src/lib/app/action_registry/action_ids.ts`
- [ ] Register `Git Fetch` action
  - file:
    - `src/lib/features/git/application/git_actions.ts`
  - should call `services.git.fetch_remote()`
- [ ] Add toast handling for fetch result
- [ ] Expose fetch in UI
  - preferred place:
    - `git_status_widget.svelte`
  - alternative:
    - overflow/menu if status widget gets too busy
- [ ] Disable fetch while push/pull/sync is in progress

## Phase 4 — Omnibar + Hotkeys

### Goal

Make remote operations discoverable and keyboard-accessible.

### Checklist

- [ ] Extend command palette types
  - file:
    - `src/lib/features/search/types/command_palette.ts`
  - add ids for:
    - `git_push`
    - `git_pull`
    - `git_fetch`
    - `git_add_remote`
- [ ] Add command definitions
  - file:
    - `src/lib/features/search/domain/search_commands.ts`
- [ ] Map commands to action ids
  - file:
    - `src/lib/features/search/application/omnibar_actions.ts`
- [ ] Add default hotkeys for remote ops
  - file:
    - `src/lib/features/hotkey/domain/default_hotkeys.ts`
  - keep them conflict-safe and secondary to existing note/navigation bindings

## Phase 5 — Docs Reconciliation

### Goal

Bring the roadmap docs back in sync with actual implementation status.

### Checklist

- [ ] Update `carbide/TODO.md`
  - mark implemented backend/service/action/widget items complete
  - leave truly pending UI/history items unchecked
- [ ] Update `carbide/git_remote_ops.md`
  - remove stale note claiming push/pull/sync actions are not registered
  - document add-remote dialog / fetch / history pagination state after implementation

## Testing Checklist

- [ ] Unit tests for add-remote dialog actions
  - file:
    - `tests/unit/actions/register_git_actions.test.ts`
- [ ] Unit tests for `git_fetch` action
  - file:
    - `tests/unit/actions/register_git_actions.test.ts`
- [ ] Unit tests for command-palette mappings
  - file:
    - `tests/unit/actions/register_omnibar_actions.test.ts`
- [ ] Unit tests for history pagination/cache logic
  - files:
    - `tests/unit/services/git_service.test.ts`
    - `tests/unit/stores/git_store.test.ts`
- [ ] If backend history path changes, add Rust-side tests where practical

## Validation Checklist

- [ ] `pnpm check`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `cd src-tauri && cargo check`
- [ ] `pnpm format`

## Recommended Delivery Order

1. version-history pagination/cache
2. add-remote dialog
3. fetch action + widget exposure
4. omnibar entries
5. hotkeys
6. docs reconciliation
