export function badgerly_asset_url(
  vault_id: string,
  asset_path: string,
): string {
  const encoded = String(asset_path)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `badgerly-asset://vault/${vault_id}/${encoded}`;
}
