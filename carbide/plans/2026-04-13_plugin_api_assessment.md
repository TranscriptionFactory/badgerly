# Plugin API Surface Assessment

**Date:** 2026-04-13 (updated with code audit)
**Goal:** Evaluate extensibility/efficiency/flexibility vs Obsidian plugin environment
See `carbide/research/plugin_obsidian.md` for original implementation planning

---

## Executive Summary

The current plugin architecture is **solid for a v1 system** and has matured beyond the original gap analysis. The iframe sandbox model is correct; the problem is API surface depth — but several gaps previously flagged are now resolved.

**Coverage:** ~35% of Obsidian's API surface by method count (up from ~30% at planning time).

**Key changes since initial assessment:**
- `metadata.getFileCache()` is **fully implemented** (Tauri → Rust → SQLite), returning frontmatter, tags, headings, links, embeds, stats, timestamps
- Events grew from 8 → **10** (`note-indexed`, `metadata-changed` added via reactors)
- Editor namespace has **5 methods** (undocumented `get_info` returns `{path, name}`)
- Slash command registration is **live** but was not listed in the original assessment
- SSRF protection includes DNS rebind checks (not just URL-level blocking)
- Origin allowlist enforcement on `network.fetch` (per-manifest `allowed_origins`)

---

## Architecture Overview

### Current Model

```
Plugin (iframe sandbox)
    │
    ▼
postMessage RPC
    │
    ▼
PluginRpcHandler (TypeScript)
    │
    ├─→ Services (note, editor, plugin)
    ├─→ Stores (notes, editor, tab)
    └─→ Backends (search, metadata, network, ai, diagnostics, mcp)
```

### Security Model

| Mechanism | Status | Implementation Detail |
|-----------|--------|----------------------|
| Iframe sandbox | ✅ Isolated DOM | Separate origin per plugin |
| Permission gates | ✅ Per-capability grants | `require_permission()` / `require_any_permission()` on every handler |
| Rate limiting | ✅ 100 RPC/60s per plugin | `PluginRateLimiter` with sliding window |
| SSRF protection | ✅ URL + DNS rebind checks | Rust-side `check_ssrf()` + `resolve_and_check()` + body size limit |
| Origin allowlist | ✅ Per-manifest `allowed_origins` | Enforced in `handle_network()` before fetch |
| Error tracking | ✅ Burst + consecutive detection | `≥2 in 5s` → warn, `≥5 in 15s` → auto-disable, `≥10 consecutive` → auto-disable |
| Event backpressure | ✅ Debounced + bounded queues | `MAX_PENDING_EVENTS=64`, debounce per-plugin |
| RPC timeout | ✅ Per-request timeout | `with_timeout()` wrapper |

This is **better than Obsidian** (binary restricted mode).

---

## What Works Well

| Area | Carbide | Obsidian | Verdict |
|------|---------|----------|---------|
| File CRUD | create/read/modify/delete/list | +rename/trash/createFolder/readBinary | ~85% |
| Editor basics | getValue/setValue/getSelection/replaceSelection/getInfo | Same 4 + cursor/line/range | ✅ Basics covered |
| Commands | register({id, label, description, keywords, icon}) | +checkCallback/editorCallback | ~70% |
| Slash commands | register_slash/remove_slash | N/A (Obsidian lacks this) | ✅ Carbide-unique |
| Status bar | text via RPC (add/update/remove) | raw HTMLElement | Functional |
| Notices | show_notice({message, duration}) | Notice() | ✅ Full |
| Settings | declarative schema (string/number/boolean/select/textarea) | imperative DOM | Different, works |
| Permissions | per-capability (17 grants) | binary | ✅ Better |
| Sidebar panels | add_sidebar_panel() | registerView() | Simpler |
| Ribbon | add_ribbon_icon() | addRibbonIcon() | ✅ Full |
| Metadata | query, listProperties, getBacklinks, getStats, getFileCache | MetadataCache (richer) | ⚠️ ~60% — see below |
| Search | fts(query, limit), tags(pattern?) | N/A (Obsidian relies on MetadataCache) | ✅ Carbide-unique |
| AI | execute({prompt, mode}) | N/A | ✅ Carbide-unique |
| Diagnostics | push(file, diagnostics[]), clear(file?) | N/A | ✅ Carbide-unique |
| MCP | list_tools, call_tool, register_tool | N/A | ✅ Carbide-unique |
| Network | fetch with origin allowlist + SSRF protection | requestUrl (no SSRF protection) | ✅ Better |

---

## Critical Gaps

### 1. Editor API — Too Shallow

**Current (5 methods):**
```js
carbide.editor.getInfo()           // → {path, name}
carbide.editor.getValue()          // → full markdown
carbide.editor.setValue(text)       // replaces entire doc
carbide.editor.getSelection()      // → selected text
carbide.editor.replaceSelection(text)
```

**Missing (Obsidian):**
```js
getCursor() / setCursor(pos)
getLine(n) / setLine(n, text)
getRange(start, end) / replaceRange(start, end, text)
scrollTo(line) / scrollIntoView(pos)
transaction(fn)  // direct CM6 access
editor.cm        // raw EditorView
```

**Impact:** No word counters, linters, inline field transformations, or cursor-aware plugins.

**Fixable:** Yes — needs position adapter `{line, ch}` ↔ ProseMirror `ResolvedPos`.

---

### 2. Markdown Processing — Not Implemented

**Missing:**
- `registerMarkdownCodeBlockProcessor(lang, handler)` — custom fenced code blocks
- `registerMarkdownPostProcessor(handler)` — post-process rendered HTML
- `MarkdownRenderChild` lifecycle

**Impact:** Blocks Dataview, Tasks, Admonitions, Mermaid — the highest-value Obsidian plugin category.

**Fixable:** Yes — host renders markdown, plugin post-processes via RPC.

---

### 3. Events — Growing but Still Sparse (10 vs 24+)

**Current (10):**
- file-created, file-modified, file-deleted, file-renamed
- active-file-changed, editor-selection-changed
- vault-opened, layout-changed
- note-indexed *(new — fires after search indexer processes a note)*
- metadata-changed *(new — fires on Tauri metadata-changed events with `{path, event_type, old_path?, vault_id}`)*

**Missing (high-value):**
| Event | Use Case |
|-------|----------|
| editor-change | Word count, linters |
| editor-paste | Paste-as-markdown, image uploaders |
| editor-drop | File drop handlers |
| file-menu / editor-menu | Context menu extensions |
| css-change | Theme-aware plugins |
| quick-preview | Hover preview |
| resize | Layout-responsive |
| quit | Cleanup on exit |

**Fixable:** Yes — emit more events from reactors.

---

### 4. Vault Operations — Minor Gaps

| Missing | Impact |
|---------|--------|
| vault.rename() | Can't rename files |
| vault.trash() | No soft-delete |
| vault.createFolder() | No directory creation |
| vault.readBinary() / modifyBinary() | No images/PDFs |
| vault.list(folder) | No folder scope (current `list` returns all paths) |
| getAbstractFileByPath() | No file metadata (stat, extension, basename) |

**Fixable:** Yes — add missing methods.

---

### 5. Workspace/Layout — Not Covered (By Design)

Obsidian has ~30 methods for leaf splitting, pinning, popouts, layout serialization.

**Assessment:** Different paradigm (tabs vs leaves). Hardest to shim.

---

### 6. Modals — Limited

Current: `ui.show_notice()` (toasts)

Missing: `Modal`, `SuggestModal<T>`, `FuzzySuggestModal<T>`

**Impact:** No fuzzy search pickers, interactive settings, or custom dialogs.

**Fixable:** Yes — add modal API with sandboxed iframe rendering.

---

### 7. Commands — Missing Variants

**Current:** `commands.register({id, label, description, keywords, icon})`

**Missing:**
- `checkCallback` — conditional availability
- `editorCallback(editor, ctx)` — editor-only commands
- `editorCheckCallback` — conditional + editor-only
- Hotkey binding

**Fixable:** Yes — add callback variants.

---

## ~~Previously Flagged as Gaps — Now Resolved~~

### metadata.getFileCache() — Implemented

`metadata.getFileCache(notePath)` is **fully wired** through the stack:

```
Plugin RPC → PluginRpcHandler.handle_metadata("getFileCache")
  → create_app_context wiring → search_port.get_file_cache(vault_id, path)
    → Tauri invoke("note_get_file_cache") → Rust FileCache struct
```

Returns `FileCache`:
```typescript
{
  frontmatter: Record<string, [string, string]>;  // key → [type, value]
  tags: string[];
  headings: CachedHeading[];       // {level, text, ...}
  links: CachedLink[];             // outgoing links
  embeds: CachedLink[];            // embedded files
  stats: NoteStats;                // word_count, char_count, heading_count,
                                   // outlink_count, reading_time_secs,
                                   // task_count, tasks_done, tasks_todo,
                                   // next_due_date, last_indexed_at
  ctime_ms: number;
  mtime_ms: number;
  size_bytes: number;
}
```

**Compared to Obsidian's `CachedMetadata`:** Missing `sections`, `listItems`, `blocks`, `footnotes`, `frontmatterLinks`, `resolvedLinks`/`unresolvedLinks` graph. But covers the most-used fields.

### metadata-changed Event — Implemented

The `plugin_metadata_events` reactor listens to Tauri `metadata-changed` events and emits them with a payload of `{path, event_type, old_path?, vault_id}`.

### note-indexed Event — Implemented

The `plugin_note_indexed` reactor fires after the search indexer processes a note.

---

## Comparison: Obsidian Plugin API

### Core Classes (~65 classes, ~80+ interfaces)

| Class | Key Methods | Carbide |
|-------|-------------|---------|
| Plugin | onload/unload, loadData/saveData | ✅ Lifecycle + settings persistence |
| Component | register, registerEvent, registerDomEvent | ❌ No DOM access (iframe) |
| Vault | create/read/modify/delete/rename/trash | ⚠️ Missing rename/trash/createFolder/binary |
| MetadataCache | getFileCache, resolvedLinks | ⚠️ getFileCache ✅, resolvedLinks ❌ |
| Editor | getValue/setValue + cursor/selection/scroll | ⚠️ Shallow (5 methods vs ~20) |
| FileManager | renameFile, trashFile, processFrontMatter | ❌ Missing |
| Workspace | getLeaf, createLeafBySplit, ... | ❌ Tabs vs leaves |
| Modal | open/close, SuggestModal, FuzzySuggestModal | ❌ Missing |

### Editor Extensions

| Obsidian | Carbide |
|----------|---------|
| registerEditorExtension() | ❌ |
| registerEditorSuggest() | ❌ |
| editor.cm (raw CM6) | ❌ (ProseMirror) |

---

## Verdict

### For Carbide-Native Plugins

**Good.** The core primitives work well, and several areas exceed Obsidian:
- Commands, settings, status bar, ribbon, sidebar panels
- File I/O (read/write/create/delete/list)
- Events (10 types with debounced delivery + backpressure)
- Metadata (query, backlinks, stats, **getFileCache with structured data**)
- Search (FTS + tag queries — Obsidian has no equivalent plugin API)
- AI, diagnostics, MCP integration — Carbide-unique capabilities
- Slash commands — Carbide-unique
- Network with SSRF protection + origin allowlist — better than Obsidian

### For Obsidian Parity

**~35% coverage.** The structural differences (ProseMirror vs CM6, tabs vs leaves) make full parity impossible, but the remaining gaps are fixable:

1. **`editor-change` event** — enables reactive plugins
2. **`vault.rename()`** — trivial add
3. **`registerMarkdownCodeBlockProcessor()`** — unlocks Dataview-class
4. **Richer editor API** (cursor, line, range methods) — needs position adapter
5. **Richer modal API** — SuggestModal, FuzzySuggestModal

---

## Recommendations

### Priority Order (If Obsidian Compat Matters)

1. Add `editor-change` event
2. Add `vault.rename()` / `vault.trash()`
3. Add `registerMarkdownCodeBlockProcessor()`
4. Add cursor/line/range editor methods (position adapter `{line, ch}` ↔ ProseMirror)
5. Add command callback variants (checkCallback, editorCallback)
6. Add modal API (SuggestModal, FuzzySuggestModal)

### Priority Order (If Only Carbide-Native Matters)

1. Code block processors — enables custom rendering
2. `editor-change` event — enables reactive editor plugins
3. Cursor/line/range editor methods — enables precise text manipulation
4. Richer modal API — enables interactive plugin UIs beyond toasts
5. `vault.rename()` / `vault.trash()` — completes file lifecycle

---

## Appendix: Current API Surface (Verified Against Code)

### Namespaces

| Namespace | Methods | Notes |
|-----------|---------|-------|
| vault | read, create, modify, delete, list | `list` returns all note paths |
| editor | get_info, get_value, set_value, get_selection, replace_selection | `get_info` → `{path, name}` |
| commands | register, remove, register_slash, remove_slash | Commands get `{id, label, description, keywords, icon}` |
| ui | add_statusbar_item, update_statusbar_item, remove_statusbar_item, add_sidebar_panel, remove_sidebar_panel, show_notice, add_ribbon_icon, remove_ribbon_icon | |
| settings | get, set, get_all, register_tab | Declarative schema: string/number/boolean/select/textarea |
| events | on, off | 10 event types |
| search | fts, tags | `tags()` lists all; `tags(pattern)` returns notes for tag |
| metadata | query, list_properties, get_backlinks, get_stats, getFileCache | `getFileCache` returns full `FileCache` struct |
| network | fetch | Origin allowlist + SSRF protection |
| ai | execute | Modes: "ask", "edit" |
| diagnostics | push, clear | Scoped by `plugin:{id}` source |
| mcp | list_tools, call_tool, register_tool | Tool names namespaced to plugin |

**Total: 12 namespaces, ~40 RPC methods**

### Events (10)

| Event | Source |
|-------|--------|
| file-created | Vault reactor |
| file-modified | Vault reactor |
| file-deleted | Vault reactor |
| file-renamed | Vault reactor |
| active-file-changed | Tab/editor reactor |
| editor-selection-changed | Editor reactor |
| vault-opened | Lifecycle reactor |
| layout-changed | Workspace reactor |
| note-indexed | `plugin_note_indexed` reactor |
| metadata-changed | `plugin_metadata_events` reactor (Tauri event listener) |

### Permissions (17)

| Permission | Namespace |
|------------|-----------|
| fs:read | vault (read, list) |
| fs:write | vault (create, modify, delete) |
| editor:read | editor (get_info, get_value, get_selection) |
| editor:modify | editor (set_value, replace_selection) |
| commands:register | commands (all) |
| ui:statusbar | ui (statusbar methods) |
| ui:panel | ui (sidebar methods) |
| ui:ribbon | ui (ribbon methods) |
| events:subscribe | events (on, off) |
| metadata:read | metadata (all) |
| diagnostics:write | diagnostics (push, clear) |
| search:read | search (fts, tags) |
| network:fetch | network (fetch) |
| ai:execute | ai (execute) |
| mcp:access | mcp (list_tools, call_tool) |
| mcp:register | mcp (register_tool) |
| settings:register | settings (register_tab) |

### Security Boundaries (Verified in Code)

| Check | Location |
|-------|----------|
| Permission gates | `PluginRpcHandler.require_permission()` / `require_any_permission()` — every handler |
| Rate limiting | `PluginRateLimiter` — 100 calls / 60s sliding window |
| Error tracking | `PluginErrorTracker` — burst (≥2/5s warn, ≥5/15s disable) + consecutive (≥10 disable) |
| SSRF | `check_ssrf()` + `resolve_and_check()` in Rust (`http_fetch.rs`) |
| Origin allowlist | `handle_network()` checks `manifest.allowed_origins` |
| Request body limit | `MAX_REQUEST_BODY_BYTES` in Rust |
| Event backpressure | `MAX_PENDING_EVENTS=64` + debounce per-plugin |
| RPC timeout | `with_timeout()` wrapper on `handle_rpc()` |
| Namespace isolation | All plugin IDs namespaced (`${plugin_id}:${local_id}`) |
