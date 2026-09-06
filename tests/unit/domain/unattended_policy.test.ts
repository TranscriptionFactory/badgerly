import { describe, expect, it } from "vitest";
import {
  INTERACTIVE_MAX_ITERATIONS,
  MAX_ITERATIONS_HARD_CAP,
  UNATTENDED_MAX_ITERATIONS,
  is_unattended_kind,
  resolve_max_iterations,
} from "$lib/features/assistant/domain/unattended_policy";

describe("resolve_max_iterations", () => {
  it("gives an interactive run the interactive default", () => {
    expect(resolve_max_iterations("agent")).toBe(INTERACTIVE_MAX_ITERATIONS);
    expect(resolve_max_iterations("chat")).toBe(INTERACTIVE_MAX_ITERATIONS);
  });

  it("gives an unattended run the longer default", () => {
    expect(resolve_max_iterations("background")).toBe(
      UNATTENDED_MAX_ITERATIONS,
    );
  });

  it("honours an explicit budget", () => {
    expect(resolve_max_iterations("agent", 3)).toBe(3);
    expect(resolve_max_iterations("background", 64)).toBe(64);
  });

  it("clamps above the hard cap instead of refusing", () => {
    expect(resolve_max_iterations("background", 10_000)).toBe(
      MAX_ITERATIONS_HARD_CAP,
    );
  });

  it("treats a non-positive or non-finite budget as no opinion", () => {
    expect(resolve_max_iterations("background", 0)).toBe(
      UNATTENDED_MAX_ITERATIONS,
    );
    expect(resolve_max_iterations("background", -5)).toBe(
      UNATTENDED_MAX_ITERATIONS,
    );
    expect(resolve_max_iterations("agent", Number.NaN)).toBe(
      INTERACTIVE_MAX_ITERATIONS,
    );
    expect(resolve_max_iterations("agent", Number.POSITIVE_INFINITY)).toBe(
      INTERACTIVE_MAX_ITERATIONS,
    );
  });

  it("floors a fractional budget rather than refusing it", () => {
    expect(resolve_max_iterations("agent", 4.9)).toBe(4);
    expect(resolve_max_iterations("agent", 0.5)).toBe(
      INTERACTIVE_MAX_ITERATIONS,
    );
  });
});

describe("is_unattended_kind", () => {
  it("counts only background runs as unattended", () => {
    expect(is_unattended_kind("background")).toBe(true);
    for (const kind of ["inline", "note", "chat", "agent"] as const) {
      expect(is_unattended_kind(kind)).toBe(false);
    }
  });
});
