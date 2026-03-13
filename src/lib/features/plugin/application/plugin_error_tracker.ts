export type ErrorAction = "none" | "warn_user" | "auto_disable";

interface ErrorEntry {
  plugin_id: string;
  timestamp_ms: number;
}

export class PluginErrorTracker {
  private entries: Map<string, ErrorEntry[]> = new Map();

  constructor(private now_ms: () => number = () => Date.now()) {}

  record_error(plugin_id: string, timestamp_ms: number): ErrorAction {
    const existing = this.entries.get(plugin_id) ?? [];
    const pruned = existing.filter(
      (e) => timestamp_ms - e.timestamp_ms <= 15_000,
    );
    pruned.push({ plugin_id, timestamp_ms });
    this.entries.set(plugin_id, pruned);

    const within_5s = pruned.filter(
      (e) => timestamp_ms - e.timestamp_ms <= 5_000,
    ).length;
    const within_15s = pruned.length;

    if (within_15s >= 5) return "auto_disable";
    if (within_5s >= 2) return "warn_user";
    return "none";
  }

  reset(plugin_id: string): void {
    this.entries.delete(plugin_id);
  }

  clear_all(): void {
    this.entries.clear();
  }
}
