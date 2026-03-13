import { describe, expect, it } from "vitest";
import { UIStore } from "$lib/app";
import { create_editor_appearance_reactor } from "$lib/reactors/editor_appearance.reactor.svelte";

describe("editor_appearance.reactor", () => {
  it("returns a cleanup function", () => {
    const unmount = create_editor_appearance_reactor(new UIStore());

    expect(typeof unmount).toBe("function");

    unmount();
  });
});
