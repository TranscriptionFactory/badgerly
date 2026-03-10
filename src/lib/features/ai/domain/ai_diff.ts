import type { AiApplyTarget } from "$lib/features/ai/domain/ai_types";

export type AiDraftDiffLine = {
  type: "context" | "addition" | "deletion";
  content: string;
  old_line: number | null;
  new_line: number | null;
  hunk_id: string | null;
};

export type AiDraftDiffHunk = {
  id: string;
  header: string;
  additions: number;
  deletions: number;
  lines: AiDraftDiffLine[];
};

export type AiDraftDiff = {
  additions: number;
  deletions: number;
  lines: AiDraftDiffLine[];
  hunks: AiDraftDiffHunk[];
};

const HUNK_CONTEXT_LINES = 2;

function split_lines(input: string): string[] {
  return input.split("\n");
}

function lcs_table(left: string[], right: string[]): number[][] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const row = table[i];
      const next_row = table[i + 1];
      if (!row || !next_row) {
        continue;
      }
      row[j] =
        left[i] === right[j]
          ? (next_row[j + 1] ?? 0) + 1
          : Math.max(next_row[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  return table;
}

function diff_lines(original: string[], revised: string[]): AiDraftDiffLine[] {
  const table = lcs_table(original, revised);
  const lines: AiDraftDiffLine[] = [];
  let i = 0;
  let j = 0;
  let old_line = 1;
  let new_line = 1;

  while (i < original.length && j < revised.length) {
    if (original[i] === revised[j]) {
      lines.push({
        type: "context",
        content: original[i] ?? "",
        old_line,
        new_line,
        hunk_id: null,
      });
      i += 1;
      j += 1;
      old_line += 1;
      new_line += 1;
      continue;
    }

    const row = table[i];
    const next_row = table[i + 1];
    const down = next_row?.[j] ?? 0;
    const right_score = row?.[j + 1] ?? 0;

    if (down >= right_score) {
      lines.push({
        type: "deletion",
        content: original[i] ?? "",
        old_line,
        new_line: null,
        hunk_id: null,
      });
      i += 1;
      old_line += 1;
      continue;
    }

    lines.push({
      type: "addition",
      content: revised[j] ?? "",
      old_line: null,
      new_line,
      hunk_id: null,
    });
    j += 1;
    new_line += 1;
  }

  while (i < original.length) {
    lines.push({
      type: "deletion",
      content: original[i] ?? "",
      old_line,
      new_line: null,
      hunk_id: null,
    });
    i += 1;
    old_line += 1;
  }

  while (j < revised.length) {
    lines.push({
      type: "addition",
      content: revised[j] ?? "",
      old_line: null,
      new_line,
      hunk_id: null,
    });
    j += 1;
    new_line += 1;
  }

  return lines;
}

function hunk_ranges(lines: AiDraftDiffLine[]) {
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.type === "context") {
      continue;
    }

    const start = Math.max(0, index - HUNK_CONTEXT_LINES);
    const end = Math.min(lines.length, index + HUNK_CONTEXT_LINES + 1);
    const last_range = ranges[ranges.length - 1];

    if (!last_range || start > last_range.end) {
      ranges.push({ start, end });
      continue;
    }

    last_range.end = Math.max(last_range.end, end);
  }

  return ranges;
}

function hunk_header(lines: AiDraftDiffLine[]) {
  const old_start =
    lines.find((line) => line.old_line !== null)?.old_line ??
    lines.find((line) => line.new_line !== null)?.new_line ??
    1;
  const new_start =
    lines.find((line) => line.new_line !== null)?.new_line ??
    lines.find((line) => line.old_line !== null)?.old_line ??
    1;
  const old_count = lines.filter((line) => line.type !== "addition").length;
  const new_count = lines.filter((line) => line.type !== "deletion").length;

  return `@@ -${String(old_start)},${String(old_count)} +${String(new_start)},${String(new_count)} @@`;
}

function assign_hunks(lines: AiDraftDiffLine[]) {
  const ranges = hunk_ranges(lines);

  return ranges.map((range, index) => {
    const id = `hunk-${String(index + 1)}`;
    const hunk_lines = lines.slice(range.start, range.end).map((line) => {
      line.hunk_id = id;
      return { ...line };
    });

    return {
      id,
      header: hunk_header(hunk_lines),
      additions: hunk_lines.filter((line) => line.type === "addition").length,
      deletions: hunk_lines.filter((line) => line.type === "deletion").length,
      lines: hunk_lines,
    };
  });
}

export function create_ai_draft_diff(input: {
  original_text: string;
  draft_text: string;
  target: AiApplyTarget;
}): AiDraftDiff {
  const original_lines = split_lines(input.original_text);
  const draft_lines = split_lines(input.draft_text);
  const lines = diff_lines(original_lines, draft_lines);
  const additions = lines.filter((line) => line.type === "addition").length;
  const deletions = lines.filter((line) => line.type === "deletion").length;
  const hunks = assign_hunks(lines);

  return {
    additions,
    deletions,
    lines,
    hunks:
      hunks.length > 0
        ? hunks
        : [
            {
              id: "hunk-1",
              header:
                input.target === "selection"
                  ? "@@ AI selection draft @@"
                  : "@@ AI full note draft @@",
              additions: 0,
              deletions: 0,
              lines,
            },
          ],
  };
}

export function apply_ai_draft_hunk_selection(input: {
  diff: AiDraftDiff;
  selected_hunk_ids: string[];
}): string {
  const selected_hunk_ids = new Set(input.selected_hunk_ids);
  const output: string[] = [];

  for (const line of input.diff.lines) {
    if (line.type === "context") {
      output.push(line.content);
      continue;
    }

    if (line.hunk_id && selected_hunk_ids.has(line.hunk_id)) {
      if (line.type === "addition") {
        output.push(line.content);
      }
      continue;
    }

    if (line.type === "deletion") {
      output.push(line.content);
    }
  }

  return output.join("\n");
}
