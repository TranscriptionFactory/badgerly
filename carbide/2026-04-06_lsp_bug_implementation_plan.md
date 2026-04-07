# LSP & Bug Fix Implementation Plan

Date: 2026-04-06
Source: synthesis of `2026-04-06_CARBIDE_BUG_REPORT.md` and `2026-04-06_LSP_IMPLEMENTATION_PLAN.md`

## Bug-to-Phase Mapping

| Bug                             | LSP Phase  | Notes                                       |
| ------------------------------- | ---------- | ------------------------------------------- |
| BUG-009 (LSP startup fails)     | Phase 4, 5 | Transport diagnostics + vault-aware startup |
| BUG-005 (IWES packaging)        | Phase 3    | Toolchain registry fix                      |
| BUG-010 (lint lifecycle)        | Phase 8    | Idempotent close                            |
| BUG-006 (link/image corruption) | Phase 7    | Feature gating by provider health           |
| BUG-001 (link substitution)     | Phase 7    | May be provider-state dependent             |
| BUG-008 (toolbar sync)          | Phase 7    | Action routing audit needed                 |
| BUG-002 (inline embedding)      | Phase 6, 7 | Revisit after lifecycle + gating            |
| BUG-003, 004, 007               | None       | Pure editor UX, independent of LSP          |

## Two Failure Clusters

The bug report identifies two failure clusters that the LSP plan addresses.

**Cluster 1 — Infrastructure** (BUG-005, BUG-009, BUG-010): packaging gaps, LSP startup fragility, lint lifecycle noise. Addressed by Phases 3–5 and 8.

**Cluster 2 — Editor actions** (BUG-001, BUG-006, BUG-008): link corruption, action routing, toolbar sync regressions. Addressed by Phase 7, but only diagnosable after Cluster 1 is fixed. Many "editor bugs" may resolve once features stop firing against dead or degraded LSP sessions.

## Execution Order

### Wave 1 — Foundation (unblocks everything else) ✅ COMPLETE

**Phase 1+2: Typed session model + provider resolution separation** ✅

Implemented on branch `feat/wave-1-lsp-typed-session-lint-lifecycle`.

Done:

- `MarkdownLspStatus` enum in Rust (`Starting | Running | Restarting{attempt} | Stopped | Failed{message}`) with serde serialization matching lint's pattern
- `MarkdownLspProvider` enum (`Iwes | Marksman`) with capabilities, moved to `types.rs`
- `MarkdownLspEvent` typed enum replaces old `MarksmanEvent` with string status
- `MarkdownLspDiagnostic` moved from service.rs inline to types.rs
- Provider resolution extracted to `provider.rs` module (`resolve_markdown_lsp_startup`, `ensure_iwe_config`, preflight)
- TypeScript `MarkdownLspStatus` union type matches Rust serde format (`{ restarting: { attempt } }`, `{ failed: { message } }`)
- Store: removed separate `error` field, initial status `"stopped"` (was `"idle"`), added `is_running` derived
- Service: typed status passthrough replaces fragile string matching, `handle_status_change` now a one-liner
- Helper functions: `is_markdown_lsp_running`, `is_markdown_lsp_failed`, `markdown_lsp_error_message`
- Tests: restarting propagation, failed on start, reset to stopped on stop

Deferred to Wave 2+:

- Provider capability table for frontend feature gating (Phase 7 dependency)
- Fallback reason recording in status (needs Phase 4 transport diagnostics first)

Files changed:

- `src-tauri/src/features/markdown_lsp/types.rs`
- `src-tauri/src/features/markdown_lsp/service.rs`
- `src-tauri/src/features/markdown_lsp/provider.rs` (new)
- `src-tauri/src/features/markdown_lsp/mod.rs`
- `src/lib/features/markdown_lsp/types.ts`
- `src/lib/features/markdown_lsp/state/markdown_lsp_store.svelte.ts`
- `src/lib/features/markdown_lsp/application/markdown_lsp_service.ts`
- `src/lib/features/markdown_lsp/index.ts`
- `src/lib/reactors/backlinks_sync.reactor.svelte.ts`
- `tests/unit/services/markdown_lsp_service.test.ts`
- `tests/unit/reactors/backlinks_sync_reactor.test.ts`

**Phase 8: Lint lifecycle idempotent close (BUG-010)** ✅

Done:

- `lint_close_file` returns `Ok(())` when no session exists (was erroring)
- Frontend `notify_file_closed` already guarded by `is_running` check
- Tests: close when not running is no-op, close when running calls port

Files changed:

- `src-tauri/src/features/lint/mod.rs`
- `tests/unit/services/lint_service.test.ts`

BDD scenarios:

- Close after stop does not log error
- Double close does not log error or recreate state

### Wave 2 — Startup reliability (P0 bugs)

**Phase 3: IWES packaging (BUG-005)**

Requires decision: bundle as sidecar (Option A) or auto-download (Option B).

- Populate `platform_binaries` for IWES in toolchain registry
- Validate binary resolution in packaged builds
- Add release validation for Marksman and IWES presence

Files:

- `src-tauri/src/features/toolchain/registry.rs`
- possibly `src-tauri/src/features/toolchain/downloader.rs`
- release/build config

BDD scenarios:

- Packaged build resolves IWES without PATH dependency
- Missing IWES in release produces explicit install guidance and stable fallback

**Phase 4: Transport diagnostics (BUG-009 root cause)**

- Add distinct error classes: spawn failure, init timeout, init EOF, stderr fatal during init, request timeout, process exited after running, unsupported method
- Capture recent stderr in bounded ring buffer, attach to init failures
- Add dedicated init timeout separate from per-request timeout

Files:

- `src-tauri/src/shared/lsp_client/types.rs`
- `src-tauri/src/shared/lsp_client/transport.rs`
- `src-tauri/src/shared/lsp_client/restartable.rs`
- `src-tauri/src/features/markdown_lsp/service.rs`

BDD scenarios:

- Server exits before init response → init EOF classification
- Server writes fatal stderr before exit → failed status includes stderr excerpt
- Repeated crashes exhaust restarts → final failed state is stable and visible

**Phase 5: Vault-aware startup safeguards (BUG-009 iCloud mitigation)**

Investigation-first: the failing path (`Library/Mobile Documents/com~apple~CloudDocs/...`) contains spaces. Before adding vault-size heuristics, determine whether the root cause is:

- Space-in-path or `%`-encoding mishandling in LSP transport or Marksman CLI invocation
- Actual vault scanning timeout on large/cloud-backed directories
- Both

Then:

- Fix path handling if that's the issue (likely transport or process spawn layer)
- If vault size is also a factor: detect risky characteristics (cloud-backed paths, large file counts) and enter degraded state instead of retry storm
- Skip retry storms after classified init failure regardless of cause

Files:

- `src-tauri/src/shared/lsp_client/transport.rs` (path encoding investigation)
- `src-tauri/src/features/markdown_lsp/service.rs`
- possibly shared vault/path helpers

BDD scenarios:

- Vault path with spaces → LSP starts normally (no encoding corruption)
- Cloud-backed vault + Marksman init failure → no retry storm, stable degraded state
- Local minimal vault → normal startup path unchanged

### Wave 3 — Lifecycle and feature correctness (P0/P1 bugs)

**Phase 6: Complete markdown document lifecycle**

- Add `markdown_lsp_did_close` end to end (Tauri command, port, adapter, service)
- Invoke on editor teardown / note switch / vault stop
- Clear local document version tracking on close

Files:

- `src-tauri/src/features/markdown_lsp/service.rs`
- `src/lib/features/markdown_lsp/ports.ts`
- `src/lib/features/markdown_lsp/adapters/markdown_lsp_tauri_adapter.ts`
- `src/lib/features/markdown_lsp/application/markdown_lsp_service.ts`

BDD scenarios:

- Open → change → close clears local version, sends didClose once
- Close after stop is a safe no-op

**Phase 7: Gate editor features by provider health (BUG-006, BUG-001, BUG-008)**

This is where the action-routing audit happens. Uses the typed LSP state from Phase 1 to gate behavior.

- Only request completions when `completion` capability is active
- Only show code-action affordances when provider is running and supports them
- Surface fallback/degraded indicators near affected UI
- Avoid invoking link/code-action flows against dead or restarting sessions

Files:

- `src/lib/features/editor/adapters/lsp_code_action_plugin.ts`
- `src/lib/features/editor/adapters/lsp_completion_plugin.ts`
- `src/lib/features/editor/extensions/lsp_extension.ts`
- `src/lib/features/markdown_lsp/state/markdown_lsp_store.svelte.ts`

BDD scenarios:

- Restarting session suppresses code-action requests
- Degraded Marksman session allows supported read-only features, unsupported actions hidden

### Wave 4 — Verification

**Phase 9: Reliability tests and release checks**

Backend tests: provider planning, fallback reason classification, init failure classification, didClose, restart exhaustion, lint idempotent close.

Frontend tests: typed status handling, degraded/running/fallback UI transitions, version tracking across open/change/close, feature gating by capability and health.

Release checks: script or CI that confirms Marksman resolvable, IWES resolvable or explicitly absent, startup works on smoke-test vault.

### Wave 5 — Independent UX (P2, parallelizable)

BUG-003 (collapsible heading Return behavior), BUG-004 (code fence selection scrolling), BUG-007 (escaped characters in source mode) are pure editor UX issues with no LSP dependency. They can be fixed at any time in parallel with the waves above.

## Decisions (Resolved)

1. **IWES distribution — Auto-download (Option B), using upstream binaries.** The `ToolSpec` for IWES already exists in `registry.rs` with the same shape as Marksman and rumdl — just needs `platform_binaries` populated. The vendored fork (`vendor/iwe` at `716ca28`) added `#[serde(default)]` to handle partial config files, but this is unnecessary: Carbide controls config generation and should always write complete config files. IWES is also manually restartable (no auto-retry), so a config error is recoverable. Use upstream releases directly; drop the vendored submodule dependency.
2. **Restart exhaustion — Stay manually restartable but visibly failed.** After exhausting retries, enter a stable `failed` state. User can manually trigger restart, but no automatic retry storm.
3. **Cloud-backed vaults — Investigate root cause first.** The failing path (`/Users/.../Library/Mobile Documents/com~apple~CloudDocs/...`) contains spaces. The real issue may be space-in-path or `%`-encoding handling in the LSP transport or Marksman, not vault size. Phase 5 should start with a path-encoding investigation before adding vault-size heuristics.
4. **BUG-007 — Deferred.** Investigation postponed; not blocking any LSP work.

## Gaps Not Covered

- No telemetry/metrics for LSP health in production
- BUG-002 (inline embedding) has the weakest diagnosis — may need its own investigation spike after Wave 2

## Acceptance Criteria

**Reliability**: LSP starts on minimal local vaults. Missing IWES is not a random runtime failure. Fallback to Marksman is explicit. Marksman init failure does not produce opaque retry noise.

**Product**: UI distinguishes starting / restarting / running / degraded / stopped / failed. Editor features enabled only when supported and healthy. Lint close-file errors disappear during normal teardown.

**Engineering**: Fallback and failure reasons are typed, not inferred from log strings. Automated coverage for startup planning and lifecycle edges. Release validation includes tool resolution and LSP smoke checks.
