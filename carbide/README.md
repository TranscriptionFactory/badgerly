# Carbide

Carbide is the product and implementation direction for turning Badgerly into a high-performance, local-first Markdown knowledge-work app.

The project strategy is simple:

- fork Badgerly as the implementation base
- borrow proven ideas from sibling/reference apps like Moraya, Scratch, and selected external projects
- keep storage and ecosystem choices Markdown-first and vault-first
- ship the core daily-driver features before chasing plugin breadth or speculative platform work

## Start here

If you are doing Carbide-facing work, read these first:

1. `carbide/carbide-project-guide.md` — product strategy, feature roadmap, and guardrails
2. `carbide/TODO.md` — execution tracker and current phase status
3. `carbide/plugin_system.md` — plugin architecture and compatibility posture

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

- `carbide-project-guide.md`
- `TODO.md`
- `plugin_system.md`
- `README.md`

These stay at the top level on purpose because repo instructions and other docs point at them directly.

### `implementation/`

Active implementation plans, checklists, comparisons, and delivery logs that directly drive code changes.

Use this for documents that answer questions like:

- what are we building next
- what design constraints govern it
- what changed when we implemented it

### `research/`

Reference analysis and external comparison docs.

Use this for:

- comparisons against other codebases or products
- external inspiration worth adapting

### `scratch/`

Rough planning notes, brainstorms, and feature-harvesting docs that inform future work but are not the canonical roadmap.

### `templates/`

Reusable prompts and scaffolding for future Carbide work.

### `archive/`

Completed phase notes, one-off investigations, and superseded implementation logs.

If a document no longer drives active work but is still useful as history or rationale, move it here instead of deleting it.

## Placement rules

- Keep new top-level files rare. Default to `implementation/`, `research/`, `scratch/`, `templates/`, or `archive/`.
- Prefer snake_case file names for new docs.
- Put the current source of truth in one place. Do not create parallel roadmap docs.
- When a plan becomes historical context, archive it instead of leaving it mixed with active planning docs.
- Treat `carbide/.badgerly/` as local workspace state, not project documentation.

## Current map

```text
carbide/
├── README.md
├── TODO.md
├── carbide-project-guide.md
├── plugin_system.md
├── implementation/
├── research/
├── scratch/
├── templates/
└── archive/
```
