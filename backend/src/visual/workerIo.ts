import type { VisualAsset } from "@ravenloft/content";

/** One VASSET query per campaign id, shared by every caller in this invocation. */
export function shareAssetQuery(
  load: (campaignId: string) => Promise<VisualAsset[]>,
): (campaignId: string) => Promise<VisualAsset[]> {
  let campaignId: string | null = null;
  let pending: Promise<VisualAsset[]> | null = null;
  return (id: string) => {
    if (!pending || campaignId !== id) {
      campaignId = id;
      pending = load(id);
    }
    return pending;
  };
}

/** Long enough for an S3 image, short enough that a hung download fails the generation. */
export const REFERENCE_FETCH_TIMEOUT_MS = 20_000;

export async function fetchReferenceBuffer(
  storageUrl: string,
  timeoutMs = REFERENCE_FETCH_TIMEOUT_MS,
): Promise<Buffer> {
  const res = await fetch(storageUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Falha ao baixar referência (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
