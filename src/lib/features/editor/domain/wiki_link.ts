import { is_session_link } from "$lib/features/assistant";

const ANCHOR_SEPARATOR = " > ";

export type WikiTarget = { path: string; fragment: string | null };

function strip_md_extension(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

function ensure_md_extension(value: string): string {
  const dot = value.lastIndexOf(".");
  const slash = value.lastIndexOf("/");
  if (dot > slash && dot !== -1) return value;
  return `${value}.md`;
}

export function split_wiki_target(raw_target: string): WikiTarget {
  if (is_session_link(raw_target))
    return { path: raw_target.trim(), fragment: null };
  const hash = raw_target.indexOf("#");
  if (hash === -1) return { path: raw_target, fragment: null };
  const fragment = raw_target.slice(hash + 1);
  return {
    path: raw_target.slice(0, hash),
    fragment: fragment === "" ? null : fragment,
  };
}

export function format_wiki_display(vault_path: string): string {
  return is_session_link(vault_path)
    ? vault_path.trim()
    : strip_md_extension(vault_path);
}

export function build_wiki_href(raw_target: string): string {
  const { path, fragment } = split_wiki_target(raw_target);
  const base =
    path === "" ? "" : is_session_link(path) ? path : ensure_md_extension(path);
  return fragment === null ? base : `${base}#${fragment}`;
}

export function format_wiki_target_display(raw_target: string): string {
  const { path, fragment } = split_wiki_target(raw_target);
  const label = format_wiki_display(path);
  if (fragment === null) return label;
  return label === "" ? fragment : `${label}${ANCHOR_SEPARATOR}${fragment}`;
}

export function wiki_target_from_href(href: string): string {
  const { path, fragment } = split_wiki_target(href);
  const base = format_wiki_display(path);
  return fragment === null ? base : `${base}#${fragment}`;
}

export function format_wiki_source(href: string, display: string): string {
  const target = wiki_target_from_href(href);
  if (display === format_wiki_target_display(target)) return `[[${target}]]`;
  return `[[${target}|${display}]]`;
}

export function format_markdown_link(path: string, title: string): string {
  return `[${title}](<${path}>)`;
}
