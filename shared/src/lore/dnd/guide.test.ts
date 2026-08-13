import { describe, expect, it } from "vitest";
import { WIKI_SECTION_IDS, NON_CANON_WIKI_SECTIONS, isCanonWikiSection } from "../../wiki.js";
import { VALDREN_CLASSES } from "./classes.js";
import { VALDREN_PEOPLES } from "./peoples.js";
import { CAMPAIGN_GUIDE_ENTRIES, CAMPAIGN_GUIDE_SECTION, SRD_ATTRIBUTION } from "./guide.js";
import { SRD_SPECIES } from "./types.js";

describe("seção do guia", () => {
  it("existe na wiki", () => {
    expect(WIKI_SECTION_IDS).toContain(CAMPAIGN_GUIDE_SECTION);
  });

  // O motor de canon visual casa pedidos de imagem contra todo verbete. Regra
  // de mesa não pode virar canon de Valdren por acidente.
  it("é marcada como não-canônica", () => {
    expect(NON_CANON_WIKI_SECTIONS).toContain(CAMPAIGN_GUIDE_SECTION);
    expect(isCanonWikiSection(CAMPAIGN_GUIDE_SECTION)).toBe(false);
    expect(isCanonWikiSection("geografia")).toBe(true);
  });
});

describe("verbetes do guia", () => {
  it("ficam todos na seção do guia", () => {
    for (const entry of CAMPAIGN_GUIDE_ENTRIES) {
      expect(entry.section).toBe(CAMPAIGN_GUIDE_SECTION);
    }
  });

  it("têm títulos únicos", () => {
    const titles = CAMPAIGN_GUIDE_ENTRIES.map((e) => e.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("têm ordens únicas e sequenciais", () => {
    const orders = CAMPAIGN_GUIDE_ENTRIES.map((e) => e.order).sort((a, b) => a - b);
    expect(orders).toEqual(orders.map((_, i) => i));
  });

  it("nunca vêm vazios", () => {
    for (const entry of CAMPAIGN_GUIDE_ENTRIES) {
      expect(entry.body.trim().length).toBeGreaterThan(200);
    }
  });

  it("dão um verbete a cada povo", () => {
    for (const people of VALDREN_PEOPLES) {
      expect(CAMPAIGN_GUIDE_ENTRIES.some((e) => e.title.startsWith(people.name))).toBe(true);
    }
  });
});

describe("tabela de classes", () => {
  const table = CAMPAIGN_GUIDE_ENTRIES.find((e) => e.title === "Classes em Valdren");

  it("lista todas as classes", () => {
    for (const cls of VALDREN_CLASSES) {
      expect(table?.body).toContain(`| ${cls.name} |`);
    }
  });

  // A tabela é gerada da mesma fonte que ela resume, então não pode divergir.
  it("traz cada nota de classe uma vez só", () => {
    for (const cls of VALDREN_CLASSES.filter((c) => c.note)) {
      expect(table?.body).toContain(`### ${cls.name}`);
    }
  });
});

describe("povos", () => {
  it("apontam para espécies que o SRD 5.2.1 publica", () => {
    for (const people of VALDREN_PEOPLES) {
      expect(SRD_SPECIES).toContain(people.species);
    }
  });

  it("não repetem a mesma espécie", () => {
    const species = VALDREN_PEOPLES.map((p) => p.species);
    expect(new Set(species).size).toBe(species.length);
  });

  it("descrevem como as regras se leem em Valdren", () => {
    for (const people of VALDREN_PEOPLES) {
      expect(people.reinterpretation.trim().length).toBeGreaterThan(80);
      expect(people.customs.length).toBeGreaterThan(0);
    }
  });

  // Renomear é permitido; alterar efeito não é. O guia só promete o primeiro.
  it("renomeiam opções sem prometer efeito novo", () => {
    for (const people of VALDREN_PEOPLES) {
      for (const option of people.renamedOptions ?? []) {
        expect(option.srd.trim()).not.toBe("");
        expect(option.valdren.trim()).not.toBe("");
      }
    }
  });
});

describe("atribuição do SRD", () => {
  it("traz a declaração exigida, com a URL da licença", () => {
    expect(SRD_ATTRIBUTION).toContain("System Reference Document 5.2.1");
    expect(SRD_ATTRIBUTION).toContain("Wizards of the Coast LLC");
    expect(SRD_ATTRIBUTION).toContain("https://creativecommons.org/licenses/by/4.0/legalcode");
  });

  // A página legal do SRD proíbe atribuição a mais além da exigida.
  it("não acrescenta outra menção à Wizards", () => {
    expect(SRD_ATTRIBUTION).not.toMatch(/não afiliad|not affiliated|endorsed/i);
  });
});
