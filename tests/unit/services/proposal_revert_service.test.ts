import { describe, expect, it, vi } from "vitest";
import {
  AssistantProposalStore,
  ProposalRevertService,
  type ProposalCheckpointOutcome,
} from "$lib/features/assistant";
import { make_turn_proposal } from "../helpers/assistant_proposal_fixtures";

function make_harness(
  checkpoint_outcome: ProposalCheckpointOutcome = "created",
) {
  const proposals = new AssistantProposalStore();
  proposals.hydrate([
    make_turn_proposal({ run_id: "run-1", created_at: 100, note_path: "a.md" }),
    make_turn_proposal({ run_id: "run-2", created_at: 200, note_path: "a.md" }),
    make_turn_proposal({ run_id: "run-2", created_at: 200, note_path: "b.md" }),
    make_turn_proposal({ run_id: "run-3", created_at: 300, note_path: "c.md" }),
  ]);
  const disk = new Map<string, string>([
    ["a.md", "a after turn 2 and user edits"],
    ["b.md", "b after turn 2"],
    ["c.md", "c after turn 3"],
  ]);
  const notes = {
    read_note: vi.fn((note_path: string) =>
      Promise.resolve(disk.get(note_path) ?? null),
    ),
    write_note: vi.fn((note_path: string, content: string) => {
      disk.set(note_path, content);
      return Promise.resolve();
    }),
  };
  const git = {
    get_file_at_commit: vi.fn((file_path: string, commit_hash: string) =>
      Promise.resolve(`${file_path}@${commit_hash}`),
    ),
  };
  const checkpoint = {
    create_checkpoint: vi.fn(() => Promise.resolve(checkpoint_outcome)),
  };
  const service = new ProposalRevertService({
    proposals,
    notes,
    git,
    checkpoint,
  });
  const status_of = (run_id: string) =>
    proposals.proposals
      .filter((p) => p.origin.run_id === run_id)
      .map((p) => p.status);
  return { proposals, notes, git, checkpoint, service, disk, status_of };
}

describe("ProposalRevertService.revert_turn", () => {
  it("apply three turns, revert turn 2 → turns 2 and 3 undone, turn 1 intact, git port called once per touched path with turn 2's anchor", async () => {
    const h = make_harness();

    const outcome = await h.service.revert_turn("run-2", { confirmed: true });

    expect(outcome.status).toBe("reverted");
    expect(h.git.get_file_at_commit.mock.calls).toEqual([
      ["a.md", "anchor-run-2"],
      ["b.md", "anchor-run-2"],
      ["c.md", "anchor-run-2"],
    ]);
    expect(h.disk.get("a.md")).toBe("a.md@anchor-run-2");
    expect(h.disk.get("c.md")).toBe("c.md@anchor-run-2");
    expect(h.status_of("run-1")).toEqual(["applied"]);
    expect(h.status_of("run-2")).toEqual(["reverted", "reverted"]);
    expect(h.status_of("run-3")).toEqual(["reverted"]);
    expect(h.checkpoint.create_checkpoint).toHaveBeenCalledWith(
      "before reverting turn 2",
    );
  });

  it("revert turn 2 when turn 3 applied edits → confirmation requested naming turn 3; declining changes nothing", async () => {
    const h = make_harness();

    const outcome = await h.service.revert_turn("run-2", { confirmed: false });

    expect(outcome.status).toBe("needs_confirmation");
    if (outcome.status !== "needs_confirmation") return;
    expect(outcome.plan.later_turns.map((turn) => turn.ordinal)).toEqual([3]);
    expect(h.git.get_file_at_commit).not.toHaveBeenCalled();
    expect(h.notes.write_note).not.toHaveBeenCalled();
    expect(h.checkpoint.create_checkpoint).not.toHaveBeenCalled();
    expect(h.status_of("run-2")).toEqual(["applied", "applied"]);
    expect(h.status_of("run-3")).toEqual(["applied"]);
  });

  it("needs no confirmation for the newest applied turn", async () => {
    const h = make_harness();

    const outcome = await h.service.revert_turn("run-3", { confirmed: false });

    expect(outcome.status).toBe("reverted");
    expect(h.git.get_file_at_commit.mock.calls).toEqual([
      ["c.md", "anchor-run-3"],
    ]);
    expect(h.status_of("run-2")).toEqual(["applied", "applied"]);
  });

  it("revert a turn whose anchor is null → action refused with a reason, no git calls", async () => {
    const h = make_harness();
    h.proposals.hydrate([
      make_turn_proposal({
        run_id: "run-1",
        created_at: 100,
        note_path: "a.md",
        anchor: null,
      }),
    ]);

    const outcome = await h.service.revert_turn("run-1", { confirmed: true });

    expect(outcome.status).toBe("refused");
    if (outcome.status !== "refused") return;
    expect(outcome.reason).toContain("No checkpoint was recorded");
    expect(h.git.get_file_at_commit).not.toHaveBeenCalled();
    expect(h.checkpoint.create_checkpoint).not.toHaveBeenCalled();
    expect(h.status_of("run-1")).toEqual(["applied"]);
  });

  it("takes one checkpoint before restoring and refuses the whole revert when it fails", async () => {
    const h = make_harness("failed");

    const outcome = await h.service.revert_turn("run-3", { confirmed: true });

    expect(outcome).toEqual({
      status: "refused",
      reason: "checkpoint failed; nothing reverted",
    });
    expect(h.checkpoint.create_checkpoint).toHaveBeenCalledTimes(1);
    expect(h.notes.write_note).not.toHaveBeenCalled();
    expect(h.status_of("run-3")).toEqual(["applied"]);
  });

  it("leaves a proposal applied and reports the path when the note is absent at the anchor", async () => {
    const h = make_harness();
    h.git.get_file_at_commit.mockImplementation((file_path, commit_hash) =>
      file_path === "c.md"
        ? Promise.reject(new Error("file not found at commit"))
        : Promise.resolve(`${file_path}@${commit_hash}`),
    );

    const outcome = await h.service.revert_turn("run-2", { confirmed: true });

    expect(outcome.status).toBe("reverted");
    if (outcome.status !== "reverted") return;
    expect(outcome.restored_note_paths).toEqual(["a.md", "b.md"]);
    expect(outcome.failed).toEqual([
      { note_path: "c.md", error: "file not found at commit" },
    ]);
    expect(h.status_of("run-2")).toEqual(["reverted", "reverted"]);
    expect(h.status_of("run-3")).toEqual(["applied"]);
  });

  it("reads the note before writing so the port's mtime guard sees the current file", async () => {
    const h = make_harness();
    const order: string[] = [];
    h.notes.read_note.mockImplementation((note_path) => {
      order.push(`read:${note_path}`);
      return Promise.resolve("current");
    });
    h.notes.write_note.mockImplementation((note_path) => {
      order.push(`write:${note_path}`);
      return Promise.resolve();
    });

    await h.service.revert_turn("run-3", { confirmed: true });

    expect(order).toEqual(["read:c.md", "write:c.md"]);
  });

  it("treats a note that no longer exists as a failed path", async () => {
    const h = make_harness();
    h.disk.delete("c.md");

    const outcome = await h.service.revert_turn("run-3", { confirmed: true });

    if (outcome.status !== "reverted") throw new Error(outcome.status);
    expect(outcome.failed).toEqual([
      { note_path: "c.md", error: "the note no longer exists" },
    ]);
    expect(h.status_of("run-3")).toEqual(["applied"]);
  });

  it("skips the write when disk already holds the anchor's bytes", async () => {
    const h = make_harness();
    h.disk.set("c.md", "c.md@anchor-run-3");

    const outcome = await h.service.revert_turn("run-3", { confirmed: true });

    if (outcome.status !== "reverted") throw new Error(outcome.status);
    expect(h.notes.write_note).not.toHaveBeenCalled();
    expect(outcome.restored_note_paths).toEqual(["c.md"]);
    expect(h.status_of("run-3")).toEqual(["reverted"]);
  });
});

describe("ProposalRevertService.revert_session", () => {
  it("revert_session on a session with no applied proposals → no-op, no confirmation", async () => {
    const h = make_harness();
    h.proposals.hydrate([
      make_turn_proposal({
        run_id: "run-1",
        created_at: 100,
        note_path: "a.md",
        status: "reverted",
      }),
    ]);

    const outcome = await h.service.revert_session("session-1", {
      confirmed: false,
    });

    expect(outcome).toEqual({ status: "nothing" });
    expect(h.checkpoint.create_checkpoint).not.toHaveBeenCalled();
    expect(h.git.get_file_at_commit).not.toHaveBeenCalled();
  });

  it("reverts from the earliest applied turn and asks first when later turns are applied", async () => {
    const h = make_harness();

    const asked = await h.service.revert_session("session-1", {
      confirmed: false,
    });
    expect(asked.status).toBe("needs_confirmation");
    if (asked.status !== "needs_confirmation") return;
    expect(asked.plan.target.turn_id).toBe("run-1");
    expect(asked.plan.later_turns.map((turn) => turn.turn_id)).toEqual([
      "run-2",
      "run-3",
    ]);

    const outcome = await h.service.revert_session("session-1", {
      confirmed: true,
    });
    expect(outcome.status).toBe("reverted");
    expect(
      h.git.get_file_at_commit.mock.calls.map(([, anchor]) => anchor),
    ).toEqual(["anchor-run-1", "anchor-run-1", "anchor-run-1"]);
    expect(h.proposals.applied_history.map((p) => p.status)).toEqual([
      "reverted",
      "reverted",
      "reverted",
      "reverted",
    ]);
  });
});
