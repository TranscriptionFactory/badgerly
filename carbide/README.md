# Carbide

Carbide is the next phase of Badgerly — not a fork or a rewrite, but a continuation. Badgerly is the codebase; Carbide is the product direction. The goal is to turn Badgerly into a high-performance, local-first Markdown knowledge-work app that can serve as a daily driver.

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri v2 (Rust backend, native webview) |
| Frontend | SvelteKit + Svelte 5, TypeScript |
| Editor | Milkdown (ProseMirror) |
| UI components | shadcn-svelte |
| Search | SQLite FTS (via rusqlite) |
| Storage | Plain Markdown files in local vaults |
| Version control | Built-in Git integration (Rust git2 + CLI fallback) |
| Canvas | Excalidraw (iframe sandbox), JSON Canvas planned |
| Build | pnpm, Vite, oxlint, Prettier, Vitest |

The frontend follows a ports & adapters architecture with four layers: **Ports/Adapters** (IO interfaces), **Stores** (reactive `$state`), **Services** (async orchestration), and **Reactors** (effect-driven side effects). All user actions flow through a single **Action Registry**. See `docs/architecture.md` for the full decision tree.

## Goals

- Local-first, vault-based, Obsidian-flavored Markdown storage — no proprietary formats
- Rich WYSIWYG editing with wiki-links, tables, code blocks, Mermaid, math
- Built-in Git versioning with push/pull/fetch and version history
- Extensible via a sandboxed plugin system
- Canvas and visual knowledge layout (Excalidraw now, JSON Canvas next)
- AI assistant integration (Claude, Codex, Ollama) with diff-first draft review
- Ship core daily-driver features before chasing plugin breadth or speculative platform work

## What's shipped

Phases 1–9 have been worked through. The major features that are live:

- **Vault switcher** — dropdown selector with quick-switch (`Cmd+Shift+V`), git branch/dirty indicators, pin/recent ordering
- **Outline panel** — live heading hierarchy from ProseMirror state with scroll-to and active tracking
- **macOS file associations** — registered as default app for `.md`, vault-aware file open routing
- **Split view** — dual-pane editing with independent editor instances, "Open to Side" context menus
- **Git remote ops** — push/pull/fetch, ahead/behind counts, SSH auth, add-remote dialog, paginated version history
- **Terminal** — embedded PTY panel (xterm.js) toggled with `Cmd+Shift+\``
- **AI assistant** — multi-backend CLI integration (Claude/Codex/Ollama), conversation panel, diff-first review with partial apply
- **Editor ports** — floating toolbars (table, image resize), code block language picker, Mermaid preview, emoji shortcodes
- **Document viewer** — PDF (pdfjs), images (zoom/pan), syntax-highlighted code; PDF export via jsPDF
- **Plugin system** — sandboxed iframe plugins with manifest-based permissions, RPC bridge, demo plugins (Hello World, Word Count)
- **Canvas** — Excalidraw support with theme-aware background and naming dialog; JSON Canvas renderer pending

## What's next

Key remaining work across phases:

- Focus/Zen mode (Phase 6a)
- Math/LaTeX support (Phase 6b)
- Contextual command palette filtering (Phase 6c)
- JSON Canvas spatial boards (Phase 9)
- Auto-commit settings and interval-based commits
- Plugin SDK (`@carbide/plugin-api`) and hot-reload
- Image context menu, formatting toolbar
- Rebrand from Badgerly to Carbide (app name, URI scheme, config paths)

See `carbide/TODO.md` for granular task status.

## Start here

If you are doing Carbide-facing work, read these first:

1. `carbide/TODO.md` — execution tracker and current phase status
2. `carbide/FEATURES.md` — running list of implemented features by area
3. `carbide/plugin_system.md` — plugin architecture and compatibility posture
4. `docs/architecture.md` — frontend architecture decision tree

## Reference implementations (`~/src/KBM_Notes`)

When researching or implementing features, always check the local mirror of open-source knowledge-management apps in `~/src/KBM_Notes/` for portable implementations before writing from scratch.

| Project | Repository | Notes |
| --- | --- | --- |
| **Moraya** | `git@github.com:TranscriptionFactory/moraya.git` | Svelte/Tauri/ProseMirror — closest stack match, easiest ports |
| **Scratch** | `git@github.com:TranscriptionFactory/scratch.git` | React/Tauri/TipTap — AI CLI integration, git ops donor |
| **Ferrite** | `git@github.com:OlaProeis/Ferrite.git` | Performance and safety donor (Rust) |
| **AFFiNE** | `git@github.com:toeverything/AFFiNE.git` | Block editor, canvas, collaboration |
| **OctoBase** | `git@github.com:toeverything/OctoBase.git` | AFFiNE's CRDT/sync engine (Rust) |
| **AppFlowy** | `git@github.com:AppFlowy-IO/AppFlowy.git` | Flutter/Rust knowledge app, plugin system |
| **anytype-ts** | `git@github.com:anyproto/anytype-ts.git` | Object-graph knowledge app (TypeScript) |
| **SiYuan** | `git@github.com:siyuan-note/siyuan.git` | Block-level Markdown editor (Go/TS) |
| **HelixNotes** | `https://codeberg.org/ArkHost/HelixNotes.git` | Note-taking app |
| **Yiana** | `https://github.com/lh/Yiana.git` | Knowledge management |
| **Lokus** | `https://github.com/lokus-ai/lokus.git` | AI-powered knowledge app |

**Research workflow:** Before building a feature, search the relevant KBM_Notes repos for existing implementations. Document what you find (and what you borrow) in `carbide/research/` or inline in the implementation doc.

## Organization scheme

The folder is organized by document role and lifecycle.

### Root

Keep only the canonical project docs at the root:

- `TODO.md`
- `FEATURES.md`
- `plugin_system.md`
- `README.md`

These stay at the top level on purpose because repo instructions and other docs point at them directly.

### `implementation/`

Active implementation plans, checklists, comparisons, and delivery logs that directly drive code changes.

### `research/`

Reference analysis and external comparison docs.

### `scratch/`

Rough planning notes, brainstorms, and feature-harvesting docs that inform future work but are not the canonical roadmap.

### `templates/`

Reusable prompts and scaffolding for future Carbide work.

### `archive/`

Completed phase notes, one-off investigations, and superseded implementation logs. Move docs here instead of deleting when they no longer drive active work.

## Placement rules

- Keep new top-level files rare. Default to `implementation/`, `research/`, `scratch/`, `templates/`, or `archive/`.
- Prefer snake_case file names for new docs.
- Put the current source of truth in one place. Do not create parallel roadmap docs.
- When a plan becomes historical context, archive it.
- Treat `carbide/.badgerly/` as local workspace state, not project documentation.
