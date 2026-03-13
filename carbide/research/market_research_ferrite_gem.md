# Ferrite Assessment for Carbide/Otterly

## Scope

This document compares `Ferrite` and `Otterly` to identify features, architectural patterns, and code components that could be valuable to port to Carbide, improving long-term viability, extensibility, and security.

## Executive Summary

Ferrite is a native Rust text editor built with `egui`, `ropey`, and `syntect`. Unlike Lokus (React) or Otterly (SvelteKit/Tauri), Ferrite is entirely native. While the UI components (`egui`) are not directly portable to Otterly's webview, Ferrite's robust Rust backend patterns for file handling, large file management, and terminal architecture offer strong inspiration for improving Otterly's Tauri backend.

## Valuable Concepts to Port to Otterly

### 1. Robust File Encoding & Detection

**Ferrite:** Uses `encoding_rs` and `chardetng` to auto-detect file encodings (UTF-8, Latin-1, Shift-JIS, etc.) and gracefully fallback.
**Otterly:** Currently assumes UTF-8 for reading/writing Markdown. If a user drops in legacy text files or CSVs from other systems, Otterly could corrupt them or crash.
**Recommendation:** Adopt Ferrite's `chardetng` encoding detection in Otterly's Rust `read_vault_file` command. This significantly improves long-term viability and data safety for diverse file vaults.

### 2. Large File Handling (Rope Data Structure)

**Ferrite:** Uses `ropey` (a rope data structure) to handle 80MB+ text files with ~80MB RAM usage and virtually zero latency.
**Otterly:** Uses Milkdown/ProseMirror or CodeMirror (for the Document Viewer). Very large files (e.g., a 10MB CSV or log file) will cause massive JSON serialization overhead over Tauri IPC and block the frontend thread.
**Recommendation:** For the Phase 7 "Code/Text Viewer", Otterly could implement a Rust-based `ropey` buffer that only streams the visible chunk of text to the frontend over IPC, enabling instant opening of massive log/data files without front-end memory bloat.

### 3. "Live Pipeline" Shell Commands

**Ferrite:** Allows piping JSON/YAML content through shell commands.
**Otterly:** Phase 6d introduces AI CLI Integration (Claude, Codex).
**Recommendation:** Ferrite's generic pipeline architecture is a more extensible pattern than hardcoding specific AI CLIs. By treating AI tools as just another "pipeline command" with a text buffer stdin/stdout, Otterly can easily support any local CLI tool (e.g., `jq`, `awk`, custom LLM wrappers) securely without adding new Tauri commands per tool.

### 4. Advanced Terminal Layouts

**Ferrite:** Features a full tiling & splitting terminal workspace that saves/restores layouts to JSON.
**Otterly:** Phase 6 introduces a basic `TerminalPanel`.
**Recommendation:** Don't port the layout engine to Svelte right away, but borrow Ferrite's configuration JSON schema for terminal persistence and multiple session management.

### 5. Single Instance Management

**Ferrite:** Contains explicit `single_instance.rs` logic to handle IPC when a user tries to open a second file from the OS explorer.
**Otterly:** Phase 3 (macOS Default App Registration) requires similar logic.
**Recommendation:** Review Ferrite's `single_instance.rs` to ensure Otterly's file-open events handle cross-process communication correctly (so clicking an `.md` file in Finder forwards the path to the running Otterly instance instead of launching a second Tauri app).

### 6. Safe Auto-Save & Temp Files

**Ferrite:** Writes to a temporary file first, then atomically renames to the target filename to prevent corruption during crash/power loss.
**Otterly:** Standard file writes via `std::fs::write` are vulnerable to tearing.
**Recommendation:** High-value security/safety win. Port the atomic write pattern (write to `.tmp`, then `rename`) to Otterly's `NoteService` and `VaultService`.

## Portability Matrix

| Feature                    | Classification           | Notes                                                                                                                                                        |
| :------------------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **a. Encoding Detection**  | **Direct Port (Rust)**   | High portability. Uses standard Rust crates (`encoding_rs`, `chardetng`) that integrate directly into Otterly's Tauri backend.                               |
| **b. Large File Handling** | **Architecture Donor**   | Moderate portability. The `ropey` buffer is easy to add to Rust, but the "windowed streaming" to the frontend requires a new Tauri command and Svelte logic. |
| **c. Live Pipeline**       | **Direct Port (Rust)**   | High portability. The process spawning and stdin/stdout piping logic is pure Rust and framework-agnostic.                                                    |
| **d. Terminal Layouts**    | **Product Design Donor** | Low code portability. Ferrite uses a custom Rust layout engine for `egui`. Otterly uses Svelte. Borrow the JSON schema, but rewrite the UI logic.            |
| **e. Single Instance**     | **Direct Port (Rust)**   | High portability. The IPC logic for detecting a running instance and forwarding CLI args is standard Rust/OS integration.                                    |
| **f. Atomic File Writes**  | **Direct Port (Rust)**   | High portability. Standard filesystem operation that should be implemented across all Carbide file writers.                                                  |

## Comparison with Lokus

While Lokus serves as a great **Product/UI donor** (Graph, Bases, Deep UI themes), Ferrite serves as an excellent **Backend/System donor**. Ferrite's focus on text correctness (Rope buffers, atomic saves, encoding detection) addresses exactly the blind spots inherent in web-first Tauri apps.

## How Rust Ports Improve Otterly

Porting the Rust-native logic from **Ferrite** to **Otterly** would solve several "blind spots" inherent in web-first Tauri applications.

### 1. Data Integrity & Safety (Atomic Writes)

- **Today's Risk:** Otterly currently writes files directly. If the app crashes, the computer loses power, or a sync tool (like Dropbox/iCloud) conflicts during a write, the file can be "torn" or corrupted.
- **The Improvement:** By porting Ferrite's **Atomic Save** pattern, Otterly would write to a `.tmp` file first and then use a syscall to `rename` it to the final destination. This ensures the note is either 100% saved or 100% original, with no state in between. This is critical for "local-first" knowledge integrity.

### 2. Handling "Real-World" Data (Encoding Detection)

- **Today's Risk:** Otterly assumes everything is UTF-8. If a user imports legacy notes, CSV exports from old Windows systems (Latin-1), or Japanese Shift-JIS files, Otterly may display "mojibake" (garbage text) or potentially corrupt the file upon saving.
- **The Improvement:** Porting the `chardetng` and `encoding_rs` integration allows Otterly to **auto-detect and preserve** the original encoding. This makes Carbide a viable tool for professionals moving existing data into their vaults.

### 3. Solving the Tauri IPC Bottleneck (Rope Buffers)

- **Today's Risk:** Passing a 50MB log file or CSV from Rust to the Svelte frontend as a single JSON string will freeze the UI thread and consume massive amounts of RAM during serialization.
- **The Improvement:** By using a **Rope data structure (`ropey`)** in Rust, Otterly can implement "windowed" reading. Instead of sending the whole file, the Rust backend only sends the specific chunk of text (e.g., lines 1,000 to 1,100) that the user is currently viewing. This allows Otterly to open gigabyte-sized files instantly with near-zero memory footprint.

### 4. Architectural Extensibility (The "Pipeline" Pattern)

- **Today's Risk:** The planned AI implementation (Phase 6d) is currently thinking in terms of "hardcoded" commands for Claude or Ollama. This is difficult to maintain and scale.
- **The Improvement:** Ferrite's **Live Pipeline** architecture treats every external tool as a generic stdin/stdout stream. Porting this allows the Carbide **Plugin System** to easily support _any_ local tool (e.g., `grep`, `jq`, `sed`, or a custom Python script) as a first-class citizen for data processing, not just specific AI providers.

### 5. OS-Level Polish (Single Instance IPC)

- **Today's Risk:** If Carbide is set as the default `.md` handler, double-clicking a file in Finder might launch a second, redundant instance of the app instead of opening a new tab in the running instance.
- **The Improvement:** Ferrite's `single_instance.rs` logic provides a robust way for a "new" process to detect an "existing" one and forward the file path over a local socket. This makes the app feel like a native professional tool rather than a "web wrapper."

### Summary of Impact

| Feature                | Long-Term Viability Impact                                      |
| :--------------------- | :-------------------------------------------------------------- |
| **Atomic Writes**      | **High:** Prevents data loss; critical for user trust.          |
| **Encoding Detection** | **Medium:** Essential for importing heterogeneous data.         |
| **Rope IPC**           | **High:** Unlocks "Big Data" workflows (logs, CSVs) in Carbide. |
| **CLI Pipeline**       | **High:** Future-proofs the Plugin System.                      |
| **Single Instance**    | **Low:** UX polish; improves macOS/Windows integration.         |

## Implementation Priorities for Carbide

1. **Atomic File Writes:** Implement temp-file based saving immediately for `search.db` and markdown files to prevent corruption (sync issues discussed in `db_sync.md`).
2. **Encoding Detection:** Integrate `chardetng` in the Tauri file read command before Phase 7 (Document Viewers) expands to arbitrary text/CSV files.
3. **Single Instance Protocol:** Use Ferrite's IPC approach as reference for the Phase 3 macOS file association handler.
