# Carbide — Implemented Features

> Running list of shipped features. Organized by area, not by implementation phase.
> For task-level status and remaining work, see `carbide/TODO.md`.

---

## Vault management

- Dropdown vault switcher in sidebar header with pinned-first + recent ordering
- Visual vault identifiers (icon/emoji or first letter)
- Quick-switch hotkey (`Cmd+Shift+V`)
- Git branch + dirty indicator per vault in dropdown
- Add Vault (folder picker) and Manage Vaults from dropdown
- Right-click context menu: Remove from list, Reveal in Finder
- Persisted vault order across sessions
- Single active vault with full store reset on switch

## Editor

### Core editing (Milkdown / ProseMirror)

- WYSIWYG Markdown editing with Obsidian-flavored syntax
- Wiki-links (`[[Note]]`, `[[folder/Note]]`, `[[Note|Label]]`)
- Slash commands for block insertion
- Floating table toolbar (insert/delete rows and columns, delete table)
- Floating image resize toolbar
- Code block language picker with syntax highlighting
- Mermaid diagram preview (live render in code blocks)
- Emoji shortcodes (`:emoji:` expansion)

### Split view

- Dual-pane editing (`Cmd+\` to split, `Cmd+W` to close)
- Independent Milkdown instances per pane (separate dirty state, cursor, scroll)
- Drag tab to split, drag back to merge
- "Open to Side" in file tree and tab bar context menus
- Active pane tracking for shortcuts and status bar
- Split state remembered per vault, closed on vault switch

### Outline panel

- Live heading hierarchy (h1–h6) extracted from ProseMirror state
- Click-to-scroll navigation
- Collapsible heading sections
- Active heading highlighting based on scroll position
- Debounced live updates (300ms)
- Right sidebar tab alongside Links panel (`Cmd+Shift+O`)

## Document viewer

Multi-format document viewing in the editor pane, dispatched by file extension.

### PDF

- Page navigation, zoom, scroll, text search (pdfjs-dist)
- "Open to Side" for side-by-side PDF + notes

### Images

- PNG, JPG, SVG, GIF, WebP display
- Zoom/pan controls, fit-to-width default
- Dark/light checkerboard for transparent images

### Code / text

- Syntax-highlighted read-only view (CodeMirror)
- Line numbers, copy button
- Supported: `.py`, `.R`, `.rs`, `.json`, `.yaml`, `.toml`, `.sh`

### Cross-cutting

- File tree icon badges by file type
- Drag non-markdown file into note → insert markdown link
- PDF export of notes (`Cmd+Shift+E`, jsPDF)

## Git integration

### Local operations

- Auto-commit on save
- Status bar widget showing branch and dirty state

### Remote operations

- Push, pull, fetch with progress indicators
- Ahead/behind commit counts in status bar
- SSH auth using the user's existing Git/SSH configuration
- "Add Remote" dialog when no remote configured
- Human-readable error categorization (auth, network, conflict)
- Command palette entries and hotkeys for all remote ops

### Version history

- Paginated commit log (20-commit initial load + load-more)
- Note-scoped history with cache and mutation invalidation

## Terminal

- Embedded PTY panel (xterm.js + tauri-plugin-pty)
- Toggle with `Cmd+Shift+\``
- Draggable resize handle between editor and terminal
- Working directory defaults to active vault root
- Persists across file/tab switches
- Bidirectional streaming via Tauri plugin events

## AI assistant

- Multi-backend support: Claude, Codex, Ollama
- Auto backend selection with configurable default
- Conversation panel in context rail with history
- Diff-first draft review with partial apply
- Edit/ask mode toggle
- Unified "AI Assistant" command palette entry
- CLI-backed execution (uses locally installed AI CLIs)
- Generic pipeline infrastructure (reusable for future CLI integrations)

## Plugin system

- Plugin discovery from `<vault>/.carbide/plugins/` via `manifest.json`
- Manifest parsing with permission validation
- Sandboxed iframe execution per plugin
- `postMessage`-based RPC bridge with permission-checked dispatcher
- RPC namespaces: vault, editor, commands, ui
- Per-plugin error tracking with auto-disable on repeated failures
- Custom URI scheme (`badgerly-plugin://`) for plugin HTML serving
- Full lifecycle: discover → validate → load → activate → deactivate
- Demo plugins: Hello World (command palette + cursor insert), Word Count (status bar)

## Canvas

- Excalidraw drawing support (`.excalidraw`, `.excalidraw.json`)
- Hosted in iframe sandbox with custom URI scheme
- Bi-directional sync between app and Excalidraw instance
- Canvas naming dialog on create
- Theme-aware background
- Canvas feature slice architecture (CanvasPort, CanvasTauriAdapter, CanvasService, CanvasStore)

## macOS integration

- Registered as default app for `.md`, `.markdown`, `.mdx`
- File-open events routed to matching vault or prompt to add as vault
- Native Tauri command for resolving files to vaults

## Command palette & shortcuts

All features register into a centralized `COMMANDS_REGISTRY` and are accessible via the omnibar. Default hotkeys are assigned for high-frequency actions. Full action registry pattern: UI, keyboard shortcuts, command palette, and Tauri menus all dispatch through `action_registry.execute()`.
