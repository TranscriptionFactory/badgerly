const STYLE_ELEMENT_ID = "tag-pill-styles";

const PROMOTED_COLOR =
  "color-mix(in oklab, var(--tag-pill-color, var(--primary)) 55%, var(--editor-foreground))";
const PROMOTED_BACKGROUND =
  "color-mix(in oklab, var(--tag-pill-color, var(--primary)) 12%, transparent)";
const PROMOTED_HOVER_BACKGROUND =
  "color-mix(in oklab, var(--tag-pill-color, var(--primary)) 22%, transparent)";

function escape_css_string(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function build_promoted_rules(promoted_tags: readonly string[]): string[] {
  if (promoted_tags.length === 0) return [];
  const selectors = [...promoted_tags]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((tag) => {
      const escaped = escape_css_string(tag);
      return [`[data-tag="${escaped}" i]`, `[data-tag^="${escaped}/" i]`];
    });
  const selector = `.ProseMirror .tag-pill:is(${selectors.join(", ")})`;
  return [
    `${selector} { color: ${PROMOTED_COLOR}; background-color: ${PROMOTED_BACKGROUND}; }`,
    `${selector}:hover { background-color: ${PROMOTED_HOVER_BACKGROUND}; }`,
  ];
}

function build_color_rules(colors: Record<string, string>): string[] {
  return Object.entries(colors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([tag, color]) =>
        `.tag-pill[data-tag="${escape_css_string(tag)}" i] { --tag-pill-color: ${color}; }`,
    );
}

export function build_tag_pill_css(
  promoted_tags: readonly string[],
  colors: Record<string, string>,
): string {
  return [
    ...build_promoted_rules(promoted_tags),
    ...build_color_rules(colors),
  ].join("\n");
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
