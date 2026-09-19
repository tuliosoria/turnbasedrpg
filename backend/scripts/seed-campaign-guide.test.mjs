import { describe, expect, it } from "vitest";
import { CAMPAIGN_GUIDE_ENTRIES, CAMPAIGN_GUIDE_SECTION } from "../../shared/dist/index.js";
import { planCampaignGuideSeed } from "./seed-campaign-guide.mjs";

describe("planCampaignGuideSeed", () => {
  it("creates every guide entry when the wiki has none of them", () => {
    const { planned, orphans } = planCampaignGuideSeed([]);

    expect(planned).toHaveLength(CAMPAIGN_GUIDE_ENTRIES.length);
    expect(planned.every((p) => p.action === "cria")).toBe(true);
    expect(orphans).toEqual([]);
    expect(new Set(planned.map((p) => p.def.section)).has(CAMPAIGN_GUIDE_SECTION)).toBe(true);
  });

  it("is idempotent by section and title", () => {
    const existing = CAMPAIGN_GUIDE_ENTRIES.map((def, i) => ({
      entryId: `already-${i}`,
      section: def.section,
      title: def.title,
      body: "texto antigo do Acervo",
      order: def.order,
    }));

    const first = planCampaignGuideSeed(existing);
    expect(first.planned.every((p) => p.action === "atualiza")).toBe(true);
    expect(first.planned.every((p) => p.existing?.entryId.startsWith("already-"))).toBe(true);

    const second = planCampaignGuideSeed(existing);
    expect(second.planned.map((p) => p.action)).toEqual(first.planned.map((p) => p.action));
    expect(second.orphans).toEqual([]);
  });

  it("does not delete renamed leftovers in the section", () => {
    const { planned, orphans } = planCampaignGuideSeed([
      {
        entryId: "old",
        section: CAMPAIGN_GUIDE_SECTION,
        title: "Título que saiu do guia",
        body: "sobrou",
        order: 99,
      },
    ]);

    expect(planned.every((p) => p.action === "cria")).toBe(true);
    expect(orphans.map((o) => o.title)).toEqual(["Título que saiu do guia"]);
  });
});
