import type { OutlineHeading } from "$lib/features/outline";

export function extract_headings_from_markdown(
  markdown: string,
): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      headings.push({
        id: `h-${String(i)}`,
        level: match[1].length,
        text: match[2].replace(/\s*#+\s*$/, ""),
        pos: i,
      });
    }
  }
  return headings;
}
