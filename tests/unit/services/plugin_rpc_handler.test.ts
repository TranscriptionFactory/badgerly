import { describe, expect, it, vi, beforeEach } from "vitest";
import { PluginRpcHandler } from "$lib/features/plugin/application/plugin_rpc_handler";
import type { PluginManifest } from "$lib/features/plugin/ports";

function make_manifest(permissions: string[]): PluginManifest {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "0.1.0",
    permissions,
    entry: "index.js",
  } as unknown as PluginManifest;
}

function make_context() {
  const plugin = {
    register_command: vi.fn(),
    unregister_command: vi.fn(),
    register_status_bar_item: vi.fn(),
    update_status_bar_item: vi.fn(),
    unregister_status_bar_item: vi.fn(),
    register_sidebar_view: vi.fn(),
    unregister_sidebar_view: vi.fn(),
  };

  return {
    services: { plugin } as any,
    stores: {} as any,
    plugin,
  };
}

const PLUGIN_ID = "test-plugin";

describe("PluginRpcHandler", () => {
  let ctx: ReturnType<typeof make_context>;
  let handler: PluginRpcHandler;

  beforeEach(() => {
    ctx = make_context();
    handler = new PluginRpcHandler(ctx);
  });

  describe("commands.remove", () => {
    it("removes a previously registered command", async () => {
      const manifest = make_manifest(["commands:register"]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "1",
        method: "commands.remove",
        params: ["my-command"],
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ success: true });
      expect(ctx.plugin.unregister_command).toHaveBeenCalledWith(
        `${PLUGIN_ID}:my-command`,
      );
    });

    it("throws when missing commands:register permission", async () => {
      const manifest = make_manifest([]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "1",
        method: "commands.remove",
        params: ["my-command"],
      });

      expect(response.error).toMatch(/Missing commands:register permission/);
      expect(ctx.plugin.unregister_command).not.toHaveBeenCalled();
    });
  });

  describe("ui.add_sidebar_panel", () => {
    it("registers a sidebar view with namespaced id", async () => {
      const manifest = make_manifest(["ui:panel"]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "2",
        method: "ui.add_sidebar_panel",
        params: [{ id: "my-panel", label: "My Panel", icon: {} }],
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ success: true });
      expect(ctx.plugin.register_sidebar_view).toHaveBeenCalledOnce();
      const call = ctx.plugin.register_sidebar_view.mock.calls[0]?.[0];
      expect(call?.id).toBe(`${PLUGIN_ID}:my-panel`);
      expect(call?.label).toBe("My Panel");
    });

    it("throws when missing ui:panel permission", async () => {
      const manifest = make_manifest([]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "2",
        method: "ui.add_sidebar_panel",
        params: [{ id: "my-panel", label: "My Panel", icon: {} }],
      });

      expect(response.error).toMatch(/Missing ui:panel permission/);
      expect(ctx.plugin.register_sidebar_view).not.toHaveBeenCalled();
    });
  });

  describe("ui.remove_statusbar_item", () => {
    it("unregisters a status bar item", async () => {
      const manifest = make_manifest(["ui:statusbar"]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "3",
        method: "ui.remove_statusbar_item",
        params: ["my-item"],
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ success: true });
      expect(ctx.plugin.unregister_status_bar_item).toHaveBeenCalledWith(
        `${PLUGIN_ID}:my-item`,
      );
    });

    it("throws when missing ui:statusbar permission", async () => {
      const manifest = make_manifest([]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "3",
        method: "ui.remove_statusbar_item",
        params: ["my-item"],
      });

      expect(response.error).toMatch(/Missing ui:statusbar permission/);
      expect(ctx.plugin.unregister_status_bar_item).not.toHaveBeenCalled();
    });
  });

  describe("ui.remove_sidebar_panel", () => {
    it("unregisters a sidebar view", async () => {
      const manifest = make_manifest(["ui:panel"]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "4",
        method: "ui.remove_sidebar_panel",
        params: ["my-panel"],
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ success: true });
      expect(ctx.plugin.unregister_sidebar_view).toHaveBeenCalledWith(
        `${PLUGIN_ID}:my-panel`,
      );
    });

    it("throws when missing ui:panel permission", async () => {
      const manifest = make_manifest([]);
      const response = await handler.handle_request(PLUGIN_ID, manifest, {
        id: "4",
        method: "ui.remove_sidebar_panel",
        params: ["my-panel"],
      });

      expect(response.error).toMatch(/Missing ui:panel permission/);
      expect(ctx.plugin.unregister_sidebar_view).not.toHaveBeenCalled();
    });
  });
});
