// Vault content — dogfood: design notes for Carbide itself.

const VAULT_TREE = [
  { type: "folder", name: "Design", open: true, children: [
    { type: "file", name: "Source Control Rationale.md", id: "sc-rationale", status: "M", active: true },
    { type: "file", name: "Activity Bar Specs.md", id: "activity-bar", status: null },
    { type: "file", name: "Theme Inventory.md", id: "theme-inv", status: "M" },
    { type: "file", name: "Graph View Math.md", id: "graph-math", status: null },
  ]},
  { type: "folder", name: "Engineering", open: true, children: [
    { type: "file", name: "Embeddings (BGE-small).md", id: "embed", status: null },
    { type: "file", name: "Atomic Writes.md", id: "atomic", status: "A" },
    { type: "file", name: "Tauri IPC Layer.md", id: "tauri", status: null },
    { type: "file", name: "LSP Integration.md", id: "lsp", status: "M" },
  ]},
  { type: "folder", name: "Research", open: false, children: [] },
  { type: "folder", name: "Journal", open: false, children: [] },
  { type: "file", name: "README.md", id: "readme", status: null },
  { type: "file", name: "TODO.md", id: "todo", status: "D" },
];

// Pending changes (the unit the sidebar + commit panel operate on).
const CHANGES = [
  {
    id: "ch-1",
    file: "Design/Source Control Rationale.md",
    short: "Source Control Rationale.md",
    folder: "Design",
    status: "M", // M/A/D/R
    additions: 42,
    deletions: 11,
    staged: true,
    summary: "Re-frame the panel around 'versions', not 'commits'.",
    hunks: [
      { kind: "context", line: "## Mental model" },
      { kind: "context", line: "" },
      { kind: "del", line: "Commits are a code-review artifact. In a notes app they" },
      { kind: "del", line: "feel heavy and foreign to most writers." },
      { kind: "add", line: "We speak in **checkpoints**, not commits. A checkpoint is" },
      { kind: "add", line: "a named save you can travel back to — Git underneath, but" },
      { kind: "add", line: "never Git in the copy." },
      { kind: "context", line: "" },
      { kind: "context", line: "## Surfaces" },
      { kind: "context", line: "" },
      { kind: "context", line: "- Activity bar badge: number of unsaved files" },
      { kind: "add", line: "- Editor rail: per-paragraph change markers (left gutter)" },
      { kind: "add", line: "- Panel: staged, unstaged, and history in one view" },
      { kind: "del", line: "- Modal commit dialog (legacy)" },
    ],
  },
  {
    id: "ch-2",
    file: "Design/Theme Inventory.md",
    short: "Theme Inventory.md",
    folder: "Design",
    status: "M",
    additions: 8,
    deletions: 2,
    staged: true,
    summary: "Add Zen Deck & Command Deck; drop deprecated Floating.",
    hunks: [
      { kind: "context", line: "## Layout themes" },
      { kind: "context", line: "" },
      { kind: "context", line: "- Spotlight" },
      { kind: "context", line: "- Cockpit" },
      { kind: "context", line: "- Theater" },
      { kind: "context", line: "- Triptych" },
      { kind: "del", line: "- Floating (deprecated)" },
      { kind: "add", line: "- Command Deck" },
      { kind: "add", line: "- Zen Deck" },
      { kind: "add", line: "- Monolith" },
    ],
  },
  {
    id: "ch-3",
    file: "Engineering/Atomic Writes.md",
    short: "Atomic Writes.md",
    folder: "Engineering",
    status: "A",
    additions: 87,
    deletions: 0,
    staged: false,
    summary: "New note — rename/fsync ordering for the notify watcher.",
    hunks: [
      { kind: "add", line: "# Atomic Writes" },
      { kind: "add", line: "" },
      { kind: "add", line: "The notify watcher can fire while a save is mid-flight." },
      { kind: "add", line: "We write to `note.md.tmp`, fsync, then rename. The watcher" },
      { kind: "add", line: "coalesces the pair into a single \"changed\" event." },
    ],
  },
  {
    id: "ch-4",
    file: "Engineering/LSP Integration.md",
    short: "LSP Integration.md",
    folder: "Engineering",
    status: "M",
    additions: 3,
    deletions: 14,
    staged: false,
    summary: "Drop the old inlay-hints experiment.",
    hunks: [
      { kind: "del", line: "### Experimental: inlay hints for wikilinks" },
      { kind: "del", line: "" },
      { kind: "del", line: "We tried showing resolved titles as inlay hints next to" },
      { kind: "del", line: "each `[[link]]`. The interaction with the WYSIWYG renderer" },
      { kind: "del", line: "is bad — hints reflow the line on cursor movement." },
      { kind: "add", line: "### Wikilink resolution" },
      { kind: "add", line: "" },
      { kind: "add", line: "Resolved titles are rendered inline by the Markdown pipeline;" },
      { kind: "add", line: "no LSP surface needed." },
    ],
  },
  {
    id: "ch-5",
    file: "TODO.md",
    short: "TODO.md",
    folder: "",
    status: "D",
    additions: 0,
    deletions: 23,
    staged: false,
    summary: "Deleted — migrated to the Tasks panel.",
    hunks: [
      { kind: "del", line: "- [ ] Write rationale for SC panel" },
      { kind: "del", line: "- [ ] Draft checkpoint interaction" },
      { kind: "del", line: "- [ ] Decide: AI commit messages on by default?" },
    ],
  },
];

// History — checkpoints on the current branch.
const CHECKPOINTS = [
  { id: "c0", hash: "a4f21e9", day: "Today",     time: "14:22", title: "Draft Source Control rationale", author: "you", ai: true,  changes: 3, add: 120, del: 14 },
  { id: "c1", hash: "e81cd02", day: "Today",     time: "11:05", title: "Theme inventory: merge Zen + Command Deck",  author: "you", ai: true,  changes: 1, add: 18,  del: 5  },
  { id: "c2", hash: "7b9f1ac", day: "Yesterday", time: "19:48", title: "Atomic writes — first pass",          author: "you", ai: false, changes: 2, add: 64,  del: 0  },
  { id: "c3", hash: "2d5e770", day: "Yesterday", time: "09:14", title: "Activity bar specs",                   author: "you", ai: true,  changes: 1, add: 41,  del: 12 },
  { id: "c4", hash: "91aa3b1", day: "Apr 21",    time: "22:30", title: "Wire BGE-small embeddings into FTS",   author: "you", ai: false, changes: 4, add: 210, del: 48 },
  { id: "c5", hash: "ff40c2e", day: "Apr 21",    time: "16:02", title: "Graph view: WebGL renderer notes",     author: "you", ai: true,  changes: 2, add: 88,  del: 3  },
  { id: "c6", hash: "63d128b", day: "Apr 20",    time: "13:17", title: "LSP integration outline",              author: "you", ai: false, changes: 2, add: 45,  del: 0  },
  { id: "c7", hash: "8c71e44", day: "Apr 20",    time: "08:40", title: "Tauri IPC layer — types only",         author: "you", ai: true,  changes: 3, add: 132, del: 7  },
];

const BRANCHES = [
  { name: "main",             current: true,  ahead: 2, behind: 0 },
  { name: "design/sc-panel",  current: false, ahead: 7, behind: 1 },
  { name: "exp/iwe-rework",   current: false, ahead: 12, behind: 4 },
];

// Active editor note body — paragraph-level change state drives the editor rail.
// state: "clean" | "added" | "modified" | "deleted-marker"
const EDITOR_DOC = [
  { type: "h1", text: "Source Control Rationale", state: "clean" },
  { type: "meta", text: "Design · 3 min read · linked from [[Theme Inventory]], [[Activity Bar Specs]]", state: "clean" },
  { type: "h2", text: "Mental model", state: "clean" },
  { type: "p", text: "We speak in checkpoints, not commits. A checkpoint is a named save you can travel back to — Git underneath, but never Git in the copy.", state: "added" },
  { type: "p", text: "The panel surfaces three layers: what's changed right now, what's been saved this session, and the full history of this vault.", state: "clean" },
  { type: "h2", text: "Surfaces", state: "clean" },
  { type: "ul", items: [
    { text: "Activity bar badge: count of unsaved files", state: "clean" },
    { text: "Editor rail: per-paragraph change markers in the left gutter", state: "added" },
    { text: "Panel: staged, unstaged, and history in one view", state: "added" },
    { text: "Legacy modal commit dialog", state: "deleted" },
  ], state: "modified" },
  { type: "h2", text: "Checkpoint naming", state: "clean" },
  { type: "p", text: "The AI drafts a name from the diff. You can accept, edit, or replace. A good name is a sentence a future you would recognize at a glance — not a conventional-commits slug.", state: "clean" },
  { type: "quote", text: "\"A checkpoint is a letter to your next self.\"", state: "clean" },
  { type: "h2", text: "Open questions", state: "clean" },
  { type: "ul", items: [
    { text: "Should empty checkpoints be possible? (e.g. 'I read through everything today')", state: "clean" },
    { text: "How do we surface merge conflicts in a WYSIWYG editor?", state: "modified" },
  ], state: "clean" },
];

window.VAULT_TREE = VAULT_TREE;
window.CHANGES = CHANGES;
window.CHECKPOINTS = CHECKPOINTS;
window.BRANCHES = BRANCHES;
window.EDITOR_DOC = EDITOR_DOC;
