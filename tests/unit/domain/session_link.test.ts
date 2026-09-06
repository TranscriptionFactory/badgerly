import {
  resolve_wiki_link_note_path,
  is_resolved_wiki_link_target,
} from "$lib/features/editor/domain/wiki_link_resolution";
import { extract_local_links } from "$lib/features/links/domain/extract_local_links";
import { describe, expect, it } from "vitest";
import {
  is_session_link,
  is_session_query,
  resolve_session_link,
  session_link_target,
  session_query_term,
} from "$lib/features/assistant/domain/session_link";
import {
  build_wiki_href,
  format_wiki_source,
} from "$lib/features/editor/domain/wiki_link";
import { extract_wiki_query } from "$lib/features/editor/adapters/wiki_suggest_plugin";

const session = {
  id: "session-1",
  title: "Review v1.2 #3: https://example.com?x=%23",
};

describe("session wiki targets", () => {
  it.each([session.id, session.title])(
    "resolves %s without note path normalization",
    (target) => {
      const href = build_wiki_href(`◈ ${target}`);
      expect(href).toBe(`◈ ${target}`);
      expect(resolve_session_link(href, [session])).toEqual(session);
      expect(format_wiki_source(href, `◈ ${target}`)).toBe(`[[◈ ${target}]]`);
    },
  );

  it("keeps an ID link stable after rename", () => {
    const renamed = { ...session, title: "Renamed" };
    expect(resolve_session_link(`◈ ${session.id}`, [renamed])).toEqual(renamed);
    expect(resolve_session_link(`◈ ${session.title}`, [renamed])).toBeNull();
  });

  it("rejects ambiguous titles but prioritizes exact IDs", () => {
    const duplicate = { id: "other", title: session.title };
    expect(
      resolve_session_link(`◈ ${session.title}`, [session, duplicate]),
    ).toBeNull();
    expect(
      resolve_session_link(`◈ ${session.id}`, [
        session,
        { ...duplicate, title: session.id },
      ]),
    ).toEqual(session);
  });

  it.each(["note", "◈", "◈ missing", "◈ bad|alias", "◈ bad]", "◈ bad\nvalue"])(
    "fails closed for %s",
    (target) => {
      expect(resolve_session_link(target, [session])).toBeNull();
    },
  );

  it("does not treat a session title hash as a heading query", () => {
    expect(extract_wiki_query("[[◈ Review #3")).toMatchObject({
      mode: "note",
      query: "◈ Review #3",
    });
    expect(session_link_target(" ◈ session-1 ")).toBe("session-1");
    expect(build_wiki_href("ordinary#Heading")).toBe("ordinary.md#Heading");
  });
});

it("excludes session links from local note backlinks", () => {
  expect(
    extract_local_links("[[◈ session-1]] [[◈ Title #3|label]] [[ordinary]]")
      .outlink_paths,
  ).toEqual(["ordinary"]);
});

it("does not resolve a reserved session target against similarly named notes", () => {
  expect(
    resolve_wiki_link_note_path("◈ session-1", [
      "session-1.md",
      "◈ session-1.md",
    ]),
  ).toBeNull();
  expect(
    is_resolved_wiki_link_target("◈ session-1", new Set(["◈ session-1"])),
  ).toBe(false);
});

describe("the ~ typing alias", () => {
  it.each([
    ["~", ""],
    ["~session-1", "session-1"],
    ["~ Review #3", "Review #3"],
    ["◈ Review #3", "Review #3"],
  ])("reads %s as the session query %s", (text, term) => {
    expect(is_session_query(text)).toBe(true);
    expect(session_query_term(text)).toBe(term);
  });

  it("keeps a title hash out of the heading query", () => {
    expect(extract_wiki_query("[[~Review #3")).toMatchObject({
      mode: "note",
      query: "~Review #3",
    });
  });

  it.each(["note", "d:today", " ordinary"])(
    "leaves %s to the note suggester",
    (text) => {
      expect(is_session_query(text)).toBe(false);
      expect(session_query_term(text)).toBe("");
    },
  );

  // The alias never reaches storage: only the suggester accepts it, and
  // accepting writes the canonical target, so a hand-typed `~` link stays an
  // ordinary note reference on both sides of the IPC boundary.
  it("is not a stored session link", () => {
    expect(is_session_link("~session-1")).toBe(false);
    expect(session_link_target("~session-1")).toBeNull();
    expect(resolve_session_link("~session-1", [session])).toBeNull();
    expect(extract_local_links("[[~session-1]]").outlink_paths).toEqual([
      "~session-1",
    ]);
  });
});
