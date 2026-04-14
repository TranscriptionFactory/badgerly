# Scientific Paper Tracker — Design & Implementation Plan

**Date:** 2026-04-14 (revised)
**Status:** Design / Pre-implementation
**Scope:** Plugin that fetches new papers, finds vault connections via embeddings, and summarizes relevant ones with AI

---

## Problem

Keeping up with new papers is fragmented across arXiv digests, Semantic Scholar feeds, and email alerts. The fetching and de-duplication part is commodity — RSS readers and Zotero handle it fine. What's missing is a tool that evaluates new papers *against the context of your own research vault*: which of these 40 new arXiv papers actually connect to what you're working on?

## Core Insight

Carbide already has embeddings-based semantic search and an AI provider. A plugin that fetches papers, ranks them by vault similarity, and summarizes only the relevant ones is the differentiating feature — not another feed aggregator.

## Proposed Solution

A **Carbide plugin** (`<vault>/.carbide/plugins/paper-tracker/`) that:

1. Fetches new papers from **arXiv** (categories) and **Semantic Scholar** (recommendations seeded from library)
2. De-duplicates by DOI / arXiv ID
3. Ranks by **embedding similarity** against vault content
4. **AI-summarizes** papers above a relevance threshold, contextualized to the user's research
5. Presents a sidebar panel with triage actions (save to library, create note, dismiss)

This dogfoods the plugin system and requires only two narrow host API additions.

---

## Host API Additions Required

The plugin API already provides `network.fetch`, `ai.execute`, `vault.*`, `search.fts`, `metadata.*`. Two methods are missing:

### 1. `search.semantic(query, limit?)` → `{ path, title, similarity }[]`

Expose the existing embeddings search to plugins. Permission: `search:read` (already exists).

**Host-side change:** Add a `"semantic"` case to `handle_search()` in `plugin_rpc_handler.ts`, delegating to the existing search service's semantic/embeddings query method.

### 2. `reference.add(cslItem)` → `CslItem`

Allow plugins to add items to the reference library. Permission: new `reference:write`.

**Host-side change:** Add a `handle_reference()` method to `plugin_rpc_handler.ts`, delegating to `reference_service.add_item()`.

Optional (nice-to-have for de-dup):

### 3. `reference.list()` → `CslItem[]`

Read the library to check for existing entries. Permission: `reference:read`.

---

## Plugin Structure

```
<vault>/.carbide/plugins/paper-tracker/
├── manifest.json
├── main.js              # Compiled from TS source below
└── styles.css

# Source (not shipped, for development):
src/
├── index.ts             # Plugin entry point, lifecycle
├── sources/
│   ├── arxiv.ts         # arXiv Atom API client
│   └── semantic_scholar.ts  # S2 recommendations + author papers
├── dedup.ts             # DOI/arXiv-ID exact match de-duplication
├── ranker.ts            # Embedding similarity ranking
├── summarizer.ts        # AI prompt builder + caller
├── inbox_store.ts       # Local inbox state (JSON in vault)
├── paper_note.ts        # Markdown template for paper notes
└── ui/
    └── panel.html       # Sidebar panel (rendered in plugin iframe)
```

### Manifest

```json
{
  "id": "paper-tracker",
  "name": "Paper Tracker",
  "version": "0.1.0",
  "api_version": "1",
  "description": "Fetch, rank, and summarize new scientific papers against your vault",
  "permissions": [
    "network:fetch",
    "search:read",
    "ai:execute",
    "vault:read",
    "vault:write",
    "reference:read",
    "reference:write",
    "ui:panel",
    "commands:register"
  ],
  "allowed_origins": [
    "https://export.arxiv.org",
    "https://api.semanticscholar.org",
    "https://api.crossref.org"
  ],
  "contributions": {
    "sidebarPanels": [{
      "id": "paper-inbox",
      "title": "Paper Inbox",
      "icon": "newspaper"
    }],
    "commands": [{
      "id": "fetch-papers",
      "name": "Fetch new papers"
    }]
  }
}
```

---

## Data Model

```typescript
type PaperEntry = {
  id: string;                    // generated UUID
  source: "arxiv" | "semantic_scholar";
  source_id: string;             // arXiv ID or S2 paper ID
  doi?: string;
  arxiv_id?: string;
  title: string;
  authors: string[];             // "Given Family" strings — simple, no need for structured names
  abstract?: string;
  published_date?: string;
  journal?: string;
  url: string;

  // Computed
  vault_similarity?: number;     // Top embedding match score (0-1)
  connected_notes?: string[];    // Paths of similar vault notes
  summary?: string;              // AI-generated, only for papers above threshold

  // Triage
  status: "new" | "saved" | "dismissed";
  fetched_at: string;
};
```

Storage: `<vault>/.carbide/paper-tracker/inbox.json` and `<vault>/.carbide/paper-tracker/config.json`.

---

## Workflows

### Fetch + Rank (on command or vault open)

```
1. Load config (arXiv categories, S2 author IDs, last_fetch timestamp)
2. Fetch in parallel:
   a. arXiv: Atom API query for configured categories, since last_fetch
   b. Semantic Scholar: /recommendations with library DOIs as seeds,
      + /author/{id}/papers for followed authors, since last_fetch
3. Normalize to PaperEntry[]
4. De-duplicate:
   a. By DOI (exact)
   b. By arXiv ID (exact)
   c. Drop papers already in reference library (via reference.list())
   d. Drop papers already in inbox
5. For each new paper, call search.semantic(title + first 200 chars of abstract, 3)
   → store top similarity score and connected note paths
6. Sort by vault_similarity descending
7. Persist to inbox.json
8. Update last_fetch timestamp
```

### Summarize (async, after ranking)

```
For papers where vault_similarity > threshold (default 0.3):
  1. Build prompt:
     - Paper: title, authors, abstract
     - Connected notes: titles of top-3 similar vault notes
     - Instruction: "2-3 sentence summary. Note connections to the listed notes."
  2. Call ai.execute({ prompt, mode: "ask" })
  3. Store summary on PaperEntry
  4. Update inbox.json
```

Only summarizing above-threshold papers keeps AI cost proportional to relevance, not feed volume.

### Triage (user-driven, in sidebar panel)

| Action | Effect |
|---|---|
| **Save to library** | Convert to CslItem → `reference.add()`, set status "saved" |
| **Create note** | `vault.create()` with paper note template (metadata, summary, wiki-links to connected notes), set status "saved" |
| **Dismiss** | Set status "dismissed", hide from default view |
| **Open** | Open paper URL in browser |

---

## Source Details

### arXiv

**API:** `https://export.arxiv.org/api/query?search_query=cat:{category}&sortBy=submittedDate&sortOrder=descending&max_results=50`

Returns Atom XML. Parse in the plugin (DOMParser available in iframe). Extract: id, title, authors, abstract, published date, PDF link.

**Rate limit:** arXiv asks for 3-second delays between requests. Respect this.

**Config:** `categories: string[]` (e.g. `["cs.AI", "cs.CL", "q-bio.QM"]`)

### Semantic Scholar

**Recommendations:** `POST https://api.semanticscholar.org/recommendations/v1/papers/` with `{ positivePaperIds: [...] }`. Seeds derived from DOIs in the user's reference library.

**Author papers:** `GET https://api.semanticscholar.org/graph/v1/author/{id}/papers?fields=title,authors,abstract,externalIds,publicationDate&limit=20`

**Rate limit:** 100 req/sec unauthenticated. No concern.

**Config:** `author_ids: string[]`, `seed_from_library: boolean` (default true)

---

## Implementation Phases

### Phase 1: Host API + arXiv fetch (1 session)

- [ ] Add `search.semantic` to plugin RPC handler
- [ ] Add `reference.add` + `reference.list` to plugin RPC handler
- [ ] Plugin scaffold: manifest, entry point, inbox store
- [ ] arXiv source: fetch, XML parse, normalize
- [ ] De-duplication logic
- [ ] Embedding-based ranking via `search.semantic`
- [ ] Basic sidebar panel: list of papers sorted by relevance
- [ ] Tests: RPC handler additions, arXiv parsing, dedup

### Phase 2: Semantic Scholar + AI + triage (1 session)

- [ ] Semantic Scholar source: recommendations + author papers
- [ ] AI summarization for above-threshold papers
- [ ] Triage actions: save to library, create note, dismiss
- [ ] Paper note markdown template
- [ ] Source configuration UI (in plugin settings or vault settings)
- [ ] Auto-fetch on vault open (opt-in)
- [ ] Tests: S2 response parsing, summarization prompt, triage flow

---

## Open Questions

1. **Similarity threshold for summarization:** 0.3 is a guess. Needs calibration against real vault content. Could expose as a config slider.
2. **Seed paper selection:** Auto-deriving from the full reference library may produce noisy recommendations. Consider using only starred/recent references, or letting the user tag "seed" references.
3. **Offline:** Show cached inbox, skip fetch. Surface "last synced: {timestamp}" in the panel header.
4. **Future sources:** bioRxiv, PubMed (via E-utilities or the existing MCP server), Scholar Inbox (if a viable scraping path emerges). These are additive — the architecture doesn't need to anticipate them now.

---

## Dependencies

- **Existing host capabilities:** `network.fetch`, `ai.execute`, `vault.*`, `search.fts`, `metadata.*`, plugin sidebar panels, plugin commands
- **New host work:** 2 RPC handler additions (~50 lines each)
- **External APIs:** arXiv Atom API, Semantic Scholar Academic Graph API, CrossRef (for DOI resolution on save)
- **Reference feature:** `CslItem` type compatibility, `add_item` service method exposure
