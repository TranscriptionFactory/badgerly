import type { AssetPath, VaultId } from "$lib/shared/types/ids";
import type { EditorPort } from "$lib/features/editor/ports";

type ResolveAssetUrlForVault = (
  vault_id: VaultId,
  asset_path: AssetPath,
) => string | Promise<string>;

export function create_lazy_milkdown_editor_port(args?: {
  resolve_asset_url_for_vault?: ResolveAssetUrlForVault;
}): EditorPort {
  let port_promise: Promise<EditorPort> | null = null;

  const load_port = (): Promise<EditorPort> =>
    (port_promise ??=
      import("$lib/features/editor/adapters/milkdown_adapter").then((mod) =>
        mod.create_milkdown_editor_port(args),
      ));

  return {
    start_session: async (config) => {
      const port = await load_port();
      return port.start_session(config);
    },
  };
}
