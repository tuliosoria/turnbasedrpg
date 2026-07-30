import { describe, it, expect, vi } from "vitest";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { listWikiEntries, putWikiEntry, deleteWikiEntry, generateWikiId, seedDefaultWiki } from "./wiki";
import { DEFAULT_WIKI_ENTRIES, WIKI_SECTION_IDS, type WikiEntry } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

const entry: WikiEntry = {
  entryId: "abc123",
  section: "casas",
  title: "Casa Vargen",
  body: "Os lobos do norte.",
  order: 0,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("wiki db", () => {
  it("lists and sorts entries by section order then entry order", async () => {
    const doc = docReturning({
      Items: [
        { entryId: "b", section: "cidades", title: "Harrow", body: "", order: 1, updatedAt: "" },
        { entryId: "a", section: "casas", title: "Segundo", body: "", order: 2, updatedAt: "" },
        { entryId: "c", section: "casas", title: "Primeiro", body: "", order: 1, updatedAt: "" },
      ],
    });
    const entries = await listWikiEntries(doc as never, TABLE, CAMPAIGN);
    expect(entries.map((e) => e.entryId)).toEqual(["c", "a", "b"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("WIKI#");
  });

  it("supports encyclopedia sections and preserves entry images", async () => {
    expect(WIKI_SECTION_IDS).toContain("geografia");
    expect(WIKI_SECTION_IDS).toContain("censo");
    expect(WIKI_SECTION_IDS).toContain("governo");
    expect(WIKI_SECTION_IDS).toContain("tributos");

    const doc = docReturning({
      Items: [
        { entryId: "atlas", section: "geografia", title: "Atlas de Valdren", body: "Mapa.", order: 0, updatedAt: "", imageUrl: "/valdren-map.png" },
        { entryId: "euralune", section: "casas", title: "Casa Euralune", body: "Casa alada.", order: 1, updatedAt: "", imageUrls: ["/houses/euralune.jpg", "/houses/euralune-2.jpg"] },
      ],
    });

    const entries = await listWikiEntries(doc as never, TABLE, CAMPAIGN);
    expect(entries[0]).toMatchObject({ imageUrl: "/valdren-map.png" });
    expect(entries[1]).toMatchObject({
      imageUrl: "/houses/euralune.jpg",
      imageUrls: ["/houses/euralune.jpg", "/houses/euralune-2.jpg"],
    });
  });

  it("puts an entry under a WIKI# sort key", async () => {
    const doc = docReturning({});
    await putWikiEntry(doc as never, TABLE, CAMPAIGN, entry);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe("WIKI#abc123");
    expect(cmd.input.Item.title).toBe("Casa Vargen");
  });

  it("deletes an entry by id", async () => {
    const doc = docReturning({});
    await deleteWikiEntry(doc as never, TABLE, CAMPAIGN, "abc123");
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteCommand);
    expect(cmd.input.Key.SK).toBe("WIKI#abc123");
  });

  it("generates a 10-char id", () => {
    expect(generateWikiId()).toMatch(/^[a-z0-9]{10}$/);
  });

  it("includes the player house backgrounds in public lore without private mechanics", () => {
    const playerHouseTitles = [
      "Casa do Ouro — Os Sete Cofres",
      "Casa Khazdrun — A Montanha e a Maré",
      "Casa Solarion — Os Olhos do Meio-Dia",
    ];
    const entries = DEFAULT_WIKI_ENTRIES.filter((e) => playerHouseTitles.includes(e.title));

    expect(entries.map((e) => e.title)).toEqual(playerHouseTitles);
    for (const entry of entries) {
      expect(entry.section).toBe("casas");
      expect(entry.body.length).toBeGreaterThan(500);
      expect(entry.body).not.toMatch(/fraqueza|perfil de poder|\|\s*Riqueza\s*\|/i);
    }
    expect(entries.find((e) => e.title === "Casa do Ouro — Os Sete Cofres")?.body.length).toBeGreaterThan(900);
  });

  it("ships the canonical public Valdren encyclopedia", () => {
    const titles = DEFAULT_WIKI_ENTRIES.map((entry) => entry.title);
    expect(titles).toContain("Valdren, o reino-ilha");
    expect(titles).toContain("Atlas de Valdren");
    expect(titles).toContain("Asterhall — A Cidade da Coroa");
    expect(titles).toContain("Casa Khazdrun — A Montanha e a Maré");
    expect(titles).toContain("A ameaça do Norte");
    expect(titles).toContain("Censo Canônico de Valdren");
    const census = DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Censo Canônico de Valdren");
    expect(census).toMatchObject({ section: "censo", order: 0 });
    expect(census?.body).toContain("aproximadamente **2.000.000 de habitantes**");
    expect(census?.body).toContain("| Casa Valerius | 395.000 | 19,75% | Asterhall |");
    expect(census?.body).toContain("Valdren consegue manter aproximadamente **28.000 a 35.000 soldados");
    expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Atlas de Valdren")?.imageUrl).toBe("/valdren-map.png");
    expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Clã Mandíbula de Osso — O Povo que Quebrou as Correntes")?.imageUrls).toEqual(["/houses/mandibula.jpg"]);
    expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Casa Karasoy — As Filhas da Estrela")?.imageUrls).toEqual(["/houses/karasoy.jpg"]);
    expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Casa Euralune — Os Senhores do Céu")?.imageUrls).toEqual(["/houses/euralune.jpg", "/houses/euralune-2.jpg"]);
    expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Grande Casa Ulgar — Os Sobreviventes de Nah'Korah")?.imageUrls).toEqual(["/houses/ulgar.jpg"]);

    const sections = new Set(DEFAULT_WIKI_ENTRIES.map((entry) => entry.section));
    for (const section of ["visao-geral", "censo", "geografia", "governo", "tributos", "casas", "crise-atual"]) {
      expect(sections.has(section)).toBe(true);
    }

    const fullText = DEFAULT_WIKI_ENTRIES.map((entry) => `${entry.title}\n${entry.body}`).join("\n");
    expect(fullText).not.toMatch(/Perfil de poder/i);
    expect(fullText).not.toMatch(/\|\s*Riqueza\s*\|\s*Recursos\s*\|\s*Soldados\s*\|\s*Controle\s*\|/i);
  });

  it("seeds the default cosmology when the wiki is empty", async () => {
    const doc = { send: vi.fn().mockResolvedValue({ Items: [] }) };
    const result = await seedDefaultWiki(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(DEFAULT_WIKI_ENTRIES.length);
    const puts = doc.send.mock.calls.map((c) => c[0]).filter((c) => c instanceof PutCommand);
    expect(puts).toHaveLength(DEFAULT_WIKI_ENTRIES.length);
    expect(puts[0]!.input.Item!.SK).toMatch(/^WIKI#/);
    const euralunePut = puts.find((cmd) => cmd.input.Item.title === "Casa Euralune — Os Senhores do Céu");
    expect(euralunePut?.input.Item.imageUrl).toBe("/houses/euralune.jpg");
    expect(euralunePut?.input.Item.imageUrls).toEqual(["/houses/euralune.jpg", "/houses/euralune-2.jpg"]);
  });

  it("does not seed when entries already exist", async () => {
    const doc = {
      send: vi.fn().mockResolvedValue({
        Items: [{ entryId: "x", section: "casas", title: "T", body: "", order: 0, updatedAt: "" }],
      }),
    };
    const result = await seedDefaultWiki(doc as never, TABLE, CAMPAIGN);
    expect(result.seeded).toBe(0);
    expect(doc.send.mock.calls.map((c) => c[0]).some((c) => c instanceof PutCommand)).toBe(false);
  });
});
