import type { VisualEntity, WikiEntry } from "@ravenloft/content";
import { findCanonMatches, renderCanonMatches } from "../ai/visual/canonLookup";

export const CANON_MAX_CHARS = 2500;

/**
 * Assembles the canon that constrains a generation.
 *
 * The author usually writes a short request — "desenhe uma muralha de
 * Rimewatch" — and expects the system to already know what Rimewatch looks
 * like. So the request text (plus the selected entity's name, if any) is
 * resolved against the wiki, and the matched entries' structured facts —
 * symbol, seat, territory — are injected. Those are the drawable details the
 * author should never have to retype, and the ones they are most likely to
 * misremember: Rimerberg's symbol is a black tower under three snowflakes,
 * while the grey wolf belongs to Vargen.
 *
 * The entity's own hand-authored fields come first: a canon sheet is more
 * specific than a lore article, and should win where the two overlap.
 */
export async function buildCanonicalCanon(
  entity: VisualEntity | null,
  requestText: string,
  wikiEntries: WikiEntry[] = [],
): Promise<string> {
  const parts: string[] = [];

  if (entity) {
    const own = [entity.publicDescription, entity.culturalContext, entity.scaleDescription].filter(Boolean).join(" ");
    if (own.trim()) parts.push(own.trim());
  }

  // Search on the request plus the entity name, so selecting an entity pulls
  // its article even when the request text does not name it.
  const haystack = [requestText, entity?.canonicalName ?? "", ...(entity?.aliases ?? [])].join(" ");
  const matches = findCanonMatches(haystack, wikiEntries);
  if (matches.length) parts.push(renderCanonMatches(matches));

  const combined = parts.join("\n\n").trim();
  // Falling back to the request text would just echo the author back at
  // themselves as though it were canon, so return empty instead.
  return combined.slice(0, CANON_MAX_CHARS);
}
