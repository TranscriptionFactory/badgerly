import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import { format_wiki_target_display } from "$lib/features/editor";
import type { AmbientNotice } from "$lib/features/assistant/types/ambient";

// R5's deterministic producers. The link producers read ONE `NoteLinksSnapshot`
// — the single per-note indexed query `index_note_links_snapshot`, which
// returns backlinks, outlinks and orphan_links together. `orphan_note`
// deliberately does NOT go near the vault graph: `GraphPort` exposes no way to
// read a warm cache without risking a full-vault rebuild, and it does not need
// one. `missing_link` reads the block-similarity hits the reactor fetched
// (and cached per note mtime) alongside the snapshot.
//
// Structurally typed rather than importing `NoteLinksSnapshot` so the producers
// stay pure domain with no dependency on the search feature. Only lengths are
// needed from backlinks/outlinks, so their element type is irrelevant here.
export type AmbientMissingLinkHit = {
  source_heading_id: string;
  // Rendered heading text of the source block; empty for the preamble, which
  // has no heading in the document and so degrades to a note-level anchor.
  source_heading: string;
  target_path: string;
  score: number;
};

export type AmbientLinkFacts = {
  note_path: string;
  backlinks: readonly unknown[];
  outlinks: readonly unknown[];
  orphan_links: readonly { target_path: string; ref_count: number }[];
  missing_links: readonly AmbientMissingLinkHit[];
  // Targets whose `(note_path, target)` pair the user declined; lifted by the
  // reactor once the note's mtime changes.
  suppressed_targets: readonly string[];
  missing_link_max_notices: number;
};

const LINK_PROVENANCE = "ambient · link check";
const SIMILARITY_PROVENANCE = "ambient · similar block";

// Stable per (kind, note, target) so a rescan of unchanged content produces
// identical ids. `replace_for_note` swaps the whole set, so a drifting id would
// re-key every card on every scan and make the rail flicker.
function notice_id(
  kind: string,
  note_path: string,
  discriminator = "",
): string {
  return discriminator
    ? `${kind}:${note_path}:${discriminator}`
    : `${kind}:${note_path}`;
}

// An outlink whose target has no row in `notes`. The anchor's `match` is the
// text AS RENDERED: the wiki-link plugin replaces the literal `[[target]]` with
// a link-marked node whose text is `format_wiki_target_display(target)`, so an
// anchor carrying the bracketed form resolves to nothing in the visual editor.
//
// One notice per target, not per occurrence: `ref_count` may exceed 1 and the
// rail would otherwise stack duplicate cards for the same broken link.
export function produce_stale_link_notices(
  facts: AmbientLinkFacts,
  now: number,
): AmbientNotice[] {
  const seen = new Set<string>();
  const notices: AmbientNotice[] = [];

  for (const link of facts.orphan_links) {
    if (seen.has(link.target_path)) continue;
    seen.add(link.target_path);

    const display = format_wiki_target_display(link.target_path);
    notices.push({
      id: notice_id("stale_link", facts.note_path, link.target_path),
      kind: "stale_link",
      note_path: facts.note_path,
      target_path: link.target_path,
      anchor: { kind: "text", match: display, occurrence: 0 },
      provenance: LINK_PROVENANCE,
      body: `This note links to ${display}, which no longer exists. Remove the link?`,
      offer: {
        action_id: ACTION_IDS.assistant_accept_notice,
        label: "Remove link",
      },
      created_at: now,
    });
  }

  return notices;
}

// A note with zero INBOUND links — the opposite direction from the tree's
// `orphan_links` / `orphan_count` / graph `kind: "orphan"`, which all mean a
// broken OUTLINK.
//
// Guarded on having at least one outlink. A brand-new or not-yet-indexed note
// has neither backlinks nor outlinks, so the same guard suppresses that entire
// false-positive class with no extra query.
//
// There is NO offer. This finding has no deterministic single-note repair —
// fabricating a link into some other note to clear it would invent an edit the
// evidence does not support. Pointing the offer at the dismiss action instead
// was the first draft and was wrong twice over: the contract reserves that field
// for propose, dismiss being implicit on every notice, and the card renders a
// ghost "Dismiss" unconditionally, so the two buttons did the same thing. A null
// offer is strictly weaker than an offer and cannot violate I6.
export function produce_orphan_note_notices(
  facts: AmbientLinkFacts,
  now: number,
): AmbientNotice[] {
  if (facts.backlinks.length > 0) return [];
  if (facts.outlinks.length === 0) return [];

  return [
    {
      id: notice_id("orphan_note", facts.note_path),
      kind: "orphan_note",
      note_path: facts.note_path,
      target_path: null,
      anchor: { kind: "note" },
      provenance: LINK_PROVENANCE,
      body: "Nothing links to this note yet.",
      offer: null,
      created_at: now,
    },
  ];
}

// A block of this note close to a block in a note it neither links to nor is
// linked from. Rust already excluded self and linked targets and kept the best
// block pair per target note; what remains here is the user's declines and the
// per-note cap. Hits arrive best-first, so the cap keeps the closest matches.
export function produce_missing_link_notices(
  facts: AmbientLinkFacts,
  now: number,
): AmbientNotice[] {
  const suppressed = new Set(facts.suppressed_targets);
  const seen = new Set<string>();
  const notices: AmbientNotice[] = [];

  for (const hit of facts.missing_links) {
    if (notices.length >= facts.missing_link_max_notices) break;
    if (suppressed.has(hit.target_path) || seen.has(hit.target_path)) continue;
    seen.add(hit.target_path);

    const display = format_wiki_target_display(hit.target_path);
    notices.push({
      id: notice_id("missing_link", facts.note_path, hit.target_path),
      kind: "missing_link",
      note_path: facts.note_path,
      target_path: hit.target_path,
      anchor: hit.source_heading
        ? { kind: "text", match: hit.source_heading, occurrence: 0 }
        : { kind: "note" },
      provenance: SIMILARITY_PROVENANCE,
      body: `A block here is close to ${display}, which this note does not link to. Add a link?`,
      offer: {
        action_id: ACTION_IDS.assistant_accept_notice,
        label: "Add link",
      },
      created_at: now,
    });
  }

  return notices;
}

export function produce_ambient_notices(
  facts: AmbientLinkFacts,
  now: number,
): AmbientNotice[] {
  return [
    ...produce_stale_link_notices(facts, now),
    ...produce_orphan_note_notices(facts, now),
    ...produce_missing_link_notices(facts, now),
  ];
}
