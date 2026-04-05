# Metadata API Surface: Obsidian-like Parity

Status: Planning
Date: 2026-03-31

## Current State

### What's built and working

**Backend (Rust SQLite — integrated into search index)**

| Layer                    | What                                                                                                         | Location                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `note_properties` table  | YAML frontmatter indexed per-note, type inference (string, number, boolean, date)                            | `src-tauri/src/features/search/db.rs`       |
| `note_inline_tags` table | Inline `#tag` extraction                                                                                     | same                                        |
| `NoteStats` struct       | word_count, char_count, heading_count, outlink_count, reading_time_secs, task_count/done/todo, next_due_date | `src-tauri/src/features/search/model.rs:91` |
| `IndexNoteMeta` struct   | path, title, name, `mtime_ms`, `size_bytes`, file_type, source                                               | `model.rs:45`                               |
| `query_bases()`          | Full filter/sort/pagination over properties, tags, stats, meta                                               | `db.rs:2714`                                |
| `get_note_properties()`  | BTreeMap of all properties for a path                                                                        | `db.rs:2633`                                |
| `get_note_tags()`        | Sorted Vec of tags for a note                                                                                | `db.rs:2652`                                |
| `list_all_properties()`  | PropertyInfo[] across vault (key, type, count)                                                               | `db.rs:2688`                                |
| `list_all_tags()`        | TagInfo[] across vault (tag, count)                                                                          | `db.rs:2663`                                |
| `get_note_stats()`       | NoteStats for a note                                                                                         | `db.rs:1635`                                |

**Plugin RPC namespace (`metadata.*`)**

| Method                        | What                        | Permission      |
| ----------------------------- | --------------------------- | --------------- |
| `metadata.query(query)`       | Bases query engine          | `metadata:read` |
| `metadata.listProperties()`   | Vault-wide property listing | `metadata:read` |
| `metadata.getBacklinks(path)` | Incoming links              | `metadata:read` |
| `metadata.getStats(path)`     | Note statistics             | `metadata:read` |

Wired in `create_app_context.ts:704-721`, dispatched via `plugin_rpc_handler.ts`.

**Frontend features**

- Metadata panel — frontmatter property/tag editing (`src/lib/features/metadata/`)
- Bases panel — table/list views, saved query definitions (`src/lib/features/bases/`)

### What's NOT exposed

| Gap                                          | Detail                                                                                             | Obsidian equivalent                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| No `ctime_ms` / creation date                | Only `mtime_ms` in `IndexNoteMeta`. `date_created` in new-note frontmatter templates is write-only | `TFile.stat.ctime`                               |
| No composite `getFileCache(path)`            | Need separate `query` + `getStats` + `getBacklinks` calls to assemble full picture                 | `metadataCache.getFileCache(path)`               |
| No live cache events                         | No event subscription for metadata index updates                                                   | `metadataCache.on("changed", cb)`                |
| No structured headings per-file              | Heading count exists in NoteStats, but not heading text/level/position                             | `fileCache.headings[]`                           |
| No structured links per-file                 | Outlink count exists, but not link targets/display text                                            | `fileCache.links[]`, `fileCache.embeds[]`        |
| No resolved/unresolved link map              | Backlinks exist but no resolution status                                                           | `metadataCache.resolvedLinks`, `unresolvedLinks` |
| No `getFirstLinkpathDest()`                  | Link path resolution (handles aliases, relative paths)                                             | `metadataCache.getFirstLinkpathDest()`           |
| No vault-wide tag aggregation via plugin API | `list_all_tags()` exists in Rust but not wired to plugin RPC                                       | `metadataCache.getTags()`                        |

---

## Target: `getFileCache(path)` shape

The composite per-file cache is the cornerstone of Obsidian plugin compatibility. Target shape:

```ts
interface FileCache {
  frontmatter: Record<string, PropertyValue>;
  tags: CachedTag[]; // { tag: string, position: Position }
  headings: CachedHeading[]; // { level: number, heading: string, position: Position }
  links: CachedLink[]; // { link: string, display: string, position: Position }
  embeds: CachedEmbed[]; // { link: string, display: string, position: Position }
  stats: NoteStats;
  ctime_ms: number;
  mtime_ms: number;
  size_bytes: number;
}
```

Most of the data already exists in the SQLite index. Missing pieces:

1. Structured headings (text + level + position) — currently only counted
2. Structured links (target + display + position) — currently only counted
3. `ctime_ms` — not captured by Rust backend at all
4. Embeds vs links distinction

---

## Implementation Plan

### Phase A: Backend enrichment (Rust)

**A1. Capture `ctime_ms` in file metadata**

- Add `ctime_ms` field to `IndexNoteMeta`
- Populate from `fs::metadata().created()` during indexing
- Add column to search DB schema (`notes` table)
- Propagate to `NoteMeta` on frontend

**A2. Store structured headings**

- New table: `note_headings (path TEXT, level INT, text TEXT, byte_offset INT)`
- Extract during content parsing (already walking the AST for stats)
- Expose via `get_note_headings(path)` Tauri command

**A3. Store structured links**

- New table: `note_links (path TEXT, target TEXT, display TEXT, byte_offset INT, is_embed BOOL)`
- Extract during content parsing (outlinks already counted)
- Expose via `get_note_links(path)` Tauri command
- Distinguish `[[link]]` vs `![[embed]]`

**A4. Resolved/unresolved link map**

- After full index, cross-reference `note_links.target` against known paths
- Expose as `get_resolved_links()` / `get_unresolved_links()` or flag on each link row

### Phase B: Composite `getFileCache` endpoint

**B1. New Tauri command: `note_get_file_cache(vault_id, path)`**

- Single call returning the composite `FileCache` shape
- Assembles from existing tables + new heading/link tables
- Avoids N+1 round-trips from plugin iframe

**B2. Wire to plugin RPC**

- `metadata.getFileCache(path)` → `note_get_file_cache`
- Permission: `metadata:read`

### Phase C: Live cache events

**C1. Emit metadata change events**

- On note upsert/rename/delete, emit `metadata-changed` event via Tauri event system
- Plugin bridge subscribes and forwards to iframe
- `events.on("metadata-changed", cb)` in plugin SDK

**C2. Vault-wide tag listing via plugin API**

- Wire existing `list_all_tags()` to `metadata.listTags()` RPC method

### Phase D: Link resolution

**D1. `getFirstLinkpathDest(linkpath, sourcePath)`**

- Resolve wiki-link text to actual file path (handles aliases, relative paths, ambiguous names)
- Needed for plugins that navigate or render links

### Priority order

1. **A1** (ctime) + **A2** (headings) + **A3** (links) — backend data enrichment, can be done in parallel
2. **B1 + B2** — composite endpoint, depends on A1-A3
3. **C2** — vault-wide tags, trivial wiring
4. **C1** — live events, independent but lower priority
5. **A4 + D1** — link resolution, most complex, least urgent

### Scope considerations

- Heading/link extraction already happens during indexing (AST walk for stats). Storing structured data is incremental work on the same pass.
- `ctime_ms` has platform caveats: Linux `ext4` may not have birth time. macOS/APFS and Windows/NTFS do. Fall back to `mtime_ms` when unavailable.
- Position data (byte offsets) is nice-to-have for Obsidian compat but not critical for v1. Could defer positions and ship text-only first.

---

## References

- Plugin system spec: `carbide/archive/plugin_system.md` (Phase 2: MetadataCache Infrastructure, lines 297-305)
- Phase 3 implementation: `carbide/implementation/phase3_metadata_and_bases.md`
- Plugin RPC handler: `src/lib/features/plugin/application/plugin_rpc_handler.ts`
- Plugin context wiring: `src/lib/features/plugin/application/create_app_context.ts:704-721`
- Rust models: `src-tauri/src/features/search/model.rs`
- Rust DB queries: `src-tauri/src/features/search/db.rs`
- Plugin howto: `docs/plugin_howto.md` (metadata namespace, lines 144-154, 382-407)
