import { is_valid_tag_name } from "./tag_colors";

export const PROMOTED_TAGS_SETTING_KEY = "promoted_tags";

function clean_tag(raw: string): string {
  return raw.trim().replace(/^#/, "");
}

function index_of_tag(list: readonly string[], tag: string): number {
  const lower = tag.toLowerCase();
  return list.findIndex((entry) => entry.toLowerCase() === lower);
}

export function sanitize_promoted_tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = clean_tag(raw);
    if (!is_valid_tag_name(tag)) continue;
    if (index_of_tag(result, tag) !== -1) continue;
    result.push(tag);
  }
  return result;
}

export function with_promoted(list: string[], tag: string): string[] {
  const cleaned = clean_tag(tag);
  if (!is_valid_tag_name(cleaned)) return list;
  if (index_of_tag(list, cleaned) !== -1) return list;
  return [...list, cleaned];
}

export function without_promoted(list: string[], tag: string): string[] {
  const index = index_of_tag(list, clean_tag(tag));
  if (index === -1) return list;
  return list.filter((_, i) => i !== index);
}

export function is_tag_promoted(
  tag: string,
  promoted: readonly string[],
): boolean {
  const lower = tag.toLowerCase();
  return promoted.some((entry) => {
    const prefix = entry.toLowerCase();
    return lower === prefix || lower.startsWith(`${prefix}/`);
  });
}
