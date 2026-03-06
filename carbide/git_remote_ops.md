# Git Remote Operations — Implementation Log

Ported from `scratch` project's CLI-based git module (scratch.md item 4).

## What was added

### Rust backend (`src-tauri/src/features/git/service.rs`)

**New struct:**

- `GitRemoteResult { success, message, error }` — response type for all remote ops

**New Tauri commands (CLI-based, not git2):**

- `git_push` — push to tracked upstream
- `git_fetch` — fetch with `--quiet`
- `git_pull` — pull with `pull.rebase=false`
- `git_add_remote` — add origin with URL validation (https/http/git@)
- `git_push_with_upstream` — `push -u origin <branch>` for first push

**Why CLI instead of git2:**
git2's remote auth requires complex callback setup for SSH keys and credential helpers. The CLI naturally uses the user's configured auth. Local ops (status, commit, diff, log) remain on git2.

**Network resilience:**
All remote commands set `http.lowSpeedLimit=1000`, `http.lowSpeedTime=10`, and `GIT_SSH_COMMAND="ssh -o ConnectTimeout=10"`.

**Error parsing:**

- `parse_remote_error` — auth failures, DNS resolution
- `parse_push_error` — repo not found
- `parse_pull_error` — uncommitted changes, merge conflicts, diverged histories, unrelated histories

**Cross-platform:** Windows gets `CREATE_NO_WINDOW` flag on all git CLI calls.

**Extended `GitStatus`:**
Added `has_remote: bool`, `has_upstream: bool`, `remote_url: Option<String>` — populated via git2's `find_remote("origin")`.

### TypeScript frontend (full port/adapter stack)

| Layer   | File                            | Changes                                                                                       |
| ------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| Types   | `types/git.ts`                  | Added `GitRemoteResult`, extended `GitStatus` with `has_remote`, `has_upstream`, `remote_url` |
| Port    | `ports.ts`                      | 5 new methods: `push`, `fetch`, `pull`, `add_remote`, `push_with_upstream`                    |
| Adapter | `adapters/git_tauri_adapter.ts` | IPC implementations for all 5 commands                                                        |
| Service | `application/git_service.ts`    | `push()`, `pull()`, `fetch_remote()`, `add_remote(url)`, `sync()`                             |
| Store   | `state/git_store.svelte.ts`     | 3 new state fields, updated `set_status()` and `reset()`                                      |
| Barrel  | `index.ts`                      | Exports `GitRemoteResult`                                                                     |

**Service behavior:**

- `push()` — auto-detects upstream; uses `push_with_upstream` on first push
- `pull()` — sets sync_status to "pulling", refreshes status after
- `fetch_remote()` — lightweight, no sync_status change
- `add_remote(url)` — validates and adds origin
- `sync()` — convenience: commit dirty changes + pull + push

### Tests updated

- `tests/adapters/test_git_adapter.ts` — added 5 new port method stubs
- `tests/unit/services/git_service.test.ts` — added mock port methods
- `tests/unit/stores/git_store.test.ts` — updated `set_status()` call sites
- `tests/unit/actions/register_git_actions.test.ts` — updated `set_status()` call sites

## What's left (not in scope)

- **UI for remote operations** — no push/pull/sync buttons or remote setup dialog yet
- **Action registry entries** — `git_push`, `git_pull`, `git_sync` actions not registered
- **Hotkeys** — no default bindings for remote ops
- **Periodic fetch** — no background polling for upstream changes

## Commit

`65001fe` on `fix/browse-mode-switch-freeze`
