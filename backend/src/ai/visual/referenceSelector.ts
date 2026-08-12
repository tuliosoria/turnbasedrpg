import type { VisualAsset, ReferenceRole } from "@ravenloft/content";

export interface SelectedReference {
  asset: VisualAsset;
  role: ReferenceRole;
}

export interface SelectReferencesInput {
  styleAsset: VisualAsset | null;
  entityAssets: VisualAsset[];
  /** Heraldry of the Houses the request resolves to. Prose cannot pin arms. */
  symbolAssets?: VisualAsset[];
  continuityAsset: VisualAsset | null;
  /** Total cap. Past a handful, references dilute each other. */
  limit?: number;
}

export const DEFAULT_REFERENCE_LIMIT = 6;

/**
 * Order is priority, because the limit truncates from the end: the global style
 * first, then the identity of the subject being drawn, then the heraldry of any
 * House the canon resolved, then continuity. The subject's own face must never
 * be dropped in favour of a banner.
 */
export function selectReferences(input: SelectReferencesInput): SelectedReference[] {
  const limit = input.limit ?? DEFAULT_REFERENCE_LIMIT;
  const out: SelectedReference[] = [];
  const seen = new Set<string>();

  const add = (asset: VisualAsset | null | undefined, role: ReferenceRole) => {
    if (!asset || seen.has(asset.id) || out.length >= limit) return;
    seen.add(asset.id);
    out.push({ asset, role });
  };

  add(input.styleAsset, "STYLE");
  for (const a of input.entityAssets.slice(0, 2)) add(a, "IDENTITY");
  for (const a of input.symbolAssets ?? []) add(a, "SYMBOL");
  add(input.continuityAsset, "CONTINUITY");
  return out;
}
