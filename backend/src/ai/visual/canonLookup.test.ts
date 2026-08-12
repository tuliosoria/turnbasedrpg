import { describe, it, expect } from "vitest";
import type { WikiEntry } from "@ravenloft/content";
import { extractCanonFacts, findCanonMatches, renderCanonMatches, seatName, significantTokens, titleHead } from "./canonLookup";

function entry(over: Partial<WikiEntry> & { title: string; body: string }): WikiEntry {
  return { entryId: over.title, section: "casas", order: 0, updatedAt: "", ...over };
}

// Real shapes from the live wiki.
const rimerberg = entry({
  title: "Casa Rimerberg — Os Vigias da Última Neve",
  body: `> **Lema:** "Enquanto houver luz, há aviso."
> **Símbolo:** uma torre negra sob três flocos.
> **Território:** extremo norte.
> **Sede:** Rimewatch.
> **Status:** Grande Casa menor, de importância estratégica.

### Origem

Rimerberg foi fundada para manter Rimewatch.`,
});

const vargen = entry({
  title: "Casa Vargen — Os Lobos da Fronteira",
  body: `> **Lema:** "Ninguém fica para trás na neve."
> **Símbolo:** um lobo cinzento diante de uma fogueira branca.
> **Território:** Marcas do Norte.
> **Sede:** Droskar.`,
});

const rimewatch = entry({
  title: "Rimewatch — A Última Vigília",
  section: "cidades",
  body: "Rimewatch é a última grande fortaleza antes das geleiras. Possui muralhas, quartéis, cisternas aquecidas, depósitos, uma capela da Ordem do Sino e o Farol de Gelo.",
});

const all = [rimerberg, vargen, rimewatch];

describe("extractCanonFacts", () => {
  it("pulls the structured header fields", () => {
    const f = extractCanonFacts(rimerberg.body);
    expect(f.simbolo).toBe("uma torre negra sob três flocos");
    expect(f.sede).toBe("Rimewatch");
    expect(f.territorio).toBe("extremo norte");
    expect(f.lema).toContain("Enquanto houver luz");
  });

  it("returns an empty object for an entry with no header block", () => {
    expect(extractCanonFacts(rimewatch.body)).toEqual({});
  });

  it("ignores a symbol quoted later in the prose", () => {
    // Guards against attributing another house's emblem to this entry.
    const e = `> **Símbolo:** uma torre negra sob três flocos.\n\n${"filler. ".repeat(300)}\n> **Símbolo:** um lobo cinzento.`;
    expect(extractCanonFacts(e).simbolo).toBe("uma torre negra sob três flocos");
  });
});

describe("titleHead / significantTokens", () => {
  it("takes the name before the epithet", () => {
    expect(titleHead("Casa Rimerberg — Os Vigias da Última Neve")).toBe("Casa Rimerberg");
  });

  it("drops words that would match every house", () => {
    expect(significantTokens("Casa Rimerberg — Os Vigias")).toEqual(["rimerberg"]);
  });
});

describe("findCanonMatches", () => {
  it("resolves a short request to the right city entry", () => {
    const m = findCanonMatches("desenhe uma muralha de Rimewatch", all);
    expect(m.map((x) => x.entry.title)).toContain("Rimewatch — A Última Vigília");
  });

  it("does NOT attribute Vargen's wolf to a Rimewatch request", () => {
    // The user believed Rimerberg's emblem was a wolf. It is Vargen's. A system
    // that guesses would inject the wrong house's emblem into canon.
    const m = findCanonMatches("uma muralha de Rimewatch", all);
    const rendered = renderCanonMatches(m);
    expect(rendered).not.toMatch(/lobo/i);
  });

  it("finds the house when the house name is used", () => {
    const m = findCanonMatches("o estandarte da Casa Rimerberg", all);
    expect(m[0].entry.title).toBe("Casa Rimerberg — Os Vigias da Última Neve");
    expect(m[0].facts.simbolo).toBe("uma torre negra sob três flocos");
  });

  it("matches case- and accent-insensitively", () => {
    expect(findCanonMatches("A ÚLTIMA VIGÍLIA em rimewatch", all).length).toBeGreaterThan(0);
  });

  it("returns nothing when the request names no known entity", () => {
    expect(findCanonMatches("um pônei feliz num campo", all)).toEqual([]);
  });

  it("caps how many entries it injects", () => {
    expect(findCanonMatches("Rimewatch Rimerberg Vargen", all, 2)).toHaveLength(2);
  });

  it("prefers the more distinctive match first", () => {
    const m = findCanonMatches("Rimerberg", all);
    expect(m[0].entry.title).toContain("Rimerberg");
  });
});

describe("renderCanonMatches", () => {
  it("labels the symbol as something that must appear on insignia", () => {
    const rendered = renderCanonMatches(findCanonMatches("Casa Rimerberg", all));
    expect(rendered).toMatch(/Símbolo.*torre negra sob três flocos/);
  });

  it("strips the markdown blockquote markers from the prose", () => {
    expect(renderCanonMatches(findCanonMatches("Casa Rimerberg", all))).not.toMatch(/^>/m);
  });
});

describe("seat linkage", () => {
  it("pulls the owning house's emblem when the request only names its seat", () => {
    // "Rimewatch" contains no token matching "Casa Rimerberg", but Rimerberg
    // declares `Sede: Rimewatch`, which is how the heraldry gets found.
    const m = findCanonMatches("desenhe uma muralha de Rimewatch", all);
    const titles = m.map((x) => x.entry.title);
    expect(titles).toContain("Rimewatch — A Última Vigília");
    expect(titles).toContain("Casa Rimerberg — Os Vigias da Última Neve");
    expect(renderCanonMatches(m)).toMatch(/torre negra sob três flocos/);
  });

  it("still does not drag in the neighbouring house's wolf", () => {
    const rendered = renderCanonMatches(findCanonMatches("desenhe uma muralha de Rimewatch", all));
    expect(rendered).not.toMatch(/lobo/i);
  });

  it("does not add a house whose seat is unrelated", () => {
    const m = findCanonMatches("Droskar", all);
    expect(m.map((x) => x.entry.title)).toContain("Casa Vargen — Os Lobos da Fronteira");
  });
});

describe("seat linkage, House -> City", () => {
  // The failure that motivated this: "a capital de Karasoy" pulled only the
  // House article. The city article is the sole place the fortified wagons and
  // wheels are described, so with it missing the model had nothing concrete and
  // rendered a city defined by movement as tents standing on the ground.
  const karasoy = entry({
    title: "Casa Karasoy — As Filhas da Estrela",
    body: "> **Símbolo:** uma estrela de oito pontas sobre um cavalo branco.\n> **Sede:** Ordu-Yildiz, cidade móvel.",
  });
  const orduYildiz = entry({
    title: "Ordu-Yildiz — A Cidade que Cavalga",
    section: "cidades",
    body: "Ordu-Yildiz é formada por carroças fortificadas, tendas, estábulos, santuários e oficinas móveis.",
  });
  const set = [karasoy, orduYildiz, vargen];

  it("reaches the seat's own article from the House name", () => {
    const titles = findCanonMatches("criar a capital de Karasoy", set).map((m) => m.entry.title);
    expect(titles).toContain("Casa Karasoy — As Filhas da Estrela");
    expect(titles).toContain("Ordu-Yildiz — A Cidade que Cavalga");
  });

  it("carries the concrete structure into the rendered canon", () => {
    const rendered = renderCanonMatches(findCanonMatches("a capital de Karasoy", set));
    expect(rendered).toMatch(/carroças fortificadas/);
  });

  it("parses a seat written as prose with an aside", () => {
    // "Ordu-Yildiz, cidade móvel" names the city plus a description.
    expect(seatName("Ordu-Yildiz, cidade móvel")).toBe("ordu-yildiz");
    expect(seatName(undefined)).toBeNull();
  });

  it("still resolves City -> House in the other direction", () => {
    const titles = findCanonMatches("as ruas de Ordu-Yildiz", set).map((m) => m.entry.title);
    expect(titles).toContain("Casa Karasoy — As Filhas da Estrela");
  });

  it("does not drag in an unrelated House", () => {
    const rendered = renderCanonMatches(findCanonMatches("a capital de Karasoy", set));
    expect(rendered).not.toMatch(/lobo/i);
  });
});
