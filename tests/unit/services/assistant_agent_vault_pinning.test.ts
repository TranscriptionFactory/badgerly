import { describe, expect, it, vi } from "vitest";
import fixtures from "../../fixtures/2026-09-05_native_edit_proposals.json";
import {
  AgentRunner,
  AssistantChatStore,
  AssistantProposalStore,
  AssistantSessionStore,
} from "$lib/features/assistant";
import { AgentProposalService } from "$lib/features/assistant/application/agent_proposal_service";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { VaultStore } from "$lib/features/vault";
import type { GitDiff } from "$lib/features/git";
import type { GitDiffHunk } from "$lib/features/assistant/domain/agent_turn_proposals";
import type { NativeProposal } from "$lib/generated/bindings";
import type { AiProviderConfig } from "$lib/shared/types/ai_provider_config";
import { as_vault_id, as_vault_path } from "$lib/shared/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";
import { create_test_run_starter } from "../../adapters/test_run_starter";
import { require_fixture } from "../helpers/require_fixture";

const provider: AiProviderConfig = {
  id: "native",
  name: "Native",
  transport: { kind: "cli", command: "unused", args: [] },
};

const anchor = "anchor-sha";
const legacy_path = "legacy.md";
const legacy_base = "before\ntail\n";

// The only pending promise in either window. Resolving it is the sole way the
// turn can move past the await under test, so the vault switch cannot race it.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

// Drains the microtask queue, so an assertion made after it observes the turn
// parked on the deferred promise rather than mid-chain.
function drain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function modified_diff(note_path: string): GitDiff {
  const hunk: GitDiffHunk = {
    file_path: note_path,
    header: "@@ -1,2 +1,2 @@",
    lines: [
      { type: "deletion", content: "before\n", old_line: 1, new_line: null },
      { type: "addition", content: "after\n", old_line: null, new_line: 1 },
      { type: "context", content: "tail\n", old_line: 2, new_line: 2 },
    ],
  };
  return { additions: 1, deletions: 1, hunks: [hunk] };
}

function native_input(): NativeProposal {
  return { ...require_fixture(fixtures[0]) } as NativeProposal;
}

describe("run-pinned vault identity across awaits", () => {
  it("refuses a mixed turn whose vault changed while note mtimes were resolving", async () => {
    const chat = new AssistantChatStore(new AssistantSessionStore());
    chat.set_mode("agent");
    chat.add_user_message("organize my notes");
    const vault = new VaultStore();
    vault.set_vault(create_test_vault());
    const native = native_input();

    const queue = new AssistantProposalStore();
    const git = {
      get_working_diff: vi.fn(() =>
        Promise.resolve(modified_diff(legacy_path)),
      ),
      get_file_at_commit: vi.fn(() => Promise.resolve(legacy_base)),
    };
    const notes = { write_note: vi.fn(() => Promise.resolve()) };
    const producer = new AgentProposalService(git, notes, queue, () => 1_700);

    const mtime_gate = deferred<number | null>();
    const read_note_mtime = vi.fn(() => mtime_gate.promise);

    const starter = create_test_run_starter(() => [
      {
        type: "tool_start",
        id: "legacy",
        name: "mcp__carbide__update_note",
        kind: "edit",
        input_summary: "legacy write",
        paths: [legacy_path],
        mutating: true,
        locations: [],
      },
      {
        type: "tool_end",
        id: "legacy",
        name: "mcp__carbide__update_note",
        ok: true,
        paths: [legacy_path],
        mutating: true,
      },
      {
        type: "tool_start",
        id: "typed",
        name: "mcp__carbide__edit_note",
        kind: "edit",
        input_summary: "typed operation",
        paths: [native.path],
        mutating: true,
        locations: [],
      },
      {
        type: "tool_end",
        id: "typed",
        name: "mcp__carbide__edit_note",
        ok: true,
        paths: [native.path],
        mutating: true,
        proposals: [native],
      },
      { type: "done", stats: {} },
    ]);

    const runner = new AgentRunner(
      starter,
      chat,
      vault,
      {
        create_checkpoint: () =>
          Promise.resolve({ status: "created" as const, sha: anchor }),
      },
      vi.fn(),
      vi.fn(),
      producer,
      read_note_mtime,
      { proposals: queue, ops: new OpStore() },
    );

    const turn = runner.run_turn(provider, "organize my notes", "native");
    await drain();
    expect(read_note_mtime).toHaveBeenCalledWith(legacy_path);
    expect(git.get_working_diff).not.toHaveBeenCalled();

    vault.set_vault(
      create_test_vault({
        id: as_vault_id("vault-2"),
        name: "Second Vault",
        path: as_vault_path("/test/vault-2"),
      }),
    );
    mtime_gate.resolve(1_000);

    expect(await turn).toEqual({ status: "done" });
    expect(notes.write_note).not.toHaveBeenCalled();
    expect(queue.pending).toHaveLength(0);
    expect(git.get_working_diff).not.toHaveBeenCalled();
    expect(git.get_file_at_commit).not.toHaveBeenCalled();
  });

  it("keeps a paused producer's proposals out of the queue of the vault switched to", async () => {
    let active_vault_id = "vault-1";
    const restore_gate = deferred<string>();
    const git = {
      get_working_diff: vi.fn(() =>
        Promise.resolve(modified_diff(legacy_path)),
      ),
      get_file_at_commit: vi.fn(() => restore_gate.promise),
    };
    const notes = { write_note: vi.fn(() => Promise.resolve()) };
    const queue = new AssistantProposalStore();
    const add_many = vi.spyOn(queue, "add_many");
    const service = new AgentProposalService(git, notes, queue, () => 1_700);

    const producing = service.produce({
      anchor,
      vault_id: "vault-1",
      is_run_vault_active: () => active_vault_id === "vault-1",
      native_proposals: [native_input()],
      origin: { session_id: "session-1", run_id: "run-1" },
      touched_paths: [legacy_path],
      expected_mtimes: {},
    });

    await drain();
    expect(git.get_file_at_commit).toHaveBeenCalledWith(legacy_path, anchor);
    expect(notes.write_note).not.toHaveBeenCalled();

    active_vault_id = "vault-2";
    restore_gate.resolve(legacy_base);

    const report = await producing;
    expect(notes.write_note).not.toHaveBeenCalled();
    expect(add_many).not.toHaveBeenCalled();
    expect(queue.pending).toHaveLength(0);
    expect(report.status).toBe("vault_changed");
    expect(report.proposed).toEqual([]);
  });
});
