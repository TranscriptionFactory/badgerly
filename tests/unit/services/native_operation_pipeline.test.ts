import { require_fixture } from "../helpers/require_fixture";
import { describe, expect, it, vi } from "vitest";
import fixtures from "../../fixtures/2026-09-05_native_edit_proposals.json";
import {
  AgentRunner,
  AssistantChatStore,
  AssistantSessionStore,
  AssistantProposalStore,
} from "$lib/features/assistant";
import { AgentProposalService } from "$lib/features/assistant/application/agent_proposal_service";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { VaultStore } from "$lib/features/vault";
import type { NativeProposal } from "$lib/generated/bindings";
import type { AiProviderConfig } from "$lib/shared/types/ai_provider_config";
import { create_test_vault } from "../helpers/test_fixtures";
import { create_test_run_starter } from "../../adapters/test_run_starter";
import { validate_edit_operations } from "$lib/features/assistant/domain/edit_operations";
import { build_native_proposal } from "$lib/features/assistant/domain/native_proposals";
import {
  parse_stored,
  to_stored,
} from "$lib/features/assistant/domain/proposal_storage";
const provider: AiProviderConfig = {
  id: "native",
  name: "Native",
  transport: { kind: "cli", command: "unused", args: [] },
};
describe("native tool operations through the runner into the review queue", () => {
  it("refuses a proposal emitted for another vault even when its note bytes match", () => {
    const input = {
      ...require_fixture(fixtures[0]),
      vault_id: "vault-B",
    } as NativeProposal;
    expect(() =>
      build_native_proposal(
        input,
        { session_id: "s", run_id: "r" },
        1,
        0,
        "vault-A",
      ),
    ).toThrow("different vault");
  });
  it.each(fixtures)(
    "queues $operations.0.kind without note writes, rollback or mtime capture",
    async (fixture) => {
      const input = fixture as NativeProposal;
      const chat = new AssistantChatStore(new AssistantSessionStore());
      chat.set_mode("agent");
      chat.add_user_message("propose this edit");
      const vault = new VaultStore();
      vault.set_vault(create_test_vault());
      const queue = new AssistantProposalStore();
      const git = { get_working_diff: vi.fn(), get_file_at_commit: vi.fn() };
      const notes = { write_note: vi.fn() };
      const producer = new AgentProposalService(git, notes, queue, () => 123);
      const mtime = vi.fn();
      const starter = create_test_run_starter(() => [
        {
          type: "tool_start",
          id: "tool",
          name: "edit_note",
          kind: "edit",
          input_summary: "typed operation",
          paths: [input.path],
          mutating: true,
          locations: [],
        },
        {
          type: "tool_end",
          id: "tool",
          name: "edit_note",
          ok: true,
          paths: [input.path],
          mutating: true,
          proposals: [input],
        },
        { type: "done", stats: {} },
      ]);
      const runner = new AgentRunner(
        starter,
        chat,
        vault,
        { create_checkpoint: () => Promise.resolve({ status: "no_repo" }) },
        vi.fn(),
        vi.fn(),
        producer,
        mtime,
        { proposals: queue, ops: new OpStore() },
      );
      expect(
        await runner.run_turn(provider, "propose this edit", "native"),
      ).toEqual({ status: "done" });
      expect(queue.pending).toHaveLength(1);
      const proposal = require_fixture(queue.pending[0]);
      expect(proposal.operations).toEqual(input.operations);
      expect(proposal.conversion).toBe("native");
      expect(() => {
        validate_edit_operations(proposal);
      }).not.toThrow();
      expect(notes.write_note).not.toHaveBeenCalled();
      expect(git.get_working_diff).not.toHaveBeenCalled();
      expect(mtime).not.toHaveBeenCalled();
      expect(parse_stored(to_stored(queue.pending, 456))).toHaveLength(1);
      expect(
        parse_stored(
          to_stored(
            [
              {
                ...proposal,
                mutations: [{ path: "unrelated.md", before: "x", after: "y" }],
              },
            ],
            456,
          ),
        ),
      ).toHaveLength(0);
    },
  );
});
