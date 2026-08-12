import { describe, it, expect } from "vitest";
import { newVisualEntity, type WikiEntry } from "@ravenloft/content";
import { buildCanonicalCanon } from "./canon";

function entry(title: string, body: string, section = "casas"): WikiEntry {
  return { entryId: title, section, title, body, order: 0, updatedAt: "" };
}

const wiki: WikiEntry[] = [
  entry(
    "Casa Rimerberg — Os Vigias da Última Neve",
    `> **Lema:** "Enquanto houver luz, há aviso."
> **Símbolo:** uma torre negra sob três flocos.
> **Sede:** Rimewatch.

Rimerberg foi fundada para manter Rimewatch.`,
  ),
  entry(
    "Casa Vargen — Os Lobos da Fronteira",
    `> **Símbolo:** um lobo cinzento diante de uma fogueira branca.
> **Sede:** Droskar.`,
  ),
  entry(
    "Rimewatch — A Última Vigília",
    "Rimewatch é a última grande fortaleza antes das geleiras. Possui muralhas, quartéis e o Farol de Gelo.",
    "cidades",
  ),
];

describe("buildCanonicalCanon", () => {
  it("injects canon the author never typed, from a short request", async () => {
    const canon = await buildCanonicalCanon(null, "desenhe uma muralha de Rimewatch", wiki);
    expect(canon).toMatch(/Farol de Gelo/);
    expect(canon).toMatch(/geleiras/);
  });

  it("injects the correct house emblem and not a neighbouring house's", async () => {
    // Rimerberg is a black tower under three snowflakes; the grey wolf is
    // Vargen's. Confusing them would put the wrong emblem into canon.
    const canon = await buildCanonicalCanon(null, "o estandarte da Casa Rimerberg", wiki);
    expect(canon).toMatch(/torre negra sob três flocos/);
    expect(canon).not.toMatch(/lobo/i);
  });

  it("finds the entity's article via its name even when the request omits it", async () => {
    const entity = newVisualEntity({
      id: "rw", campaignId: "winter-dead", entityType: "CITY",
      canonicalName: "Rimewatch", slug: "rimewatch",
    });
    const canon = await buildCanonicalCanon(entity, "vista ao amanhecer", wiki);
    expect(canon).toMatch(/Farol de Gelo/);
  });

  it("puts the entity's own canon sheet before the wiki article", async () => {
    const entity = newVisualEntity({
      id: "rw", campaignId: "winter-dead", entityType: "CITY",
      canonicalName: "Rimewatch", slug: "rimewatch",
      publicDescription: "A fortaleza está parcialmente em ruínas.",
    });
    const canon = await buildCanonicalCanon(entity, "Rimewatch", wiki);
    expect(canon.indexOf("parcialmente em ruínas")).toBeLessThan(canon.indexOf("Farol de Gelo"));
  });

  it("returns empty rather than echoing the request back as canon", async () => {
    // The old behaviour returned requestText, which presented the author's own
    // words to the model as though they were established canon.
    const canon = await buildCanonicalCanon(null, "um pônei feliz num campo", wiki);
    expect(canon).toBe("");
  });

  it("still works with no wiki available", async () => {
    const entity = newVisualEntity({
      id: "x", campaignId: "winter-dead", entityType: "CITY",
      canonicalName: "X", slug: "x", publicDescription: "Uma cidade.",
    });
    expect(await buildCanonicalCanon(entity, "algo", [])).toBe("Uma cidade.");
  });
});
