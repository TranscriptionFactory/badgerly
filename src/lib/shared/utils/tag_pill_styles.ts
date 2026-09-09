const STYLE_ELEMENT_ID = "tag-pill-styles";

export function build_tag_pill_css(
  _promoted_tags: readonly string[],
  _colors: Record<string, string>,
): string {
  throw new Error("not implemented");
}

export function apply_tag_pill_styles(
  promoted_tags: readonly string[],
  colors: Record<string, string>,
): void {
  let element = document.getElementById(STYLE_ELEMENT_ID);
  if (!(element instanceof HTMLStyleElement)) {
    element = document.createElement("style");
    element.id = STYLE_ELEMENT_ID;
    document.head.appendChild(element);
  }
  element.textContent = build_tag_pill_css(promoted_tags, colors);
}
