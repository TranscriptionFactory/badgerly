import { require_fixture } from "../helpers/require_fixture";
import { describe, expect, it, vi } from "vitest";
import { ProposalApplyService } from "$lib/features/assistant/application/proposal_apply_service";
import { AssistantProposalStore } from "$lib/features/assistant/state/assistant_proposal_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { operation_hunks } from "$lib/features/assistant/domain/edit_operations";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import type {
  EditOperation,
  ProposalMutation,
} from "$lib/features/assistant/types/edit_operation";
import { make_proposal } from "../helpers/assistant_proposal_fixtures";
function replacement(
  id: string,
  base: string,
  start: number,
  end: number,
  text: string,
) {
  const operations: EditOperation[] = [
    {
      kind: "replace_span",
      base_revision: compute_note_revision(base),
      hunk_id: id,
      start,
      end,
      text,
    },
  ];
  return make_proposal({
    id,
    target: { kind: "note", note_path: "a.md" },
    base_content: base,
    base_revision: compute_note_revision(base),
    operations,
    hunks: operation_hunks(base, operations),
  });
}
function harness(content = "alpha\nbeta") {
  const files = new Map<string, string>([["a.md", content]]);
  const proposals = new AssistantProposalStore();
  let vault = "A";
  const mutations = {
    current_vault: () => vault,
    prepare_rename:
      vi.fn<(from: string, to: string) => Promise<ProposalMutation[]>>(),
    anchor_mutations: vi.fn(),
    apply_mutations: vi.fn((items: ProposalMutation[]) => {
      for (const item of items) {
        if ((files.get(item.path) ?? null) !== item.before)
          throw new Error("conflict");
      }
      for (const item of items) {
        if (item.after === null) files.delete(item.path);
        else files.set(item.path, item.after);
      }
      return Promise.resolve();
    }),
  };
  const git = {
    create_checkpoint: vi.fn(() => Promise.resolve("created" as const)),
  };
  const notes = {
    read_note: vi.fn((path: string) =>
      Promise.resolve(files.get(path) ?? null),
    ),
    write_note: vi.fn((path: string, text: string) => {
      files.set(path, text);
      return Promise.resolve();
    }),
  };
  const service = new ProposalApplyService({
    proposals,
    ops: new OpStore(),
    mutations,
    notes,
    git,
    documents: { read_document: () => null, stage_document: () => false },
  });
  return {
    files,
    proposals,
    mutations,
    git,
    notes,
    service,
    switch_vault: () => {
      vault = "B";
    },
  };
}
describe("structured proposal acceptance", () => {
  it("rejects malformed operations and misleading review text before checkpoint", async () => {
    const h = harness();
    const p = replacement("p", "alpha\nbeta", 0, 5, "ALPHA");
    require_fixture(p.operations)[0] = {
      ...require_fixture(require_fixture(p.operations)[0]),
      text: "hidden write",
    } as EditOperation;
    h.proposals.add(p);
    expect((await h.service.apply_batch([p.id])).failed).toHaveLength(1);
    expect(h.git.create_checkpoint).not.toHaveBeenCalled();
    expect(h.mutations.apply_mutations).not.toHaveBeenCalled();
  });
  it("rejects invalid note paths before reading or checkpointing", async () => {
    const h = harness();
    const p = replacement("invalid", "alpha\nbeta", 0, 5, "ALPHA");
    p.target = { kind: "note", note_path: "../escape.md" };
    h.proposals.add(p);
    expect((await h.service.apply_batch([p.id])).failed).toHaveLength(1);
    expect(h.notes.read_note).not.toHaveBeenCalled();
    expect(h.git.create_checkpoint).not.toHaveBeenCalled();
  });
  it("refuses a later legacy write after a vault switch during typed apply", async () => {
    const h = harness();
    h.files.set("b.md", "beta");
    const legacy = replacement("legacy", "beta", 0, 4, "BETA");
    legacy.target = { kind: "note", note_path: "b.md" };
    delete legacy.operations;
    h.proposals.add_many([
      replacement("typed", "alpha\nbeta", 0, 5, "ALPHA"),
      legacy,
    ]);
    h.mutations.apply_mutations.mockImplementation(() => {
      h.switch_vault();
      return Promise.resolve();
    });
    const outcome = await h.service.apply_batch(["typed", "legacy"]);
    expect(outcome.failed.map((failure) => failure.id)).toContain("legacy");
    expect(h.notes.write_note).not.toHaveBeenCalled();
  });
  it("composes non-overlapping proposals and records an overlapping conflicting span", async () => {
    const h = harness();
    h.proposals.add_many([
      replacement("first", "alpha\nbeta", 0, 5, "ALPHA"),
      replacement("second", "alpha\nbeta", 6, 10, "BETA"),
      replacement("conflict", "alpha\nbeta", 0, 5, "different"),
    ]);
    expect((await h.service.apply_batch(["first", "second"])).applied).toEqual([
      "first",
      "second",
    ]);
    expect(h.files.get("a.md")).toBe("ALPHA\nBETA");
    expect((await h.service.apply_batch(["conflict"])).stale).toEqual([
      "conflict",
    ]);
    expect(h.proposals.get("conflict")?.conflict).toMatchObject({
      start: 0,
      end: 5,
    });
    expect(h.git.create_checkpoint).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    "refuses mixed legacy/typed overlapping batch writes without overwriting (%s)",
    async (typed_first) => {
      const h = harness();
      const typed = replacement("typed", "alpha\nbeta", 0, 5, "ALPHA");
      const legacy = replacement("legacy", "alpha\nbeta", 6, 10, "BETA");
      delete legacy.operations;
      delete legacy.base_content;
      h.proposals.add_many([typed, legacy]);
      const ids = typed_first ? ["typed", "legacy"] : ["legacy", "typed"];
      const outcome = await h.service.apply_batch(ids);
      expect(outcome.applied).toEqual([ids[0]]);
      expect(outcome.failed.map((failure) => failure.id)).toEqual([ids[1]]);
      expect(h.files.get("a.md")).toBe(
        typed_first ? "ALPHA\nbeta" : "alpha\nBETA",
      );
    },
  );
  it("records all actual rename mutations and refuses a stale backlink before checkpoint", async () => {
    const h = harness("body");
    h.files.set("backlink.md", "[[a]]");
    const operations: EditOperation[] = [
      {
        kind: "rename_with_repair",
        base_revision: compute_note_revision("body"),
        hunk_id: "rename",
        to_path: "new.md",
      },
    ];
    const p = make_proposal({
      id: "rename",
      target: { kind: "note", note_path: "a.md" },
      base_content: "body",
      base_revision: compute_note_revision("body"),
      operations,
      hunks: operation_hunks("body", operations),
    });
    const items = [
      { path: "a.md", before: "body", after: null },
      { path: "new.md", before: null, after: "body" },
      { path: "backlink.md", before: "[[a]]", after: "[[new]]" },
    ];
    h.mutations.prepare_rename.mockResolvedValue(items);
    h.proposals.add(p);
    expect((await h.service.apply_batch([p.id])).written_note_paths).toEqual([
      "a.md",
      "new.md",
      "backlink.md",
    ]);
    expect(h.proposals.get(p.id)?.mutations).toEqual(items);
    const stale = harness("body");
    stale.files.set("backlink.md", "user edit");
    stale.mutations.prepare_rename.mockResolvedValue(items);
    stale.proposals.add({ ...p, status: "pending" });
    expect((await stale.service.apply_batch([p.id])).failed).toHaveLength(1);
    expect(stale.git.create_checkpoint).not.toHaveBeenCalled();
  });
  it("fails closed when checkpoint fails or the active vault changes", async () => {
    const h = harness();
    h.proposals.add(replacement("p", "alpha\nbeta", 0, 5, "ALPHA"));
    h.git.create_checkpoint.mockImplementation(() => {
      h.switch_vault();
      return Promise.resolve("created");
    });
    expect((await h.service.apply_batch(["p"])).failed).toHaveLength(1);
    expect(h.mutations.apply_mutations).not.toHaveBeenCalled();
  });
});
