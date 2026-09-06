import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { apply_proposal_hunks } from "$lib/features/assistant/domain/apply_proposal_hunks";
import { isMap, parseDocument } from "yaml";
import { compute_note_revision } from "$lib/features/assistant/domain/note_revision";
import type {
  EditOperation,
  OperationConflict,
} from "$lib/features/assistant/types/edit_operation";
import type {
  Proposal,
  ProposalHunk,
} from "$lib/features/assistant/types/proposal";

const heading_parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"]);

type Span = { start: number; end: number; text: string; hunk_id: string };

export function valid_note_operation_path(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /\.md$/i.test(path) &&
    !path.includes("\\") &&
    !path.startsWith("/") &&
    path
      .split("/")
      .every(
        (part) =>
          part !== "" && part !== "." && part !== ".." && !part.startsWith("."),
      )
  );
}

export function validate_edit_operations(proposal: Proposal): void {
  if (proposal.operations === undefined) return;
  if (
    !Array.isArray(proposal.operations) ||
    proposal.operations.length === 0 ||
    typeof proposal.base_content !== "string" ||
    compute_note_revision(proposal.base_content) !== proposal.base_revision
  )
    throw new Error("Invalid operation base content or revision");
  if (
    proposal.target.kind === "note" &&
    !valid_note_operation_path(proposal.target.note_path)
  )
    throw new Error("Invalid note operation target");
  const base = proposal.base_content;
  const ids = new Set(proposal.hunks.map((hunk) => hunk.id));
  if (
    ids.size !== proposal.hunks.length ||
    [...ids].some((id) => typeof id !== "string" || !id)
  )
    throw new Error("Invalid review hunk identifiers");
  for (const operation of proposal.operations) {
    if (
      !operation ||
      typeof operation !== "object" ||
      operation.base_revision !== proposal.base_revision ||
      !ids.has(operation.hunk_id)
    )
      throw new Error("Invalid operation revision or hunk");
    switch (operation.kind) {
      case "replace_span":
        if (
          !Number.isSafeInteger(operation.start) ||
          !Number.isSafeInteger(operation.end) ||
          operation.start < 0 ||
          operation.end < operation.start ||
          operation.end > proposal.base_content.length ||
          typeof operation.text !== "string" ||
          !utf16_boundary(proposal.base_content, operation.start) ||
          !utf16_boundary(proposal.base_content, operation.end)
        )
          throw new Error("Invalid replacement span");
        break;
      case "insert_at_heading":
        if (
          typeof operation.heading !== "string" ||
          !operation.heading.trim() ||
          typeof operation.text !== "string"
        )
          throw new Error("Invalid heading insertion");
        break;
      case "set_frontmatter":
        if (
          typeof operation.key !== "string" ||
          !operation.key.trim() ||
          ["__proto__", "constructor", "prototype"].includes(operation.key) ||
          !valid_json(operation.value)
        )
          throw new Error("Invalid frontmatter operation");
        break;
      case "rename_with_repair":
        if (
          proposal.target.kind !== "note" ||
          !valid_note_operation_path(proposal.target.note_path) ||
          !valid_note_operation_path(operation.to_path) ||
          operation.to_path === proposal.target.note_path ||
          proposal.operations.length !== 1
        )
          throw new Error("Invalid rename operation");
        break;
      default:
        throw new Error("Unknown edit operation");
    }
  }
  const spans = proposal.operations
    .filter((operation) => operation.kind !== "rename_with_repair")
    .map((operation) => operation_span(base, operation))
    .sort((a, b) => a.start - b.start);
  let previous: Span | undefined;
  for (const span of spans) {
    if (
      previous &&
      (span.start < previous.end || span.start === previous.start)
    )
      throw new Error("Overlapping edit operations");
    previous = span;
  }
  for (const hunk of proposal.hunks) {
    const operations = proposal.operations.filter(
      (operation) => operation.hunk_id === hunk.id,
    );
    const first = operations[0];
    if (!first) throw new Error("Review hunk has no operation");
    if (first.kind === "rename_with_repair") {
      if (
        hunk.header !== `Rename to ${first.to_path}` ||
        hunk.lines.length !== 0
      )
        throw new Error("Rename review does not match operation");
      continue;
    }
    const expected = apply_spans(
      proposal.base_content,
      operations.map((operation) => operation_span(base, operation)),
    );
    if (
      apply_proposal_hunks(proposal.base_content, [
        { ...hunk, selected: true },
      ]) !== expected
    )
      throw new Error("Review hunk does not match operation");
  }
}

function valid_json(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(valid_json);
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return Object.entries(value).every(
    ([key, item]) =>
      !["__proto__", "constructor", "prototype"].includes(key) &&
      valid_json(item),
  );
}

function operation_span(base: string, operation: EditOperation): Span {
  const hunk_id = operation.hunk_id;
  switch (operation.kind) {
    case "replace_span":
      return { ...operation };
    case "insert_at_heading": {
      const headings = heading_parser
        .parse(base)
        .children.filter((node) => node.type === "heading");
      const matches = headings.filter(
        (node) =>
          node.type === "heading" &&
          node.children
            .map((child) => ("value" in child ? child.value : ""))
            .join("") === operation.heading,
      );
      if (matches.length !== 1)
        throw new Error("Heading must resolve uniquely");
      const start = matches[0]?.position?.start.offset;
      const end = matches[0]?.position?.end.offset;
      if (start === undefined || end === undefined)
        throw new Error("Heading position is missing");
      return {
        start,
        end,
        text: base.slice(start, end) + "\n" + operation.text,
        hunk_id,
      };
    }
    case "set_frontmatter": {
      const match = /^---\r?\n((?:[^\n]*\n)*?)---(?:\r?\n|$)/.exec(base);
      if (/^---\r?\n/.test(base) && !match)
        throw new Error("Unclosed frontmatter");
      const document = parseDocument(match?.[1] ?? "");
      if (
        document.errors.length ||
        (document.contents !== null && !isMap(document.contents))
      )
        throw new Error("Invalid frontmatter mapping");
      document.set(operation.key, operation.value);
      const before = match?.[0] ?? "";
      const after = `---\n${document.toString()}---\n`;
      let start = 0;
      while (
        start < Math.min(before.length, after.length) &&
        before[start] === after[start]
      )
        start++;
      let end = before.length;
      let next_end = after.length;
      while (
        end > start &&
        next_end > start &&
        before[end - 1] === after[next_end - 1]
      ) {
        end--;
        next_end--;
      }
      return { start, end, text: after.slice(start, next_end), hunk_id };
    }
    case "rename_with_repair":
      throw new Error("Rename requires the note mutation port");
  }
}

export function apply_edit_operations(
  proposal: Proposal,
  current: string,
): { content: string; conflict: OperationConflict | null } {
  validate_edit_operations(proposal);
  const base = proposal.base_content;
  if (base === undefined) throw new Error("Operation base content is missing");
  const selected = new Set(
    proposal.hunks.filter((hunk) => hunk.selected).map((hunk) => hunk.id),
  );
  const spans: Span[] = [];
  for (const operation of proposal.operations ?? []) {
    if (
      !selected.has(operation.hunk_id) ||
      operation.kind === "rename_with_repair"
    )
      continue;
    const span = operation_span(base, operation);
    const position = rebase_span(base, current, span);
    if (position === null)
      return {
        content: current,
        conflict: {
          hunk_id: span.hunk_id,
          start: span.start,
          end: span.end,
          reason: "The proposed span changed or no longer has a unique anchor.",
        },
      };
    spans.push({
      ...span,
      start: position,
      end: position + span.end - span.start,
    });
  }
  spans.sort((a, b) => b.start - a.start);
  let previous: Span | undefined;
  for (const span of spans) {
    if (
      previous &&
      (span.end > previous.start || span.start === previous.start)
    )
      return {
        content: current,
        conflict: { ...span, reason: "Rebased operation spans overlap." },
      };
    previous = span;
  }
  let content = current;
  for (const span of spans)
    content =
      content.slice(0, span.start) + span.text + content.slice(span.end);
  return { content, conflict: null };
}

function rebase_span(base: string, current: string, span: Span): number | null {
  if (base === current) return span.start;
  let prefix = 0;
  while (
    prefix < Math.min(base.length, current.length) &&
    base[prefix] === current[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(base.length, current.length) - prefix &&
    base[base.length - suffix - 1] === current[current.length - suffix - 1]
  )
    suffix++;
  if (span.end < prefix || (span.end === prefix && span.start < span.end))
    return span.start;
  if (
    span.start > base.length - suffix ||
    (span.start === base.length - suffix && span.start < span.end)
  )
    return current.length - base.length + span.start;
  if (span.start === span.end) return null;
  const old_lines = base.split("\n");
  const new_lines = current.split("\n");
  if (old_lines.length * new_lines.length > 1_000_000) return null;
  const first = base.slice(0, span.start).split("\n").length - 1;
  const last = base.slice(0, span.end - 1).split("\n").length;
  const block = old_lines.slice(first, last);
  const matches = new_lines.flatMap((_, index) =>
    block.every((line, offset) => new_lines[index + offset] === line)
      ? [index]
      : [],
  );
  const at = matches.length === 1 ? matches[0] : undefined;
  if (at === undefined) return null;
  const optimum = common_line_count(old_lines, new_lines);
  const through_candidate =
    common_line_count(old_lines.slice(0, first), new_lines.slice(0, at)) +
    block.length +
    common_line_count(
      old_lines.slice(last),
      new_lines.slice(at + block.length),
    );
  if (through_candidate !== optimum) return null;
  const without_candidate = common_line_count(old_lines, [
    ...new_lines.slice(0, at),
    ...new_lines.slice(at + block.length),
  ]);
  if (optimum - without_candidate !== block.length) return null;
  const before = old_lines
    .slice(0, first)
    .reduce((offset, line) => offset + line.length + 1, 0);
  const after = new_lines
    .slice(0, at)
    .reduce((offset, line) => offset + line.length + 1, 0);
  return after + span.start - before;
}

function apply_spans(content: string, spans: Span[]): string {
  for (const span of spans.sort((a, b) => b.start - a.start))
    content =
      content.slice(0, span.start) + span.text + content.slice(span.end);
  return content;
}

export function operation_hunks(
  base: string,
  operations: EditOperation[],
): ProposalHunk[] {
  return [...new Set(operations.map((operation) => operation.hunk_id))].map(
    (id) => {
      const group = operations.filter((operation) => operation.hunk_id === id);
      const rename = group.find(
        (operation) => operation.kind === "rename_with_repair",
      );
      if (rename?.kind === "rename_with_repair")
        return {
          id,
          header: `Rename to ${rename.to_path}`,
          selected: true,
          lines: [],
        };
      const next = apply_spans(
        base,
        group.map((operation) => operation_span(base, operation)),
      );
      const old_lines = base.split("\n");
      const new_lines = next.split("\n");
      let start = 0;
      while (
        start < Math.min(old_lines.length, new_lines.length) &&
        old_lines[start] === new_lines[start]
      )
        start++;
      start = Math.max(0, start - 1);
      let end = old_lines.length;
      let next_end = new_lines.length;
      while (
        end > start + 1 &&
        next_end > start + 1 &&
        old_lines[end - 1] === new_lines[next_end - 1]
      ) {
        end--;
        next_end--;
      }
      return {
        id,
        header: `@@ -${String(start + 1)},${String(end - start)} +${String(start + 1)},${String(next_end - start)} @@`,
        selected: true,
        lines: [
          ...old_lines.slice(start, end).map((content, index) => ({
            kind: "del" as const,
            content,
            old_line: start + index + 1,
            new_line: null,
          })),
          ...new_lines.slice(start, next_end).map((content, index) => ({
            kind: "add" as const,
            content,
            old_line: null,
            new_line: start + index + 1,
          })),
        ],
      };
    },
  );
}

function common_line_count(left: string[], right: string[]): number {
  const row = new Uint32Array(right.length + 1);
  for (const line of left) {
    let diagonal = 0;
    for (let column = 1; column <= right.length; column++) {
      const previous = row[column] ?? 0;
      row[column] =
        line === right[column - 1]
          ? diagonal + 1
          : Math.max(row[column] ?? 0, row[column - 1] ?? 0);
      diagonal = previous;
    }
  }
  return row[right.length] ?? 0;
}

function utf16_boundary(content: string, offset: number): boolean {
  return !(
    offset > 0 &&
    offset < content.length &&
    content.charCodeAt(offset - 1) >= 0xd800 &&
    content.charCodeAt(offset - 1) <= 0xdbff &&
    content.charCodeAt(offset) >= 0xdc00 &&
    content.charCodeAt(offset) <= 0xdfff
  );
}
