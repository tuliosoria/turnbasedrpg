import type { VisualAsset, ReferenceRole } from "@ravenloft/content";

export interface SelectedReference {
  asset: VisualAsset;
  role: ReferenceRole;
}

export interface SelectReferencesInput {
  styleAsset: VisualAsset | null;
  entityAssets: VisualAsset[];
  continuityAsset: VisualAsset | null;
}

export function selectReferences(input: SelectReferencesInput): SelectedReference[] {
  const out: SelectedReference[] = [];
  if (input.styleAsset) out.push({ asset: input.styleAsset, role: "STYLE" });
  for (const a of input.entityAssets.slice(0, 2)) out.push({ asset: a, role: "IDENTITY" });
  if (input.continuityAsset) out.push({ asset: input.continuityAsset, role: "CONTINUITY" });
  return out;
}
