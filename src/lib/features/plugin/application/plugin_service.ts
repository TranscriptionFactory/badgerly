import type { PluginStore } from "../state/plugin_store.svelte";
import type { PluginHostPort, SidebarView, StatusBarItem } from "../ports";
import type { CommandDefinition } from "$lib/features/search/types/command_palette";
import type { VaultStore } from "$lib/features/vault";
import type { RpcRequest, RpcResponse } from "./plugin_rpc_handler";
import { PluginRpcHandler } from "./plugin_rpc_handler";

export class PluginService {
  private rpc_handler: PluginRpcHandler | null = null;

  constructor(
    private store: PluginStore,
    private vault_store: VaultStore,
    private host_port: PluginHostPort,
  ) {}

  /**
   * Late-bound context initialization to avoid circular dependencies during bootstrap.
   */
  initialize_rpc(context: { services: any; stores: any }) {
    this.rpc_handler = new PluginRpcHandler(context);
  }

  // Command registration
  register_command(command: CommandDefinition) {
    this.store.register_command(command);
  }

  unregister_command(id: string) {
    this.store.unregister_command(id);
  }

  // Status bar registration
  register_status_bar_item(item: StatusBarItem) {
    this.store.register_status_bar_item(item);
  }

  unregister_status_bar_item(id: string) {
    this.store.unregister_status_bar_item(id);
  }

  update_status_bar_item(id: string, props: Record<string, any>) {
    this.store.update_status_bar_item(id, props);
  }

  // Sidebar registration
  register_sidebar_view(view: SidebarView) {
    this.store.register_sidebar_view(view);
  }

  unregister_sidebar_view(id: string) {
    this.store.unregister_sidebar_view(id);
  }

  // Lifecycle
  async discover() {
    const vault_path = this.vault_store.vault?.path;
    if (!vault_path) return [];

    const discovered = await this.host_port.discover(vault_path);

    for (const { manifest, path } of discovered) {
      if (!this.store.plugins.has(manifest.id)) {
        this.store.plugins.set(manifest.id, {
          manifest,
          path,
          enabled: false,
          status: "idle",
        });
      }
    }

    return discovered;
  }

  async load_plugin(id: string) {
    // Milestone 3
    await this.host_port.load(id);
  }

  async unload_plugin(id: string) {
    // Milestone 3
    await this.host_port.unload(id);

    // Cleanup dynamic contributions from this plugin
    // Collect IDs first to avoid mutating while iterating
    const prefix = `${id}:`;
    const command_ids = this.store.commands
      .filter((c) => c.id.startsWith(prefix))
      .map((c) => c.id);
    const status_bar_ids = this.store.status_bar_items
      .filter((i) => i.id.startsWith(prefix))
      .map((i) => i.id);
    const sidebar_ids = this.store.sidebar_views
      .filter((v) => v.id.startsWith(prefix))
      .map((v) => v.id);

    command_ids.forEach((id) => this.unregister_command(id));
    status_bar_ids.forEach((id) => this.unregister_status_bar_item(id));
    sidebar_ids.forEach((id) => this.unregister_sidebar_view(id));
  }

  async enable_plugin(id: string) {
    const plugin = this.store.plugins.get(id);
    if (!plugin) return;

    this.store.plugins.set(id, { ...plugin, status: "loading" });
    try {
      await this.load_plugin(id);
      this.store.plugins.set(id, {
        ...plugin,
        enabled: true,
        status: "active",
      });
    } catch (e) {
      this.store.plugins.set(id, {
        ...plugin,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async disable_plugin(id: string) {
    const plugin = this.store.plugins.get(id);
    if (!plugin) return;

    try {
      await this.unload_plugin(id);
      this.store.plugins.set(id, { ...plugin, enabled: false, status: "idle" });
    } catch (e) {
      this.store.plugins.set(id, {
        ...plugin,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async handle_rpc(id: string, request: RpcRequest): Promise<RpcResponse> {
    const plugin = this.store.plugins.get(id);
    if (!plugin || !this.rpc_handler) {
      return { id: request.id, error: "Plugin or RPC handler not initialized" };
    }

    return this.rpc_handler.handle_request(id, plugin.manifest, request);
  }
}
