import { describe, expect, it } from "vitest";
import {
  NO_ANCHOR_REASON,
  describe_turn_revert,
  group_proposal_turns,
  plan_session_revert,
  plan_turn_revert,
  turn_revert_block_reason,
} from "$lib/features/assistant";
import {
  make_proposal,
  make_turn_proposal,
} from "../helpers/assistant_proposal_fixtures";

const three_turns = [
  make_turn_proposal({ run_id: "run-1", created_at: 100, note_path: "a.md" }),
  make_turn_proposal({ run_id: "run-2", created_at: 200, note_path: "a.md" }),
  make_turn_proposal({ run_id: "run-2", created_at: 200, note_path: "b.md" }),
  make_turn_proposal({ run_id: "run-3", created_at: 300, note_path: "c.md" }),
];

describe("group_proposal_turns", () => {
  it("groups a session's proposals into turns keyed by run_id, ordered by created_at", () => {
    const turns = group_proposal_turns([...three_turns].reverse());

    expect(turns.map((turn) => turn.turn_id)).toEqual([
      "run-1",
      "run-2",
      "run-3",
    ]);
    expect(turns[1]?.proposals).toHaveLength(2);
  });

  it("numbers turns by ordinal within their session", () => {
    const turns = group_proposal_turns([
      ...three_turns,
      make_turn_proposal({
        run_id: "run-other",
        created_at: 150,
        note_path: "z.md",
        session_id: "session-2",
      }),
    ]);

    expect(
      turns.map((turn) => [turn.session_id, turn.ordinal] as const),
    ).toEqual([
      ["session-1", 1],
      ["session-2", 1],
      ["session-1", 2],
      ["session-1", 3],
    ]);
  });

  it("excludes run_id-null proposals and document targets from turns", () => {
    const turns = group_proposal_turns([
      make_proposal({ status: "applied" }),
      make_proposal({
        status: "applied",
        origin: { session_id: "s", run_id: "run-doc", anchor: "sha" },
        target: { kind: "document", file_path: "artifact.html" },
      }),
    ]);

    expect(turns).toEqual([]);
  });

  it("lists only turns that have written disk", () => {
    const turns = group_proposal_turns([
      make_turn_proposal({
        run_id: "run-pending",
        created_at: 1,
        note_path: "a.md",
        status: "pending",
      }),
      make_turn_proposal({
        run_id: "run-rejected",
        created_at: 2,
        note_path: "a.md",
        status: "rejected",
      }),
      make_turn_proposal({ run_id: "run-3", created_at: 3, note_path: "a.md" }),
    ]);

    expect(turns.map((turn) => turn.turn_id)).toEqual(["run-3"]);
  });

  it("reports a turn as applied when any proposal in it is applied", () => {
    const [turn] = group_proposal_turns([
      make_turn_proposal({
        run_id: "run-1",
        created_at: 1,
        note_path: "a.md",
        status: "reverted",
      }),
      make_turn_proposal({ run_id: "run-1", created_at: 1, note_path: "b.md" }),
    ]);

    expect(turn?.status).toBe("applied");
  });

  it("reports a turn as reverted when every proposal in it is reverted", () => {
    const [turn] = group_proposal_turns([
      make_turn_proposal({
        run_id: "run-1",
        created_at: 1,
        note_path: "a.md",
        status: "reverted",
      }),
    ]);

    expect(turn?.status).toBe("reverted");
  });

  it("reads the anchor from the turn's proposals, null when unrecorded", () => {
    const turns = group_proposal_turns([
      make_turn_proposal({ run_id: "run-1", created_at: 1, note_path: "a.md" }),
      make_turn_proposal({
        run_id: "run-2",
        created_at: 2,
        note_path: "a.md",
        anchor: null,
      }),
    ]);

    expect(turns.map((turn) => turn.anchor)).toEqual(["anchor-run-1", null]);
  });
});

describe("turn_revert_block_reason", () => {
  it("blocks a reverted turn and a turn without an anchor, allows the rest", () => {
    const [applied, no_anchor, reverted] = group_proposal_turns([
      make_turn_proposal({ run_id: "run-1", created_at: 1, note_path: "a.md" }),
      make_turn_proposal({
        run_id: "run-2",
        created_at: 2,
        note_path: "a.md",
        anchor: null,
      }),
      make_turn_proposal({
        run_id: "run-3",
        created_at: 3,
        note_path: "a.md",
        status: "reverted",
      }),
    ]);

    expect(turn_revert_block_reason(applied!)).toBeNull();
    expect(turn_revert_block_reason(no_anchor!)).toBe(NO_ANCHOR_REASON);
    expect(turn_revert_block_reason(reverted!)).toContain("already reverted");
  });
});

describe("plan_turn_revert", () => {
  it("collects applied proposals from turns at or after the target, with the target's anchor", () => {
    const plan = plan_turn_revert(three_turns, "run-2");

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.anchor).toBe("anchor-run-2");
    expect(plan.target.ordinal).toBe(2);
    expect(plan.proposals.map((p) => p.origin.run_id)).toEqual([
      "run-2",
      "run-2",
      "run-3",
    ]);
    expect(plan.note_paths).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("names later applied turns that the revert will also undo", () => {
    const plan = plan_turn_revert(three_turns, "run-2");

    if (plan.status !== "ready") throw new Error(plan.status);
    expect(plan.later_turns.map((turn) => turn.ordinal)).toEqual([3]);
  });

  it("has no later turns when the target is the newest applied turn", () => {
    const plan = plan_turn_revert(three_turns, "run-3");

    if (plan.status !== "ready") throw new Error(plan.status);
    expect(plan.later_turns).toEqual([]);
  });

  it("skips a later turn that is already reverted", () => {
    const plan = plan_turn_revert(
      [
        ...three_turns.slice(0, 3),
        make_turn_proposal({
          run_id: "run-3",
          created_at: 300,
          note_path: "c.md",
          status: "reverted",
        }),
      ],
      "run-2",
    );

    if (plan.status !== "ready") throw new Error(plan.status);
    expect(plan.later_turns).toEqual([]);
    expect(plan.note_paths).toEqual(["a.md", "b.md"]);
  });

  it("stays within the target's session", () => {
    const plan = plan_turn_revert(
      [
        ...three_turns,
        make_turn_proposal({
          run_id: "run-elsewhere",
          created_at: 400,
          note_path: "z.md",
          session_id: "session-2",
        }),
      ],
      "run-2",
    );

    if (plan.status !== "ready") throw new Error(plan.status);
    expect(plan.note_paths).not.toContain("z.md");
  });

  it("refuses a turn whose anchor is null with a reason", () => {
    const plan = plan_turn_revert(
      [
        make_turn_proposal({
          run_id: "run-1",
          created_at: 1,
          note_path: "a.md",
          anchor: null,
        }),
      ],
      "run-1",
    );

    expect(plan).toEqual({ status: "refused", reason: NO_ANCHOR_REASON });
  });

  it("refuses an unknown turn and an already reverted turn", () => {
    const reverted = make_turn_proposal({
      run_id: "run-1",
      created_at: 1,
      note_path: "a.md",
      status: "reverted",
    });

    expect(plan_turn_revert([reverted], "run-missing").status).toBe("refused");
    expect(plan_turn_revert([reverted], "run-1").status).toBe("refused");
  });
});

describe("plan_session_revert", () => {
  it("targets the earliest turn with an applied proposal", () => {
    const plan = plan_session_revert(
      [
        make_turn_proposal({
          run_id: "run-1",
          created_at: 100,
          note_path: "a.md",
          status: "reverted",
        }),
        ...three_turns.slice(1),
      ],
      "session-1",
    );

    if (plan.status !== "ready") throw new Error(plan.status);
    expect(plan.target.turn_id).toBe("run-2");
    expect(plan.later_turns.map((turn) => turn.turn_id)).toEqual(["run-3"]);
  });

  it("reports nothing when no turn in the session is applied", () => {
    expect(plan_session_revert(three_turns, "session-2")).toEqual({
      status: "nothing",
    });
    expect(plan_session_revert([], "session-1")).toEqual({ status: "nothing" });
  });
});

describe("describe_turn_revert", () => {
  it("names the later turns, the notes, and that later edits are discarded", () => {
    const plan = plan_turn_revert(three_turns, "run-2");
    if (plan.status !== "ready") throw new Error(plan.status);

    const text = describe_turn_revert(plan);

    expect(text).toBe(
      "Reverting turn 2 also undoes turn 3. a.md, b.md and c.md go back to the checkpoint before turn 2; any edits you made after applying are discarded.",
    );
  });

  it("omits the later-turn clause for a single note on the newest turn", () => {
    const plan = plan_turn_revert(three_turns, "run-3");
    if (plan.status !== "ready") throw new Error(plan.status);

    expect(describe_turn_revert(plan)).toBe(
      "c.md goes back to the checkpoint before turn 3; any edits you made after applying are discarded.",
    );
  });
});
