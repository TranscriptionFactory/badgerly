import type { AiApplyTarget } from "$lib/features/ai/domain/ai_types";

export type AiDraftDiffLine = {
  type: "context" | "addition" | "deletion";
  content: string;
  old_line: number | null;
  new_line: number | null;
};

export type AiDraftDiffHunk = {
  header: string;
  lines: AiDraftDiffLine[];
};

export type AiDraftDiff = {
  additions: number;
  deletions: number;
  hunks: AiDraftDiffHunk[];
};

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
    });
    j += 1;
    new_line += 1;
  }

  return lines;
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

  return {
    additions,
    deletions,
    hunks: [
      {
        header:
          input.target === "selection"
            ? "@@ AI selection draft @@"
            : "@@ AI full note draft @@",
        lines,
      },
    ],
  };
}
