import {
  houses,
  turn001,
  campaign,
  HOUSE_IDS,
  CONTENT_VERSION,
  type HouseId,
} from "@ravenloft/content";

export function validateContent(): string[] {
  const errors: string[] = [];

  // 1. Exactly six houses, one per HouseId, non-empty text fields.
  for (const id of HOUSE_IDS) {
    const h = houses[id];
    if (!h) {
      errors.push(`Missing house: ${id}`);
      continue;
    }
    if (h.id !== id) errors.push(`House ${id} has mismatched id ${h.id}`);
    for (const field of [
      "name", "subtitle", "motto", "leaderName",
      "publicIntroduction", "strength", "weakness", "publicInterest",
      "privateIntroduction", "privateObjective", "privateConcern",
    ] as const) {
      if (!h[field] || h[field].trim() === "") {
        errors.push(`House ${id} has empty field: ${field}`);
      }
    }
  }

  // 2. Turn 1 has exactly 18 cards (3 per house).
  if (turn001.cards.length !== 18) {
    errors.push(`Turn 1 expected 18 cards, found ${turn001.cards.length}`);
  }

  // 3. Card ids are unique.
  const ids = new Set<string>();
  for (const c of turn001.cards) {
    if (ids.has(c.id)) errors.push(`Duplicate card id: ${c.id}`);
    ids.add(c.id);
    if (c.categories.length === 0) errors.push(`Card ${c.id} has no categories`);
    if (!c.description.trim()) errors.push(`Card ${c.id} has empty description`);
    if (!c.contribution.trim()) errors.push(`Card ${c.id} has empty contribution`);
    if (c.adminTags.length === 0) errors.push(`Card ${c.id} has no adminTags`);
  }

  // 4. Each house has exactly 3 cards, and its cardIds resolve to real cards owned by that house.
  for (const id of HOUSE_IDS) {
    const content = turn001.houseContent[id];
    if (!content) {
      errors.push(`Turn 1 missing houseContent for ${id}`);
      continue;
    }
    if (!content.privateInformation.trim()) {
      errors.push(`Turn 1 house ${id} has empty privateInformation`);
    }
    if (content.cardIds.length !== 3) {
      errors.push(`Turn 1 house ${id} must have 3 cardIds`);
    }
    for (const cardId of content.cardIds) {
      const card = turn001.cards.find((c) => c.id === cardId);
      if (!card) {
        errors.push(`Turn 1 house ${id} references missing card ${cardId}`);
      } else if (card.houseId !== id) {
        errors.push(`Card ${cardId} belongs to ${card.houseId}, referenced by ${id}`);
      }
    }
  }

  // 5. Every card is referenced by exactly one house's cardIds.
  const referenced = new Set<string>(
    HOUSE_IDS.flatMap((id: HouseId) => turn001.houseContent[id]?.cardIds ?? []),
  );
  for (const c of turn001.cards) {
    if (!referenced.has(c.id)) errors.push(`Card ${c.id} is not referenced by any house`);
  }

  // 6. Admin notes present.
  if (!turn001.adminResolutionNotes.trim()) {
    errors.push("Turn 1 adminResolutionNotes is empty");
  }

  // 7. Unpublished turn (Phase 1 authoring state).
  if (turn001.publishedResult !== undefined) {
    errors.push("Turn 1 publishedResult should be undefined at authoring time");
  }

  // 8. Campaign points at an existing active turn and version is set.
  if (campaign.activeTurnId !== turn001.id) {
    errors.push("campaign.activeTurnId does not match turn 1");
  }
  if (!CONTENT_VERSION.trim()) errors.push("CONTENT_VERSION is empty");

  return errors;
}

// CLI entry: `tsx scripts/validate-content.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateContent();
  if (errors.length > 0) {
    console.error("Content validation FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("Content validation passed.");
}
