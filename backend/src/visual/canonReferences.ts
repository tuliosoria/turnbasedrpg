import type { VisualAsset, VisualEntity, WikiEntry } from "@ravenloft/content";
import { findCanonMatches } from "../ai/visual/canonLookup";

/** Asset types that carry heraldry or a fixed visual identity worth pinning. */
const SYMBOL_TYPES = new Set(["EMBLEM", "SYMBOL", "REFERENCE_SHEET"]);

/** EMBLEM first, then SYMBOL, then REFERENCE_SHEET. Not Dynamo sort order. */
const SYMBOL_RANK = ["EMBLEM", "SYMBOL", "REFERENCE_SHEET"] as const;

function isCanonical(a: VisualAsset): boolean {
  return a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED";
}

export interface ResolveCanonReferencesInput {
  requestText: string;
  entity: VisualEntity | null;
  wikiEntries: WikiEntry[];
  entities: VisualEntity[];
  assets: VisualAsset[];
  limit?: number;
}

/**
 * Finds the emblem images belonging to the Houses a request resolves to.
 *
 * A prose description cannot pin heraldry. "Uma estrela de oito pontas sobre um
 * cavalo branco" is satisfied by countless different drawings, so every image
 * reinvents the arms — semantically right, visually inconsistent. Only the
 * emblem image itself holds it steady across generations.
 *
 * The wiki match already tells us which Houses a request is about; this walks
 * that to the visual entity linked to the same wiki entry (`wikiEntryId`) and
 * returns its canonical symbol assets.
 */
export function resolveCanonReferences(input: ResolveCanonReferencesInput): VisualAsset[] {
  const haystack = [input.requestText, input.entity?.canonicalName ?? ""].join(" ");
  const matchedEntryIds = new Set(findCanonMatches(haystack, input.wikiEntries).map((m) => m.entry.entryId));
  if (!matchedEntryIds.size) return [];

  const linked = input.entities.filter((e) => e.wikiEntryId && matchedEntryIds.has(e.wikiEntryId));
  // The entity being drawn contributes its own identity references separately;
  // including it here would spend the symbol budget on a duplicate.
  const others = linked.filter((e) => e.id !== input.entity?.id);

  const out: VisualAsset[] = [];
  for (const e of others) {
    const owned = input.assets.filter((a) => a.entityId === e.id && isCanonical(a));
    const symbols = owned.filter((a) => SYMBOL_TYPES.has(a.assetType));
    // Dynamo returns VASSET# in id order, so symbols[0] is whichever id sorts
    // first. Rank the type instead, and fall back to any canonical image so a
    // linked entity still contributes something visual.
    const pick = SYMBOL_RANK.map((type) => symbols.find((a) => a.assetType === type)).find((a) => a) ?? owned[0];
    if (pick) out.push(pick);
    if (out.length >= (input.limit ?? 2)) break;
  }
  return out;
}
