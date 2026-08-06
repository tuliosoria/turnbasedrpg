import type { VisualEntity } from "@ravenloft/content";

export async function buildCanonicalCanon(entity: VisualEntity | null, requestText: string): Promise<string> {
  if (!entity) return requestText;
  const parts = [entity.publicDescription, entity.culturalContext, entity.scaleDescription].filter(Boolean);
  return parts.join(" ").slice(0, 1500) || requestText;
}
