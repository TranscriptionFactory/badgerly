export type SettingsCategory =
  | "theme"
  | "layout"
  | "files"
  | "git"
  | "terminal"
  | "misc"
  | "hotkeys";

export type GitAutocommitMode = "off" | "on_save" | "interval";

export type EditorSettings = {
  attachment_folder: string;
  show_hidden_files: boolean;
  autosave_enabled: boolean;
  git_autocommit_mode: GitAutocommitMode;
  git_autocommit_interval_minutes: number;
  show_vault_dashboard_on_open: boolean;
  max_open_tabs: number;
  editor_max_width_ch: number;
  terminal_shell_path: string;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  attachment_folder: ".assets",
  show_hidden_files: false,
  autosave_enabled: true,
  git_autocommit_mode: "off",
  git_autocommit_interval_minutes: 5,
  show_vault_dashboard_on_open: true,
  max_open_tabs: 5,
  editor_max_width_ch: 85,
  terminal_shell_path: "/bin/zsh",
};

export const SETTINGS_KEY = "editor" as const;

export const GLOBAL_ONLY_SETTING_KEYS: readonly (keyof EditorSettings)[] = [
  "show_vault_dashboard_on_open",
  "git_autocommit_mode",
  "git_autocommit_interval_minutes",
  "autosave_enabled",
  "editor_max_width_ch",
  "terminal_shell_path",
] as const;

const GLOBAL_ONLY_SET = new Set<string>(GLOBAL_ONLY_SETTING_KEYS);

export function omit_global_only_keys(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!GLOBAL_ONLY_SET.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export async function apply_global_only_overrides(
  base: EditorSettings,
  get_setting: (key: string) => Promise<unknown>,
): Promise<EditorSettings> {
  const result = { ...base };
  const entries = await Promise.all(
    GLOBAL_ONLY_SETTING_KEYS.map(async (key) => ({
      key,
      value: await get_setting(key),
    })),
  );
  for (const { key, value } of entries) {
    if (typeof value === typeof base[key]) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
