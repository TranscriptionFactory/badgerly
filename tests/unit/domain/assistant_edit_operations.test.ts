import { require_fixture } from "../helpers/require_fixture";
import { describe, expect, it } from "vitest";
import {
  apply_edit_operations,
  validate_edit_operations,
  operation_hunks,
} from "$lib/features/assistant/domain/edit_operations";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import type { EditOperation } from "$lib/features/assistant/types/edit_operation";
import { make_proposal } from "../helpers/assistant_proposal_fixtures";
function proposal(
  base: string,
  operation: Omit<EditOperation, "base_revision" | "hunk_id">,
) {
  const operations = [
    {
      ...operation,
      base_revision: compute_note_revision(base),
      hunk_id: "h",
    } as EditOperation,
  ];
  return make_proposal({
    base_content: base,
    base_revision: compute_note_revision(base),
    hunks: operation_hunks(base, operations),
    operations,
  });
}
describe("machine-validated edit operations", () => {
  it("applies a replacement to its original span and rebases unrelated edits", () => {
    const p = proposal("alpha\nbeta\ngamma", {
      kind: "replace_span",
      start: 6,
      end: 10,
      text: "BETA",
    } as EditOperation);
    expect(apply_edit_operations(p, "prefix\nalpha\nbeta\ngamma")).toEqual({
      content: "prefix\nalpha\nBETA\ngamma",
      conflict: null,
    });
    expect(apply_edit_operations(p, "ALPHA\nbeta\nGAMMA").content).toBe(
      "ALPHA\nBETA\nGAMMA",
    );
  });
  it("reports the exact conflicting span instead of overwriting an overlapping edit", () => {
    const p = proposal("alpha\nbeta\ngamma", {
      kind: "replace_span",
      start: 6,
      end: 10,
      text: "BETA",
    } as EditOperation);
    expect(
      apply_edit_operations(p, "alpha\nother\ngamma").conflict,
    ).toMatchObject({ start: 6, end: 10, hunk_id: "h" });
  });
  it("does not mistake a relocated copy for the original conflicting span", () => {
    const p = proposal("left\nTARGET\nright", {
      kind: "replace_span",
      start: 5,
      end: 11,
      text: "NEW",
    } as EditOperation);
    expect(
      apply_edit_operations(p, "TARGET\nleft\nCHANGED\nright").conflict,
    ).toMatchObject({ start: 5, end: 11 });
  });
  it("refuses a multi-line block whose only contiguous match is a relocated copy", () => {
    const p = proposal("left\nA\nB\nright", {
      kind: "replace_span",
      start: 5,
      end: 8,
      text: "NEW",
    } as EditOperation);
    expect(
      apply_edit_operations(p, "A\nB\nleft\nA\nX\nB\nright").conflict,
    ).toMatchObject({ start: 5, end: 8, hunk_id: "h" });
  });
  it("inserts beneath a unique heading and refuses ambiguous headings", () => {
    const p = proposal("# Intro\nold", {
      kind: "insert_at_heading",
      heading: "Intro",
      text: "new",
    } as EditOperation);
    expect(
      apply_edit_operations(p, require_fixture(p.base_content)).content,
    ).toBe("# Intro\nnew\nold");
    expect(() => {
      validate_edit_operations(
        proposal("# Intro\n# Intro", {
          kind: "insert_at_heading",
          heading: "Intro",
          text: "new",
        } as EditOperation),
      );
    }).toThrow("uniquely");
  });
  it("ignores heading-like content inside code fences and frontmatter", () => {
    const base =
      "---\ntext: |\n  # Intro\n---\n```md\n# Intro\n```\n# Intro\nbody";
    const p = proposal(base, {
      kind: "insert_at_heading",
      heading: "Intro",
      text: "insert",
    } as EditOperation);
    expect(apply_edit_operations(p, base).content).toBe(
      base.replace("# Intro\nbody", "# Intro\ninsert\nbody"),
    );
    expect(() =>
      proposal("```\n# Intro\n```", {
        kind: "insert_at_heading",
        heading: "Intro",
        text: "insert",
      } as EditOperation),
    ).toThrow("uniquely");
  });
  it("sets frontmatter while retaining other properties and body", () => {
    const p = proposal("---\ntitle: Hello\n---\nbody", {
      kind: "set_frontmatter",
      key: "memory",
      value: true,
    } as EditOperation);
    expect(
      apply_edit_operations(p, require_fixture(p.base_content)).content,
    ).toBe("---\ntitle: Hello\nmemory: true\n---\nbody");
  });
  it("updates empty frontmatter without duplicating its delimiters", () => {
    const p = proposal("---\n---\nbody", {
      kind: "set_frontmatter",
      key: "tag",
      value: "keep",
    } as EditOperation);
    expect(
      apply_edit_operations(p, require_fixture(p.base_content)).content,
    ).toBe("---\ntag: keep\n---\nbody");
    expect(() =>
      proposal("---\nunclosed", {
        kind: "set_frontmatter",
        key: "tag",
        value: true,
      } as EditOperation),
    ).toThrow("Unclosed");
  });
  it("rejects malformed ranges, mismatched revisions and unsafe rename paths", () => {
    expect(() => {
      validate_edit_operations(
        proposal("abc", {
          kind: "replace_span",
          start: -1,
          end: 2,
          text: "x",
        } as EditOperation),
      );
    }).toThrow();
    const p = proposal("abc", {
      kind: "rename_with_repair",
      to_path: "new.md",
    } as EditOperation);
    expect(() => {
      validate_edit_operations(p);
    }).not.toThrow();
    require_fixture(require_fixture(p.operations)[0]).base_revision = "wrong";
    expect(() => {
      validate_edit_operations(p);
    }).toThrow();
    expect(() => {
      validate_edit_operations(
        proposal("abc", {
          kind: "rename_with_repair",
          to_path: "../escape.md",
        } as EditOperation),
      );
    }).toThrow();
  });
  it("rejects UTF-16 offsets that bisect a Unicode scalar", () => {
    expect(() => {
      validate_edit_operations(
        proposal("😀x", {
          kind: "replace_span",
          start: 1,
          end: 2,
          text: "broken",
        } as EditOperation),
      );
    }).toThrow("Invalid replacement span");
  });
  it("honors hunk selection and rejects overlapping operations", () => {
    const p = proposal("abc", {
      kind: "replace_span",
      start: 0,
      end: 1,
      text: "X",
    } as EditOperation);
    require_fixture(p.hunks[0]).selected = false;
    expect(apply_edit_operations(p, "abc").content).toBe("abc");
    require_fixture(p.operations).push({
      ...require_fixture(require_fixture(p.operations)[0]),
    });
    expect(() => {
      validate_edit_operations(p);
    }).toThrow("Overlapping");
  });
});
