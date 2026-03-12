# Implementation Plan: Porting Ferrite Rust Logic to Carbide/Otterly

## Goal
Improve Carbide's data integrity, performance with large files, and architectural extensibility by porting high-value Rust-native components from the Ferrite codebase.

## Phase 1: Data Safety & Integrity (Immediate)

### 1.1 Atomic File Writes
- **Objective:** Prevent file corruption during crashes or sync conflicts.
- **Tasks:**
    - Create `src-tauri/src/shared/io_utils.rs`.
    - Implement `atomic_write(path, content)` which:
        1. Writes to `<filename>.tmp`.
        2. Calls `std::fs::File::sync_all()` to ensure data is on disk.
        3. Uses `std::fs::rename()` to atomically replace the target file.
    - Update `NoteService` (Rust) and `VaultService` (Rust) to use `atomic_write` for all `.md`, `.json`, and `.db` operations.
- **Verification:** Force-kill the app during a large save operation and verify the target file remains uncorrupted (either original or fully updated).

### 1.2 Encoding Detection
- **Objective:** Support legacy and regional file encodings without data loss.
- **Tasks:**
    - Add `chardetng` and `encoding_rs` to `src-tauri/Cargo.toml`.
    - Modify the `read_vault_file` Tauri command to:
        1. Read the raw bytes.
        2. Use `chardetng` to guess the encoding.
        3. Convert to UTF-8 for the frontend.
        4. (Optional) Return the detected encoding so the frontend can display it.
- **Verification:** Create test files in Latin-1 and Shift-JIS; ensure they render correctly in the "Code/Text Viewer".

## Phase 2: High-Performance Large Files (Mid-Term)

### 2.1 Rust Rope Buffer (`ropey`)
- **Objective:** Open massive text files (100MB+) instantly without freezing the UI.
- **Tasks:**
    - Add `ropey` to `src-tauri/Cargo.toml`.
    - Implement a `ManagedBuffer` state in Rust that holds a `Rope` of the open file.
    - Create a new Tauri command `read_buffer_window(buffer_id, start_line, end_line)`.
    - Update the frontend `DocumentViewer` to use "windowed" loading for the `text` and `code` file types.
- **Verification:** Open a 50MB log file and verify near-instant UI responsiveness and low memory usage.

## Phase 3: Extensibility & Polish (Future)

### 3.1 Generic CLI Pipeline
- **Objective:** Future-proof the AI integration and Plugin system.
- **Tasks:**
    - Extract Ferrite's process spawning logic into `src-tauri/src/features/pipeline/`.
    - Implement a `pipeline_execute(command, input_text)` command.
    - Re-implement `ai_execute_claude` and others as special cases of this generic pipeline.
    - Expose this pipeline to the (future) Plugin API.
- **Verification:** Successfully pipe a JSON note through `jq` via the command palette.

### 3.2 Single Instance IPC
- **Objective:** Ensure professional OS integration.
- **Tasks:**
    - Adapt Ferrite's `single_instance.rs` to Otterly's `main.rs`.
    - On launch: check for a named pipe/socket.
    - If exists: send CLI arguments (file paths) to the socket and exit.
    - If not: start the socket listener and the app.
- **Verification:** Open Otterly, then double-click an `.md` file in Finder; verify it opens as a new tab in the existing window.

## Success Criteria
- [ ] 0% file corruption reports due to tearing.
- [ ] Successful rendering of non-UTF-8 files.
- [ ] Instant opening of files > 10MB in the Document Viewer.
- [ ] Unified CLI execution logic for AI and standard tools.
