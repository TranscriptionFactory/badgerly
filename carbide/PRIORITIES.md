# Carbide — Editor Improvement Priorities

> Ranked list of remaining editor improvements and new features.
> For task-level status, see `carbide/TODO.md`.

---

## Tier 1: Core Writing Experience

### 1. Focus/Zen Mode (Phase 6a)

Highest-impact editor improvement. A note-taking app's core job is letting you write without distraction. Small scope, high daily-use value — just a boolean toggle that hides panels with an animated transition.

### 2. Math/LaTeX Support (Phase 6b)

Blocks a significant user segment (academics, researchers, technical writers). Milkdown has an official plugin (`@milkdown/plugin-math`), so integration effort is moderate. Without this, those users won't consider the app.

### 3. Table Cell Alignment (Phase 6e — Batches 1–2 remaining)

Tables render and the floating toolbar works, but cell alignment (left/center/right) is missing. This is the kind of gap that erodes trust in the editor — "if tables don't work right, what else doesn't?"

---

## Tier 2: Editor Polish & Power Features

### 4. Image Width CSS Hookup (Phase 6e — Batches 1–2 remaining)

The resize toolbar exists and sets the width attribute, but it doesn't actually apply to the DOM visually. A broken feature ranks higher than a missing one.

### 5. Contextual Command Palette (Phase 6c)

Smart `when` predicate filtering reduces clutter as command count grows. Not urgent at current feature count, but becomes important soon.

### 6. Formatting Toolbar (Phase 6e — Batch 5)

Useful for discoverability and touch/trackpad users. WYSIWYG editors without a toolbar feel incomplete. Keyboard-first early adopters can live without it.

### 7. Mermaid Improvements (Phase 6e — Batches 1–2 remaining)

Serial render queue, stale result guard, and theme re-render on color scheme change. Mermaid works today; this is polish for heavy diagram users.

---

## Tier 3: Nice-to-Have

### 8. Image Context Menu + Alt Text Editor (Phase 6e — Batch 4)

Right-click actions for images (resize, copy, edit alt, open in browser, save as, delete). Convenient but not blocking any workflow.

### 9. Auto-commit Settings UI (Phase 5 — remaining)

The auto-commit reactor exists; this adds a settings panel for off / on-save / interval. Low urgency since the default behavior works.

### 10. Structured AI Edit Proposals (Phase 6d — remaining)

Machine-validated payloads for AI-generated edits. An infrastructure investment, not user-facing yet.

---

## Graph & Semantic Search — Current State and Next Steps

> Findings from audit of `src/lib/features/graph/`, `src/lib/features/links/`, `src-tauri/src/features/graph/`, and `~/src/RAG/`.

### What exists today

**Graph (frontend + Rust backend)**

- 1-hop neighborhood view: center note → direct backlinks, outlinks, bidirectional links, orphan links.
- Data sourced from SQLite FTS index via `search_db::get_backlinks`/`get_outlinks`/`get_orphan_outlinks`.
- LRU cache in Rust (`GraphCacheState`) with hit/miss/eviction observability.
- Frontend renders a static column-layout canvas (`resolve_graph_canvas_view`) with node selection, hover, and filter-by-query.
- Graph panel toggled from activity bar; refresh reactor syncs on active-note change.

**Links**

- `LinksStore` tracks backlinks, outlinks, external links, orphan links per note.
- Link repair service handles renames across vault.

**RAG reference (`~/src/RAG`)**

- ChromaDB-backed MCP server for local document search.
- Hybrid search pipeline: semantic (ChromaDB default embeddings) + keyword (`$contains`) merged via Reciprocal Rank Fusion (k=60).
- Heuristic re-ranking (inverse distance 0.6, term overlap 0.3, exact phrase 0.3).
- Chunk expansion fetches adjacent chunks by `chunk_index` metadata.
- Ingestion via `extract_text.py`: PDF/MD/TXT/DOCX/CSV/HTML → chunked (1000 chars, 150 overlap) → stored with source metadata.

### What's missing / opportunities for sophistication

#### Tier A: High-impact graph features

**A1. Full-vault graph view**
The current graph is 1-hop only. A global graph showing all notes + edges would let users see clusters, isolated notes, and structural patterns. Implementation path: Rust-side query that returns all notes + all link edges; frontend renders with a force-directed layout (e.g. d3-force or a lightweight WebGL renderer for large vaults). Consider progressive loading — start with the current neighborhood, expand on demand.

**A2. Multi-hop traversal**
Allow expanding the neighborhood to 2-hop or N-hop. The Rust side already has the primitives (`get_backlinks`/`get_outlinks`); this is BFS/DFS from center with a depth parameter. Enables "show me everything connected within 3 hops" exploration.

**A3. Semantic similarity edges**
Use text embeddings (borrowing from the RAG approach) to surface "similar but unlinked" notes. This is the highest-value semantic feature — it turns the graph from a link-based map into a knowledge map. Implementation: embed each note's content at index time, store vectors in SQLite (via `sqlite-vec` extension) or a sidecar ChromaDB, then query nearest neighbors for any note. Display as dashed/weighted edges on the graph.

**A4. Graph clustering / community detection**
Once the full graph exists, run lightweight community detection (e.g. connected components, or Louvain on edge weights) to auto-identify topic clusters. Surface these as color-coded groups on the canvas or as a "Topics" sidebar.

#### Tier B: Semantic search integration

**B1. Vault-wide semantic search**
Port the RAG hybrid search pipeline into Carbide's Rust backend. Options:

- **sqlite-vec**: Keeps everything in one SQLite DB. Embed notes at index time (using a local model like `all-MiniLM-L6-v2` via `ort`/ONNX Runtime in Rust), store vectors alongside FTS. Hybrid search = FTS + vector ANN + RRF merge. Zero external dependencies.
- **ChromaDB sidecar**: Reuse the existing `~/src/RAG` approach. Simpler to prototype but adds a Python process dependency.
  Recommendation: `sqlite-vec` for production (local-first, single binary), ChromaDB for rapid prototyping.

**B2. "Related notes" panel**
Given a note, show top-K semantically similar notes (not just linked ones). This is the user-facing surface for A3. Could live as a tab in the existing links panel or as an overlay on the graph.

**B3. Semantic search in omnibar**
Extend the command palette / omnibar to support semantic queries, not just fuzzy filename matching. When the user types a natural-language phrase, fall back to vector search if FTS returns poor results.

#### Tier C: Advanced / future

**C1. Note embeddings for AI context**
When invoking the AI assistant, automatically retrieve the K most relevant notes as context (RAG over the vault). This makes the AI vault-aware without the user manually copying content.

**C2. Link prediction / suggestion**
"This note mentions concepts from X, Y, Z — would you like to add wiki-links?" Combine keyword extraction + embedding similarity to suggest links the user hasn't made yet.

**C3. Temporal graph / version-aware edges**
Leverage the built-in Git history to show how the graph evolved over time — when links were added/removed, which notes grew together. This is unique to a Git-native app.

### Recommended sequencing

1. **A1 (full-vault graph)** + **A2 (multi-hop)** — foundational; unlocks the rest. Pure graph work, no ML needed.
2. **B1 (sqlite-vec embeddings)** — infrastructure for all semantic features. Start with `all-MiniLM-L6-v2` via ONNX Runtime in Rust.
3. **A3 (semantic edges)** + **B2 (related notes panel)** — first user-visible semantic features, built on B1.
4. **B3 (semantic omnibar)** — quick win once B1 exists.
5. **C1 (AI context)** — high value, depends on B1.
6. **A4 (clustering)**, **C2 (link prediction)**, **C3 (temporal graph)** — polish and differentiation.
