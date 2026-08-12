import { describe, it, expect, vi } from "vitest";
import { newVisualEntity, type VisualStyleBible, type WikiEntry } from "@ravenloft/content";
import { orchestratePrompt, applyStyleGuardrail, styleGuardrail } from "./orchestrator";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE",
  artMedium: "pintura digital cinematográfica",
  renderingStyle: "dark fantasy gótico medieval",
  lightingRules: "tons frios, névoa, neve",
  colorPalette: "tons frios e sombrios",
  architectureRenderingRules: "gótica medieval",
  characterRenderingRules: "identidade facial preservada",
  prohibitedStyles: ["anime"], globalNegativeInstructions: ["sem texto"],
  referenceAssetIds: [], createdAt: "",
};

const wiki: WikiEntry[] = [
  {
    entryId: "w1", section: "casas", order: 0, updatedAt: "",
    title: "Casa Rimerberg — Os Vigias da Última Neve",
    body: "> **Símbolo:** uma torre negra sob três flocos.\n> **Sede:** Rimewatch.",
  },
  {
    entryId: "w2", section: "cidades", order: 0, updatedAt: "",
    title: "Rimewatch — A Última Vigília",
    body: "Rimewatch é a última fortaleza antes das geleiras. Possui o Farol de Gelo.",
  },
];

const chat = vi.fn(async () => "Muralha maciça de pedra escura sobre a geleira, estandartes rasgados pelo vento.");

describe("orchestratePrompt", () => {
  it("returns the exact prompt that will be sent, with canon the author never typed", async () => {
    const r = await orchestratePrompt({ requestText: "uma muralha de Rimewatch", entity: null, styleBible: bible, wikiEntries: wiki, chat });

    expect(r.compiledPrompt).toContain("Farol de Gelo");
    expect(r.compiledPrompt).toContain("torre negra sob três flocos");
    expect(r.compiledPrompt).toContain("Muralha maciça de pedra escura");
  });

  it("reports which canon entries were folded in, for display", async () => {
    const r = await orchestratePrompt({ requestText: "uma muralha de Rimewatch", entity: null, styleBible: bible, wikiEntries: wiki, chat });
    expect(r.canonSources).toContain("Rimewatch — A Última Vigília");
    expect(r.canonSources).toContain("Casa Rimerberg — Os Vigias da Última Neve");
  });

  it("warns when no canon matched, since the author gets no protection then", async () => {
    const r = await orchestratePrompt({ requestText: "um pônei num campo", entity: null, styleBible: bible, wikiEntries: wiki, chat });
    expect(r.canonSources).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/Nenhum verbete do cânone/);
  });

  it("warns when the style bible has no reference image", async () => {
    const r = await orchestratePrompt({ requestText: "Rimewatch", entity: null, styleBible: bible, wikiEntries: wiki, chat });
    expect(r.warnings.join(" ")).toMatch(/imagem de referência/);
  });

  it("warns when the selected entity has no immutable traits", async () => {
    const entity = newVisualEntity({ id: "e", campaignId: "winter-dead", entityType: "CITY", canonicalName: "Rimewatch", slug: "rimewatch" });
    const r = await orchestratePrompt({ requestText: "vista ao amanhecer", entity, styleBible: bible, wikiEntries: wiki, chat });
    expect(r.warnings.join(" ")).toMatch(/traços imutáveis/);
  });

  it("falls back to the author's words and warns when the text model fails", async () => {
    const failing = vi.fn(async () => { throw new Error("down"); });
    const r = await orchestratePrompt({ requestText: "uma muralha de Rimewatch", entity: null, styleBible: bible, wikiEntries: wiki, chat: failing });
    expect(r.enhancedBrief).toBe("");
    expect(r.compiledPrompt).toContain("uma muralha de Rimewatch");
    expect(r.warnings.join(" ")).toMatch(/descrição visual/);
  });

  it("still produces a prompt with no chat function at all", async () => {
    const r = await orchestratePrompt({ requestText: "uma muralha de Rimewatch", entity: null, styleBible: bible, wikiEntries: wiki });
    expect(r.compiledPrompt).toContain("uma muralha de Rimewatch");
  });
});

describe("style guardrail", () => {
  it("re-appends the palette rule to an edited prompt", () => {
    const edited = "CENA: uma muralha ensolarada";
    const out = applyStyleGuardrail(edited, bible);
    expect(out).toContain("tons frios e sombrios");
    expect(out).not.toMatch(/tom quente/i);
  });

  it("does not duplicate the guardrail when it is already the tail", () => {
    const once = applyStyleGuardrail("CENA: x", bible);
    const twice = applyStyleGuardrail(once, bible);
    expect(twice).toBe(once);
    expect(twice.split(styleGuardrail(bible)).length - 1).toBe(1);
  });
});
