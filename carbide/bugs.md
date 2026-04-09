# Carbide Bug Tracker

> Tracks known bugs and regressions.
> Status: `[ ]` open | `[~]` investigating | `[x]` fixed | `[-]` wontfix

---

## Editor — Paste & Input Handling

### BUG-001: Pasting indented lists breaks document structure
- **Status:** `[ ]`
- **Severity:** High
- **Repro:** Paste an indented list into a document that has no front matter, before a code block
- **Expected:** Indented list renders correctly in visual mode
- **Actual:** List structure breaks on paste
- **Notes:** Likely a ProseMirror clipboard deserialization issue — indented list HTML/plain text may not map cleanly to the schema. Investigate `clipboardTextParser` / `clipboardParser` hooks.

### BUG-004: Pasted link produces malformed markup and breaks visual mode
- **Status:** `[ ]`
- **Severity:** High
- **Repro:** Paste a URL into visual mode
- **Expected:** Clean link insertion (either raw URL or `[text](url)`)
- **Actual:** Produces `<url>![](url)` — a mangled image/link hybrid. After paste, numbered lists, code fences, and headings all break; only images render correctly.
- **Notes:** Suggests the paste handler is misidentifying the clipboard content type, possibly treating a plain URL as an image. The cascade failure (lists, fences, headings breaking) points to the malformed node corrupting the ProseMirror document tree. Needs investigation of paste rules and input rules for URL patterns.

---

## Editor — Source Mode & Persistence

### BUG-002: Round-trip source edits not retained; dirty state lost on tab switch
- **Status:** `[ ]`
- **Severity:** High
- **Repro:**
  1. Open a note in source editor
  2. Make edits, save
  3. Switch to another tab, then switch back
- **Expected:** Edits are preserved in source mode
- **Actual:** Edits disappear in source mode (but are preserved in visual mode)
- **Notes:** Two sub-issues: (a) source editor dirty state may not be flushing to the shared document model on tab switch / blur, and (b) undo history is not surviving round-trips between modes. Investigate whether the source editor's `onBlur` / `beforeDestroy` lifecycle hooks trigger a save to the backing store.

---

## Editor — Front Matter

### BUG-003: Front matter parsing issues; text added to blank documents lands in front matter
- **Status:** `[ ]`
- **Severity:** Medium
- **Repro:**
  1. Create a blank document (no front matter)
  2. Start typing text
- **Expected:** Text is added as document body content
- **Actual:** Text is sometimes captured as front matter content
- **Notes:** Front matter parsing appears to be load-bearing for the rest of the document parse — if it misidentifies the boundary, everything downstream shifts. Current behavior hides front matter entirely, which makes the bug harder to notice and debug. Consider: (a) collapsing front matter by default instead of hiding it, so users can see and correct misparses, and (b) tightening the `---` fence detection to require it at byte offset 0 of the document with a trailing newline.
