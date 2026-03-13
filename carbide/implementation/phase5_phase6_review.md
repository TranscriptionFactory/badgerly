# Phase 5 & 6 Implementation Review

Review of `phase5_plugin_host_implementation.md` (Plugin Host) and `phase6_canvas.md` (Canvas) against the current codebase, `carbide/plugin_system.md`, `docs/architecture.md`, and `carbide/TODO.md`.

---

## Phase 5: Plugin Host

### Correctness bugs in current code

1. **Rust `plugin_discover` ignores managed state.** `src-tauri/src/features/plugin/mod.rs:13-15` accepts `_state: State<'_, PluginService>` but constructs a new `PluginService::new()` instead of using the managed instance. Must use `state.discover(...)`.

2. **Rust unused import.** `src-tauri/src/features/plugin/service.rs:1` imports `PathBuf` but only `Path` is used. `cargo check` will warn.

3. **Rust manifest validation too permissive.** `service.rs:44` — `load_manifest` swallows all serde errors via `.ok()`. A malformed manifest is indistinguishable from a missing one. Return a richer result or log the parse error so users can diagnose bad manifests.

4. **Status bar item mutation bypasses reactivity.** `plugin_rpc_handler.ts:182-184` mutates `item.props` directly on the object inside the `SvelteMap` without going through a store method. The `SvelteMap` does not know its value changed, so Svelte 5 reactivity will not propagate. Fix: add an `update_status_bar_item(id, props)` method on `PluginStore` that deletes and re-sets the entry.

5. **`unload_plugin` iterates derived getters while mutating.** `plugin_service.ts:83-93` reads `this.store.commands` (a getter that creates a new array from the map) and then deletes entries. Currently safe because the getter snapshots, but fragile — a refactor returning the live iterator would break. Collect IDs into a `Set` first, then delete.

6. **Frontend `PluginInfo` missing `path`.** Rust `PluginInfo` in `types.rs` includes `path: String`, but the frontend `PluginInfo` in `ports.ts` does not. Discovery returns `PluginManifest[]` not `PluginInfo[]`, so the plugin's filesystem path is lost — needed later for iframe loading in Milestone 3.

### Security gaps

7. **Iframe origin validation is TODO.** `plugin_iframe_host.svelte:27-28` has a commented-out origin check. The custom `otterly-plugin://` protocol must be registered as a Tauri custom protocol. Without it the postMessage bridge has no origin verification.

8. **`postMessage(message, "*")` is too permissive.** `plugin_iframe_host.svelte:61` sends to wildcard origin. Must be scoped to the plugin iframe's origin once the custom protocol is in place.

9. **No CSP on the iframe.** `sandbox="allow-scripts"` is good but the iframe should also carry a `csp` attribute to block network access unless the manifest declares `network:fetch`.

### Efficiency

10. **`status_bar_items` getter sorts on every access.** `plugin_store.svelte.ts:38-41` creates a new sorted array on each call. Use `$derived` to memoize if accessed by multiple reactive consumers.

11. **Command palette merge not wired.** The plan lists "dynamic command contribution registry" as Milestone 1, but the omnibar search still reads from the static `COMMANDS_REGISTRY` in `search_commands.ts`. The merge of `COMMANDS_REGISTRY` + `PluginStore.commands` must be verified before Milestone 1 is considered done.

### Missing from the plan

12. **`events` namespace.** `plugin_system.md` defines `events.on('file-change', cb)` and `events.on('active-file-change', cb)`. The RPC handler only has four namespaces (vault, editor, commands, ui). Events are critical for reactive plugins (word count needs `active-file-change`). Should be planned for Milestone 4.

13. **`settings` namespace.** `plugin_system.md` defines `settings.register(settingsTab)`. No milestone mentions plugin settings storage or UI.

14. **`metadata` namespace.** `plugin_system.md` defines `metadata.getFileCache(path)`. Phase 5 plan does not mention it. Should be called out explicitly as deferred to a later phase.

---

## Phase 6: Canvas

### Correctness

15. **Architecture alignment is strong.** Vertical slice with ports, store, service, adapter, and UI. Integration points match existing composition root files. Document viewer dispatch for `.canvas`/`.excalidraw` follows the established pattern.

16. **Canvas Reactor for rename-safe links is correct.** Follows the existing reactor pattern used by `LinksStore` and link repair.

### Underspecified areas

17. **Rendering approach unspecified.** The plan says "Svelte 5 renderer" but does not specify HTML+CSS transforms, SVG, or Canvas2D. For an infinite canvas with many nodes, this choice has major performance implications. Recommendation: HTML nodes with CSS transforms for text/note/file nodes (native text selection, easy styling) + SVG overlay for edges. This is the pattern used by React Flow and tldraw's HTML layer.

18. **Excalidraw bundling strategy missing.** Excalidraw is a React app (~500KB gzipped). The plan needs to address: vendored vs CDN, separate build entrypoint, and the bidirectional stateful postMessage bridge (more complex than the plugin RPC). Save debouncing must coordinate between the iframe and host to avoid data races.

19. **Missing: viewport/camera state.** The canvas store needs to track camera position (pan x/y, zoom level) to restore viewport on re-open.

20. **Missing: canvas creation flow.** "New Canvas" and "New Drawing" actions are mentioned but the file creation path is not defined. Should the service create an empty `.canvas` file with a valid schema (`{ "nodes": [], "edges": [] }`)? Should it prompt for a name? Must match the existing note creation UX.

21. **Missing: file path semantics for node references.** JSON Canvas spec uses a `file` field with a relative path. The plan mentions "resolve note paths" but does not specify whether paths are vault-relative, absolute, or wiki-link syntax. Obsidian uses vault-relative paths — matching this is important for interop.

22. **Search indexing underspecified.** Canvas text nodes should be full-text indexed, but note reference nodes should contribute to the backlinks graph. These are two different indexing concerns that should be separated.

23. **`link_parser.rs` changes underspecified.** The plan mentions updating the markdown link parser for rename-safety, but `.canvas` files are JSON, not markdown. This needs a separate JSON-aware link extractor, not a modification to the markdown parser.

24. **JSON Canvas spec version not pinned.** The spec (jsoncanvas.org) is stable but version-locking the parser prevents silent breakage on future spec changes.

### Security

25. **Excalidraw iframe CSP unspecified.** The Excalidraw iframe host should have the same sandboxing and CSP treatment as the plugin iframe host.

---

## Cross-cutting

26. **Shared iframe host primitive.** Phase 5 (plugin iframe) and Phase 6 (Excalidraw iframe) both use sandboxed iframes with postMessage bridges. Extract a shared `IframeHost` primitive before Phase 6 to avoid duplicating bridge logic, origin validation, and cleanup.

27. **Composition root growth.** Both phases register into the same four files (`create_app_stores.ts`, `app_ports.ts`, `create_prod_ports.ts`, `create_app_context.ts`). Not a problem yet, but worth noting if both features land simultaneously.

28. **TODO.md numbering.** Phase 5 in the implementation docs maps to "Phase 8: Plugin System" in `TODO.md`; Phase 6 (Canvas) maps to "Phase 9." Independent numbering is fine, but cross-references would help navigation.

---

## Priority actions

| Priority                   | Item                                                                                 | Location                                   |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Fix now                    | #1 — Use managed `PluginService` state instead of constructing new                   | `src-tauri/src/features/plugin/mod.rs`     |
| Fix now                    | #4 — Status bar item reactivity bypass                                               | `plugin_rpc_handler.ts:182-184`            |
| Fix now                    | #2 — Remove unused `PathBuf` import                                                  | `src-tauri/src/features/plugin/service.rs` |
| Before Milestone 3         | #6 — Add `path` to frontend `PluginInfo`                                             | `src/lib/features/plugin/ports.ts`         |
| Before Milestone 3         | #7, #8, #9 — Iframe origin validation, targeted postMessage, CSP                     | `plugin_iframe_host.svelte`                |
| Before Milestone 1 signoff | #11 — Wire command palette merge                                                     | `search_service.ts` / omnibar              |
| Plan update                | #12, #13, #14 — Add events, settings, metadata namespaces to milestones              | `phase5_plugin_host_implementation.md`     |
| Plan update                | #17-24 — Specify canvas rendering, bundling, creation flow, path semantics, indexing | `phase6_canvas.md`                         |
| Plan update                | #26 — Extract shared iframe host before Phase 6                                      | New shared component                       |
