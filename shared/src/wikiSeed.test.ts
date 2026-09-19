import { describe, expect, it } from "vitest";
import { CAMPAIGN_GUIDE_ENTRIES, CAMPAIGN_GUIDE_SECTION } from "./lore/dnd/guide.js";
import { DEFAULT_WIKI_ENTRIES } from "./defaultWiki.js";
import { SEED_WIKI_ENTRIES } from "./wikiSeed.js";

describe("SEED_WIKI_ENTRIES", () => {
  it("includes the campaign-guide section the nav promises", () => {
    const sections = new Set(SEED_WIKI_ENTRIES.map((entry) => entry.section));
    expect(sections.has(CAMPAIGN_GUIDE_SECTION)).toBe(true);
    expect(sections.has("campanha-dnd")).toBe(true);
    expect(SEED_WIKI_ENTRIES).toHaveLength(DEFAULT_WIKI_ENTRIES.length + CAMPAIGN_GUIDE_ENTRIES.length);
    expect(SEED_WIKI_ENTRIES.filter((e) => e.section === CAMPAIGN_GUIDE_SECTION)).toHaveLength(
      CAMPAIGN_GUIDE_ENTRIES.length,
    );
  });
});
