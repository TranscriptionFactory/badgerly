export type SessionLinkTarget = { id: string; title: string };

export function is_session_link(target: string): boolean {
  return target.trimStart().startsWith("◈");
}

export function session_link_target(target: string): string | null {
  if (!is_session_link(target)) return null;
  const value = target.trim().slice(1).trim();
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
