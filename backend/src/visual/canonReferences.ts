import type { VisualAsset, VisualEntity, WikiEntry } from "@ravenloft/content";
import { findCanonMatches } from "../ai/visual/canonLookup";

/** Asset types that carry heraldry or a fixed visual identity worth pinning. */
const SYMBOL_TYPES = new Set(["EMBLEM", "SYMBOL", "REFERENCE_SHEET"]);

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
    // Prefer an explicit emblem; fall back to any canonical image of the House
    // so a linked entity still contributes something visual.
    const pick = symbols[0] ?? owned[0];
    if (pick) out.push(pick);
    if (out.length >= (input.limit ?? 2)) break;
  }
  return out;
}
