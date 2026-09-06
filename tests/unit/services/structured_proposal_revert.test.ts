import { require_fixture } from "../helpers/require_fixture";
import { describe, expect, it, vi } from "vitest";
import { ProposalRevertService } from "$lib/features/assistant/application/proposal_revert_service";
import { AssistantProposalStore } from "$lib/features/assistant/state/assistant_proposal_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { plan_turn_revert } from "$lib/features/assistant/domain/proposal_turns";
import type { ProposalMutation } from "$lib/features/assistant/types/edit_operation";
import { make_proposal } from "../helpers/assistant_proposal_fixtures";
function setup() {
  const proposals = new AssistantProposalStore();
  proposals.add_many([
    make_proposal({
      id: "earlier",
      target: { kind: "note", note_path: "a.md" },
      status: "applied",
      created_at: 1,
      origin: {
        session_id: "s",
        run_id: "one",
        anchor: "initial",
        anchor_applied_ids: [],
      },
    }),
    make_proposal({
      id: "rename",
      target: { kind: "note", note_path: "a.md" },
      status: "applied",
      created_at: 2,
      origin: {
        session_id: "s",
        run_id: "two",
        anchor: "after-one",
        anchor_applied_ids: ["earlier"],
      },
      mutations: [
        { path: "a.md", before: "earlier", after: null },
        { path: "new.md", before: null, after: "earlier" },
        { path: "backlink.md", before: "[[a]]", after: "[[new]]" },
      ],
    }),
    make_proposal({
      id: "later",
      target: { kind: "note", note_path: "new.md" },
      status: "applied",
      created_at: 3,
      origin: {
        session_id: "s",
        run_id: "three",
        anchor: "after-two",
        anchor_applied_ids: ["earlier", "rename"],
      },
      mutations: [{ path: "new.md", before: "earlier", after: "later" }],
    }),
  ]);
  const restore: ProposalMutation[] = [
    { path: "a.md", before: null, after: "earlier" },
    { path: "new.md", before: "later", after: null },
    { path: "backlink.md", before: "[[new]]", after: "[[a]]" },
  ];
  const mutations = {
    current_vault: () => "vault",
    prepare_rename: vi.fn(),
    anchor_mutations: vi.fn(() => Promise.resolve(restore)),
    apply_mutations: vi.fn((_items: ProposalMutation[]) => {
      return Promise.resolve();
    }),
  };
  const checkpoint = {
    create_checkpoint: vi.fn(() => Promise.resolve("created" as const)),
  };
  const service = new ProposalRevertService({
    proposals,
    ops: new OpStore(),
    mutations,
    checkpoint,
    git: { get_file_at_commit: vi.fn() },
    notes: { read_note: vi.fn(), write_note: vi.fn() },
  });
  return { proposals, mutations, checkpoint, service, restore };
}
describe("multi-path rename undo", () => {
  it("includes source, absent destination and backlinks, preserving earlier turn membership", async () => {
    const h = setup();
    expect(
      (await h.service.revert_turn("two", { confirmed: false })).status,
    ).toBe("needs_confirmation");
    expect(h.checkpoint.create_checkpoint).not.toHaveBeenCalled();
    const outcome = await h.service.revert_turn("two", { confirmed: true });
    expect(outcome).toMatchObject({
      status: "reverted",
      restored_note_paths: ["a.md", "new.md", "backlink.md"],
      failed: [],
    });
    expect(h.mutations.anchor_mutations).toHaveBeenCalledWith(
      ["a.md", "new.md", "backlink.md"],
      "after-one",
    );
    expect(h.mutations.apply_mutations).toHaveBeenCalledWith(h.restore);
    expect(h.proposals.get("earlier")?.status).toBe("applied");
    expect(h.proposals.get("rename")?.status).toBe("reverted");
    expect(h.proposals.get("later")?.status).toBe("reverted");
  });
  it("refuses collateral backlink edits absent from the checkpoint before creating another checkpoint", async () => {
    const h = setup();
    h.proposals.add(
      make_proposal({
        id: "unrelated",
        status: "applied",
        target: { kind: "note", note_path: "backlink.md" },
        origin: { session_id: "other", run_id: "other", anchor: "some" },
      }),
    );
    expect(
      (await h.service.revert_turn("two", { confirmed: true })).status,
    ).toBe("refused");
    expect(h.checkpoint.create_checkpoint).not.toHaveBeenCalled();
  });
  it("leaves every proposal applied when the atomic restore fails", async () => {
    const h = setup();
    h.mutations.apply_mutations.mockRejectedValue(
      new Error("changed after checkpoint"),
    );
    const outcome = await h.service.revert_turn("two", { confirmed: true });
    expect(outcome).toMatchObject({
      status: "reverted",
      restored_note_paths: [],
    });
    expect(
      h.proposals.proposals.every((proposal) => proposal.status === "applied"),
    ).toBe(true);
  });
  it("changes the confirmation's note path scope when actual mutation membership changes", () => {
    const h = setup();
    const before = plan_turn_revert(h.proposals.proposals, "two");
    h.proposals.set_mutations("rename", [
      ...require_fixture(require_fixture(h.proposals.get("rename")).mutations),
      { path: "extra.md", before: "a", after: "b" },
    ]);
    const after = plan_turn_revert(h.proposals.proposals, "two");
    expect(before.status).toBe("ready");
    expect(after.status).toBe("ready");
    if (before.status !== "ready" || after.status !== "ready")
      throw new Error("Expected confirmation scopes");
    expect(after.note_paths).toContain("extra.md");
    expect(after.note_paths).not.toEqual(before.note_paths);
  });
});
