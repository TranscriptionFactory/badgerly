export const PROMOTED_TAGS_SETTING_KEY = "promoted_tags";

export function sanitize_promoted_tags(_value: unknown): string[] {
  throw new Error("not implemented");
}

export function with_promoted(_list: string[], _tag: string): string[] {
  throw new Error("not implemented");
}

export function without_promoted(_list: string[], _tag: string): string[] {
  throw new Error("not implemented");
}

export function is_tag_promoted(
  _tag: string,
  _promoted: readonly string[],
): boolean {
  throw new Error("not implemented");
}
