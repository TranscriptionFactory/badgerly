import { describe, expect, it } from "vitest";
import {
  PROMOTED_TAGS_SETTING_KEY,
  is_tag_promoted,
  sanitize_promoted_tags,
  with_promoted,
  without_promoted,
} from "$lib/features/tags/domain/promoted_tags";

describe("promoted tags setting key", () => {
  it("matches the vault setting key Rust reads", () => {
    expect(PROMOTED_TAGS_SETTING_KEY).toBe("promoted_tags");
  });
});

describe("sanitize_promoted_tags", () => {
  it("returns an empty list for non-array input", () => {
    expect(sanitize_promoted_tags(null)).toEqual([]);
    expect(sanitize_promoted_tags("rust")).toEqual([]);
    expect(sanitize_promoted_tags({ rust: true })).toEqual([]);
  });

  it("drops non-string and invalid entries", () => {
    expect(
      sanitize_promoted_tags(["rust", 3, null, "", "bad tag", "#"]),
    ).toEqual(["rust"]);
  });

  it("trims whitespace and strips a leading hash", () => {
    expect(sanitize_promoted_tags([" #Rust ", "svelte"])).toEqual([
      "Rust",
      "svelte",
    ]);
  });

  it("dedupes case-insensitively keeping the first casing", () => {
    expect(sanitize_promoted_tags(["Rust", "rust", "RUST", "svelte"])).toEqual([
      "Rust",
      "svelte",
    ]);
  });
});

describe("with_promoted", () => {
  it("appends a new tag", () => {
    expect(with_promoted(["rust"], "svelte")).toEqual(["rust", "svelte"]);
  });

  it("returns the same array when the tag is already listed", () => {
    const list = ["rust"];
    expect(with_promoted(list, "rust")).toBe(list);
  });

  it("treats casing and a leading hash as the same tag", () => {
    const list = ["Rust"];
    expect(with_promoted(list, "#rust")).toBe(list);
  });

  it("returns the same array for an invalid tag", () => {
    const list = ["rust"];
    expect(with_promoted(list, "not a tag")).toBe(list);
  });
});

describe("without_promoted", () => {
  it("removes the entry case-insensitively", () => {
    expect(without_promoted(["Rust", "svelte"], "#rust")).toEqual(["svelte"]);
  });

  it("returns the same array when the tag is absent", () => {
    const list = ["rust"];
    expect(without_promoted(list, "svelte")).toBe(list);
  });
});

describe("is_tag_promoted", () => {
  it("matches an exact entry", () => {
    expect(is_tag_promoted("rust", ["rust"])).toBe(true);
  });

  it("matches descendants of a promoted ancestor", () => {
    expect(is_tag_promoted("project/active/q3", ["project"])).toBe(true);
    expect(is_tag_promoted("project/active/q3", ["project/active"])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(is_tag_promoted("Rust", ["rust"])).toBe(true);
    expect(is_tag_promoted("Project/Active", ["project"])).toBe(true);
  });

  it("requires a whole segment, so proj does not promote project", () => {
    expect(is_tag_promoted("project", ["proj"])).toBe(false);
    expect(is_tag_promoted("projects/x", ["project"])).toBe(false);
  });

  it("does not promote an ancestor from a promoted descendant", () => {
    expect(is_tag_promoted("project", ["project/active"])).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(is_tag_promoted("rust", [])).toBe(false);
  });
});
