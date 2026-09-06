import { describe, expect, it, vi } from "vitest";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { ProposalApplyService } from "$lib/features/assistant/application/proposal_apply_service";
import { AssistantProposalStore } from "$lib/features/assistant/state/assistant_proposal_store.svelte";
import { operation_hunks } from "$lib/features/assistant/domain/edit_operations";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import type {
  EditOperation,
  ProposalMutation,
} from "$lib/features/assistant/types/edit_operation";
import type { Proposal } from "$lib/features/assistant/types/proposal";
import {
  make_proposal,
  make_proposal_hunk,
  make_proposal_line,
} from "../helpers/assistant_proposal_fixtures";

const OVERLAP = "Proposal overlaps another pending mutation in this batch";

function legacy_proposal(
  id: string,
  path: string,
  before: string,
  after: string,
): Proposal {
  return make_proposal({
    id,
    target: { kind: "note", note_path: path },
    base_revision: compute_note_revision(before),
    hunks: [
      make_proposal_hunk({
        id: `${id}-hunk`,
        lines: [
          make_proposal_line({
            kind: "del",
            content: before,
            old_line: 1,
            new_line: null,
          }),
          make_proposal_line({
            kind: "add",
            content: after,
            old_line: null,
            new_line: 1,
          }),
        ],
      }),
    ],
  });
}

function typed_proposal(
  id: string,
  base: string,
  operations: EditOperation[],
): Proposal {
  return make_proposal({
    id,
    target: { kind: "note", note_path: "a.md" },
    base_content: base,
    base_revision: compute_note_revision(base),
    operations,
    hunks: operation_hunks(base, operations),
  });
}

function harness(files_seed: Record<string, string>) {
  const files = new Map(Object.entries(files_seed));
  const buffers = new Map<string, string>();
  const proposals = new AssistantProposalStore();
  const mutations = {
    current_vault: () => "A",
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
  const notes = {
    read_note: vi.fn((path: string) =>
      Promise.resolve(files.get(path) ?? null),
    ),
    write_note: vi.fn((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve();
    }),
  };
  const git = {
    create_checkpoint: vi.fn(() => Promise.resolve("created" as const)),
  };
  const documents = {
    read_document: (path: string) => {
      const content = buffers.get(path);
      return content === undefined ? null : { path, title: path, content };
    },
    stage_document: (path: string, content: string) => {
      buffers.set(path, content);
      return true;
    },
  };
  const service = new ProposalApplyService({
    proposals,
    ops: new OpStore(),
    notes,
    git,
    documents,
    mutations,
  });
  return { files, buffers, proposals, mutations, notes, git, service };
}

describe("same-path proposals in one apply batch", () => {
  it("applies two equivalent legacy writes naming the same note", async () => {
    const h = harness({ "a.md": "original" });
    h.proposals.add_many([
      legacy_proposal("first", "a.md", "original", "edited"),
      legacy_proposal("second", "a.md", "original", "edited"),
    ]);

    const outcome = await h.service.apply_batch(["first", "second"]);

    expect(outcome.applied).toEqual(["first", "second"]);
    expect(outcome.failed).toEqual([]);
    expect(outcome.written_note_paths).toEqual(["a.md", "a.md"]);
    expect(h.files.get("a.md")).toBe("edited");
    expect(h.git.create_checkpoint).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "refuses a legacy write colliding with a typed replacement on the same note (typed first: %s)",
    async (typed_first) => {
      const h = harness({ "a.md": "alpha" });
      h.proposals.add_many([
        typed_proposal("typed", "alpha", [
          {
            kind: "replace_span",
            base_revision: compute_note_revision("alpha"),
            hunk_id: "typed",
            start: 0,
            end: 5,
            text: "ALPHA",
          },
        ]),
        legacy_proposal("legacy", "a.md", "alpha", "edited"),
      ]);
      const ids = typed_first ? ["typed", "legacy"] : ["legacy", "typed"];

      const outcome = await h.service.apply_batch(ids);

      expect(outcome.applied).toEqual([ids[0]]);
      expect(outcome.failed.map((failure) => failure.id)).toEqual([ids[1]]);
      expect(h.files.get("a.md")).toBe(typed_first ? "ALPHA" : "edited");
    },
  );

  it.each([true, false])(
    "refuses a legacy write colliding with a typed rename's repaired backlink (rename first: %s)",
    async (rename_first) => {
      const h = harness({ "a.md": "body", "backlink.md": "[[a]]" });
      h.mutations.prepare_rename.mockResolvedValue([
        { path: "a.md", before: "body", after: null },
        { path: "new.md", before: null, after: "body" },
        { path: "backlink.md", before: "[[a]]", after: "[[new]]" },
      ]);
      h.proposals.add_many([
        typed_proposal("rename", "body", [
          {
            kind: "rename_with_repair",
            base_revision: compute_note_revision("body"),
            hunk_id: "rename",
            to_path: "new.md",
          },
        ]),
        legacy_proposal("legacy", "backlink.md", "[[a]]", "user edit"),
      ]);
      const ids = rename_first ? ["rename", "legacy"] : ["legacy", "rename"];

      const outcome = await h.service.apply_batch(ids);

      expect(outcome.applied).toEqual([ids[0]]);
      expect(outcome.failed.map((failure) => failure.id)).toEqual([ids[1]]);
      expect(h.files.get("backlink.md")).toBe(
        rename_first ? "[[new]]" : "user edit",
      );
    },
  );

  it("refuses a legacy write colliding with a typed document staging the same path", async () => {
    const h = harness({ "a.md": "alpha" });
    h.buffers.set("a.md", "alpha");
    const typed = typed_proposal("typed_document", "alpha", [
      {
        kind: "replace_span",
        base_revision: compute_note_revision("alpha"),
        hunk_id: "typed_document",
        start: 0,
        end: 5,
        text: "ALPHA",
      },
    ]);
    typed.target = { kind: "document", file_path: "a.md" };
    h.proposals.add_many([
      typed,
      legacy_proposal("legacy", "a.md", "alpha", "edited"),
    ]);

    const outcome = await h.service.apply_batch(["typed_document", "legacy"]);

    expect(outcome.applied).toEqual(["typed_document"]);
    expect(outcome.failed).toEqual([{ id: "legacy", error: OVERLAP }]);
    expect(h.buffers.get("a.md")).toBe("ALPHA");
    expect(h.files.get("a.md")).toBe("alpha");
    expect(h.notes.write_note).not.toHaveBeenCalled();
    expect(h.git.create_checkpoint).not.toHaveBeenCalled();
  });
});
