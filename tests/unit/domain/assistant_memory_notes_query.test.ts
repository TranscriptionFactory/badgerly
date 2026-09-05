import { describe, expect, it } from "vitest";
import {
  MEMORY_PROPERTY,
  memory_notes_query,
} from "$lib/features/assistant/domain/memory_notes_query";

describe("memory_notes_query", () => {
  it("filters on memory eq true and lists newest first", () => {
    const query = memory_notes_query();

    expect(MEMORY_PROPERTY).toBe("memory");
    expect(query.filters).toEqual([
      { property: "memory", operator: "eq", value: "true" },
    ]);
    expect(query.sort).toEqual([{ property: "mtime_ms", descending: true }]);
    expect(query.offset).toBe(0);
    expect(query.limit).toBeGreaterThan(0);
  });
});
