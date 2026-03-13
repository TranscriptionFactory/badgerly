import { invoke } from "@tauri-apps/api/core";
import type { PluginHostPort, DiscoveredPlugin } from "../ports";

export class PluginHostAdapter implements PluginHostPort {
  async discover(vault_path: string): Promise<DiscoveredPlugin[]> {
    try {
      return await invoke<DiscoveredPlugin[]>("plugin_discover", {
        vault_path,
      });
    } catch (e) {
      console.error("Failed to discover plugins:", e);
      return [];
    }
  }

  async load(id: string): Promise<void> {
    console.log(`Loading plugin ${id} (mock)`);
  }

  async unload(id: string): Promise<void> {
    console.log(`Unloading plugin ${id} (mock)`);
  }
}
