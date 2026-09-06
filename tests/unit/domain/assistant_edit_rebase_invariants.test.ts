import { describe, expect, it } from "vitest";
import {
  apply_edit_operations,
  operation_hunks,
} from "$lib/features/assistant/domain/edit_operations";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import type { EditOperation } from "$lib/features/assistant/types/edit_operation";
import { make_proposal } from "../helpers/assistant_proposal_fixtures";
import { seeded_rng } from "../helpers/seeded_rng";

const MARKER = "ZQMARKQZ";

function replace_span_proposal(base: string, start: number, end: number) {
  const operations = [
    {
      kind: "replace_span",
      start,
      end,
      text: MARKER,
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

type Line = { text: string; origin: boolean };

const base_line = (index: number) => "L" + String(index);
const edited_line = (index: number) => "M" + String(index);

function scenario(seed: number) {
  const random = seeded_rng(seed);
  const size = 4 + Math.floor(random() * 4);
  const base_lines = Array.from({ length: size }, (_, k) => base_line(k));
  const first = Math.floor(random() * (size - 1));
  const last = first + 1 + Math.floor(random() * Math.min(3, size - first - 1));
  const block = base_lines.slice(first, last);
  const relocate = random() < 0.3;
  const split = last - first > 1 && random() < 0.4;

  let noise = 0;
  const before: Line[] = [];
  const after: Line[] = [];
  const scatter = (into: Line[]) => {
    while (random() < 0.4)
      into.push({ text: "N" + String(noise++), origin: false });
  };
  let survivors_before = 0;
  let survivors_after = 0;
  for (let k = 0; k < first; k++) {
    scatter(before);
    const roll = random();
    if (roll < 0.6) {
      before.push({ text: base_line(k), origin: false });
      survivors_before++;
    } else if (roll < 0.8) before.push({ text: edited_line(k), origin: false });
  }
  scatter(before);
  for (let k = last; k < size; k++) {
    scatter(after);
    const roll = random();
    if (roll < 0.6) {
      after.push({ text: base_line(k), origin: false });
      survivors_after++;
    } else if (roll < 0.8) after.push({ text: edited_line(k), origin: false });
  }
  scatter(after);

  const origin: Line[] = [];
  for (let k = first; k < last; k++) {
    origin.push({ text: base_line(k), origin: true });
    if (split && k === first)
      origin.push({ text: "N" + String(noise++), origin: false });
  }
  const copy: Line[] = block.map((text) => ({ text, origin: false }));
  const copy_at_front = relocate && random() < 0.5;
  const current = relocate
    ? copy_at_front
      ? [...copy, ...before, ...origin, ...after]
      : [...before, ...origin, ...after, ...copy]
    : [...before, ...origin, ...after];

  return {
    base: base_lines.join("\n"),
    base_lines,
    block,
    current,
    start: base_lines.slice(0, first).reduce((o, l) => o + l.length + 1, 0),
    end: base_lines.slice(0, last).reduce((o, l) => o + l.length + 1, 0) - 1,
    split,
    relocate,
    // A relocated copy is provably not the original when a surviving base line
    // that bracketed the block now sits on the copy's far side.
    provably_relocated:
      relocate && (copy_at_front ? survivors_before > 0 : survivors_after > 0),
  };
}

describe("edit operation rebase invariants", () => {
  it("rebases onto the original span or refuses, never onto a relocated copy", () => {
    const violations: unknown[] = [];
    const seen = {
      applied: 0,
      refused: 0,
      relocated: 0,
      split: 0,
      must_refuse: 0,
    };

    for (let seed = 1; seed <= 40000; seed++) {
      const probe = scenario(seed);
      if (probe.current.length === 0) continue;

      const current_text = probe.current.map((line) => line.text).join("\n");
      const origin_index = probe.current.findIndex((line) => line.origin);
      // Distinct line tokens make identity unambiguous: the original block
      // survives only while its own lines stay contiguous.
      const intact =
        !probe.split &&
        probe.current
          .slice(origin_index, origin_index + probe.block.length)
          .every((line) => line.origin);
      const original_offset = intact
        ? probe.current
            .slice(0, origin_index)
            .reduce((o, line) => o + line.text.length + 1, 0)
        : -1;

      const result = apply_edit_operations(
        replace_span_proposal(probe.base, probe.start, probe.end),
        current_text,
      );
      const written = result.conflict ? -1 : result.content.indexOf(MARKER);

      if (written === -1) seen.refused++;
      else seen.applied++;
      if (probe.relocate) seen.relocated++;
      if (probe.split) seen.split++;

      // A split original is a conflicting concurrent edit, so a provably
      // relocated copy is not a legal landing site. Without any copy the
      // outcome is fully determined. A copy beside an intact original is
      // inherently ambiguous, so either outcome is defensible.
      const must_refuse = probe.split && probe.provably_relocated;
      if (must_refuse) seen.must_refuse++;
      const expected = must_refuse
        ? -1
        : probe.relocate
          ? undefined
          : original_offset;

      const corrupted =
        written !== -1 &&
        current_text.slice(written, written + (probe.end - probe.start)) !==
          probe.base.slice(probe.start, probe.end);
      if (
        (corrupted || (expected !== undefined && written !== expected)) &&
        violations.length < 4
      )
        violations.push({
          seed,
          block: probe.block,
          current: probe.current.map((l) => (l.origin ? "*" : "") + l.text),
          written,
          expected,
          corrupted,
        });
    }

    expect(violations).toEqual([]);
    expect(seen.applied).toBeGreaterThan(500);
    expect(seen.refused).toBeGreaterThan(500);
    expect(seen.relocated).toBeGreaterThan(500);
    expect(seen.split).toBeGreaterThan(500);
    expect(seen.must_refuse).toBeGreaterThan(200);
  });
});
