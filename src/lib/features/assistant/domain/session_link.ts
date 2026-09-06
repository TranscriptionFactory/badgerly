export type SessionLinkTarget = { id: string; title: string };

const LINK_PREFIX = "◈";

// `~` is a typing alias, not a stored form: it is accepted while the wiki
// suggester is open, and accepting a suggestion writes the canonical `◈`
// target. Nothing outside a live query ever carries it, so link extraction,
// resolution, and the Rust index keep reading one prefix.
const QUERY_PREFIXES = [LINK_PREFIX, "~"];

export function is_session_link(target: string): boolean {
  return target.trimStart().startsWith(LINK_PREFIX);
}

export function is_session_query(text: string): boolean {
  const trimmed = text.trimStart();
  return QUERY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function session_query_term(text: string): string {
  const trimmed = text.trim();
  const prefix = QUERY_PREFIXES.find((candidate) =>
    trimmed.startsWith(candidate),
  );
  return prefix === undefined ? "" : trimmed.slice(prefix.length).trim();
}

export function session_link_target(target: string): string | null {
  if (!is_session_link(target)) return null;
  const value = target.trim().slice(LINK_PREFIX.length).trim();
  return value && !/[[\]|\r\n]/.test(value) ? value : null;
}

export function resolve_session_link(
  target: string,
  sessions: readonly SessionLinkTarget[],
): SessionLinkTarget | null {
  const value = session_link_target(target);
  if (!value) return null;
  const by_id = sessions.find((session) => session.id === value);
  if (by_id) return by_id;
  const by_title = sessions.filter((session) => session.title === value);
  return by_title.length === 1 ? (by_title[0] ?? null) : null;
}
