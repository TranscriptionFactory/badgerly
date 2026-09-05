import type { BaseQuery } from "$lib/generated/bindings";

export const MEMORY_PROPERTY = "memory";

const MEMORY_QUERY_LIMIT = 10000;

export function memory_notes_query(): BaseQuery {
  return {
    filters: [{ property: MEMORY_PROPERTY, operator: "eq", value: "true" }],
    sort: [{ property: "mtime_ms", descending: true }],
    limit: MEMORY_QUERY_LIMIT,
    offset: 0,
  };
}
