import { describe, expect, it, vi } from "vitest";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import {
  AssistantProposalStore,
  ProposalApplyService,
  ProposalRevertService,
  compute_note_revision,
  parse_stored,
  to_stored,
} from "$lib/features/assistant";
import {
  make_proposal,
  make_proposal_hunk,
  make_proposal_line,
} from "../helpers/assistant_proposal_fixtures";

function make_harness() {
  const proposals = new AssistantProposalStore();
  const ops = new OpStore();
  let disk = "original";
  const anchors = new Map<string, string>();
  const notes = {
    read_note: vi.fn(() => Promise.resolve(disk)),
    write_note: vi.fn((_path: string, content: string) => {
      disk = content;
      return Promise.resolve();
    }),
  };
  const checkpoint = {
    create_checkpoint: vi.fn(() => Promise.resolve("created" as const)),
  };
  const apply = new ProposalApplyService({
    proposals,
    ops,
    notes,
    git: checkpoint,
    documents: { read_document: () => null, stage_document: () => false },
  });
  const revert = new ProposalRevertService({
    proposals,
    ops,
    notes,
    checkpoint,
    git: {
      get_file_at_commit: (_path, anchor) => {
        const content = anchors.get(anchor);
        if (content === undefined) throw new Error(`Unknown anchor ${anchor}`);
        return Promise.resolve(content);
      },
    },
  });
  function stage(turn: number, content: string) {
    const anchor = `anchor-${String(turn)}`;
    anchors.set(anchor, disk);
    const proposal = make_proposal({
      target: { kind: "note", note_path: "a.md" },
      base_revision: compute_note_revision(disk),
      created_at: turn,
      origin: {
        session_id: "s1",
        run_id: `run-${String(turn)}`,
        anchor,
        anchor_applied_ids: proposals.proposals
          .filter((p) => p.status === "applied")
          .map((p) => p.id),
      },
      hunks: [
        make_proposal_hunk({
          lines: [
            make_proposal_line({
              kind: "del",
              content: disk,
              old_line: 1,
              new_line: null,
            }),
            make_proposal_line({
              kind: "add",
              content,
              old_line: null,
              new_line: 1,
            }),
          ],
        }),
      ],
    });
    proposals.add(proposal);
    return proposal.id;
  }
  return {
    proposals,
    ops,
    notes,
    checkpoint,
    apply,
    revert,
    stage,
    content: () => disk,
  };
}

describe("proposal apply order and checkpoint restoration", () => {
  it("refuses a persisted pending turn colliding with a new run id after restart", async () => {
    const h = make_harness();
    const old_id = h.stage(1, "edited");
    const stored = JSON.parse(
      JSON.stringify(to_stored(h.proposals.proposals, 100)),
    ) as unknown;
    h.proposals.hydrate(parse_stored(stored));
    const new_id = h.stage(1, "edited");
    const fresh = h.proposals.get(new_id);
    if (!fresh) throw new Error("Expected fresh proposal");
    fresh.created_at = 200;
    expect((await h.apply.apply_batch([old_id, new_id])).applied).toEqual([
      old_id,
      new_id,
    ]);

    expect(
      (await h.revert.revert_turn("run-1", { confirmed: true })).status,
    ).toBe("refused");
    expect(h.content()).toBe("edited");
    expect(h.proposals.proposals.map((p) => p.status)).toEqual([
      "applied",
      "applied",
    ]);
  });

  it("cannot reapply a reverted proposal using its former anchor membership", async () => {
    const h = make_harness();
    const id = h.stage(1, "edited");
    await h.apply.apply_batch([id]);
    await h.revert.revert_turn("run-1", { confirmed: true });

    expect((await h.apply.apply_batch([id])).failed).toEqual([
      { id, error: "proposal is reverted, not pending" },
    ]);
    expect(h.content()).toBe("original");
  });

  it("preserves turn 1 on the same file after sequential capture and apply of three turns", async () => {
    const h = make_harness();
    for (const turn of [1, 2, 3]) {
      const id = h.stage(turn, `after turn ${String(turn)}`);
      expect((await h.apply.apply_batch([id])).applied).toEqual([id]);
    }

    expect(
      (await h.revert.revert_turn("run-2", { confirmed: true })).status,
    ).toBe("reverted");

    expect(h.content()).toBe("after turn 1");
    expect(h.proposals.proposals.map((p) => p.status)).toEqual([
      "applied",
      "reverted",
      "reverted",
    ]);
  });

  it.each([
    [1, 2],
    [2, 1],
  ])(
    "refuses staged same-file turns applied after their anchors in order %j",
    async (first, second) => {
      const h = make_harness();
      const ids = [h.stage(1, "edited"), h.stage(2, "edited")];
      const first_id = ids[first - 1];
      const second_id = ids[second - 1];
      if (!first_id || !second_id)
        throw new Error("Expected both staged proposals");
      const apply_ids = [first_id, second_id];
      expect((await h.apply.apply_batch(apply_ids)).applied).toEqual(apply_ids);
      expect(h.content()).toBe("edited");

      const outcome = await h.revert.revert_turn("run-2", { confirmed: true });

      expect(outcome.status).toBe("refused");
      expect(h.content()).toBe("edited");
      expect(h.proposals.proposals.map((p) => p.status)).toEqual([
        "applied",
        "applied",
      ]);
    },
  );

  it("rejects applies during a revert without changing pending proposals", async () => {
    const h = make_harness();
    const id = h.stage(1, "edited");
    await h.apply.apply_batch([id]);
    const pending = h.stage(2, "later");
    let release = () => {};
    h.checkpoint.create_checkpoint.mockImplementationOnce(
      () =>
        new Promise<"created">((resolve) => {
          release = () => {
            resolve("created");
          };
        }),
    );
    const reverting = h.revert.revert_turn("run-1", { confirmed: true });

    const applied = await h.apply.apply_batch([pending]);
    expect(applied.failed).toEqual([
      { id: pending, error: "Another proposal operation is in progress." },
    ]);
    expect(h.proposals.get(pending)?.status).toBe("pending");
    release();
    expect((await reverting).status).toBe("reverted");
    expect(h.content()).toBe("original");
  });

  it("rejects reverts during an apply and releases the gate after failure", async () => {
    const h = make_harness();
    const id = h.stage(1, "edited");
    await h.apply.apply_batch([id]);
    const pending = h.stage(2, "later");
    let fail = () => {};
    h.notes.read_note.mockImplementationOnce(
      () =>
        new Promise<string>((_resolve, reject) => {
          fail = () => {
            reject(new Error("read failed"));
          };
        }),
    );
    const applying = h.apply.apply_batch([pending]);

    expect(
      (await h.revert.revert_turn("run-1", { confirmed: true })).status,
    ).toBe("refused");
    fail();
    await expect(applying).rejects.toThrow("read failed");
    expect(
      (await h.revert.revert_turn("run-1", { confirmed: true })).status,
    ).toBe("reverted");
  });
});
