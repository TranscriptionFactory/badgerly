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
