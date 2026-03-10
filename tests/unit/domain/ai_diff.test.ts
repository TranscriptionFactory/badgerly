import { describe, expect, it } from "vitest";
import { create_ai_draft_diff } from "$lib/features/ai/domain/ai_diff";

describe("create_ai_draft_diff", () => {
  it("tracks additions and deletions for full-note drafts", () => {
    const diff = create_ai_draft_diff({
      original_text: "Alpha\nBeta\nGamma",
      draft_text: "Alpha\nBeta revised\nGamma\nDelta",
      target: "full_note",
    });

    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(1);
    expect(diff.hunks[0]?.header).toBe("@@ AI full note draft @@");
    expect(diff.hunks[0]?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "deletion",
          content: "Beta",
          old_line: 2,
          new_line: null,
        }),
        expect.objectContaining({
          type: "addition",
          content: "Beta revised",
          old_line: null,
          new_line: 2,
        }),
        expect.objectContaining({
          type: "addition",
          content: "Delta",
          old_line: null,
          new_line: 4,
        }),
      ]),
    );
  });

  it("uses a selection-specific header for selection drafts", () => {
    const diff = create_ai_draft_diff({
      original_text: "Old sentence",
      draft_text: "New sentence",
      target: "selection",
    });

    expect(diff.hunks[0]?.header).toBe("@@ AI selection draft @@");
  });
});
