import type { VisualAsset } from "@ravenloft/content";

/** `emblem-<sede>` vira a chave da sede. Miniatura quando existe; senão a imagem cheia. */
export function emblemUrlsByHouse(
  assets: readonly Pick<VisualAsset, "entityId" | "thumbnailUrl" | "storageUrl">[],
): Record<string, string> {
  const found: Record<string, string> = {};
  for (const asset of assets) {
    const key = asset.entityId?.startsWith("emblem-") ? asset.entityId.slice(7) : null;
    if (key) found[key] = asset.thumbnailUrl ?? asset.storageUrl;
  }
  return found;
}
