import { describe, expect, it } from "vitest";
import { build_notice_draft_text } from "$lib/features/assistant/domain/ambient_notice_edit";
import { make_ambient_notice } from "../../../helpers/assistant_notice_fixtures";

const NOTE = "notes/a.md";

function missing_link_notice(target_path: string | null = "notes/b.md") {
  return make_ambient_notice({
    kind: "missing_link",
    note_path: NOTE,
    target_path,
    anchor: { kind: "text", match: "Results", occurrence: 0 },
    offer: { action_id: "assistant.accept_notice", label: "Add link" },
  });
}

describe("build_notice_draft_text — missing_link", () => {
  it("appends [[target]] on its own line at the end of the note", () => {
    const draft = build_notice_draft_text(
      missing_link_notice(),
      "# A\n\nSome prose.\n",
    );

    expect(draft).toBe("# A\n\nSome prose.\n\n[[notes/b]]\n");
  });

  it("separates the link from prose with one blank line however the note ended", () => {
    expect(build_notice_draft_text(missing_link_notice(), "Prose")).toBe(
      "Prose\n\n[[notes/b]]\n",
    );
    expect(build_notice_draft_text(missing_link_notice(), "Prose\n\n\n")).toBe(
      "Prose\n\n[[notes/b]]\n",
    );
  });

  it("writes only the link into an empty note", () => {
    expect(build_notice_draft_text(missing_link_notice(), "")).toBe(
      "[[notes/b]]\n",
    );
  });

  it("returns null when the note already links the target", () => {
    expect(
      build_notice_draft_text(missing_link_notice(), "See [[notes/b]].\n"),
    ).toBeNull();
    expect(
      build_notice_draft_text(
        missing_link_notice(),
        "See [[notes/b#Results|the results]].\n",
      ),
    ).toBeNull();
  });

  it("returns null for a missing_link notice without a target", () => {
    expect(
      build_notice_draft_text(missing_link_notice(null), "Prose\n"),
    ).toBeNull();
  });
});
