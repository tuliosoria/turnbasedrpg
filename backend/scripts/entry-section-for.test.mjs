import { describe, expect, it } from "vitest";
import {
  entrySectionFor,
  filterPublicLines,
  parseMarkdownEntries,
} from "../../scripts/generate-valdren-wiki.mjs";

const COSMOLOGIA = "Cosmologia pública e magia";

describe("entrySectionFor", () => {
  it("matches keyword overrides on the entry title and otherwise inherits the parent", () => {
    const cases = [
      [COSMOLOGIA, "Carne, Eco e Silêncio", "cosmologia"],
      [COSMOLOGIA, "Antigos Nomes e tradições regionais", "cosmologia"],
      [COSMOLOGIA, "A Igreja e a Ordem do Sino", "religioes"],
      [COSMOLOGIA, "Magia em Valdren", "magia"],
      [COSMOLOGIA, "As Brumas", "brumas"],
      [COSMOLOGIA, "Por que os mortos recebem nomes", "crise-atual"],
      ["Os quatro Colossos mortos", "Origem", "visao-geral"],
      ["Relato de cadáveres na estrada", "O que se viu", "visao-geral"],
      ["A ameaça do Norte", "Rumores", "crise-atual"],
      ["Geografia do reino", "Costa das Brumas", "geografia"],
      ["As Casas e facções de Valdren", "Ordem dos Três — A Casa do Trino Arcano", "magia"],
    ];

    for (const [topTitle, title, section] of cases) {
      expect(entrySectionFor(topTitle, title), `${topTitle} / ${title}`).toBe(section);
    }
  });
});

describe("public wiki filters", () => {
  it("drops inspiration lines and the glossary heading", () => {
    const body = filterPublicLines([
      "> **Lema:** O reino acima da Casa.",
      "> **Inspiração:** corte bizantina, monarquias feudais tardias.",
      "> **Símbolo:** uma coroa.",
      "",
      "### Glossário e uso no site",
      "- `/valdren/coroa`",
      "",
      "### Origem",
      "Texto que permanece.",
      "",
      "### Perfil de poder",
      "| Riqueza | Recursos |",
    ]);

    expect(body).not.toMatch(/Inspiração/);
    expect(body).not.toMatch(/\/valdren\/coroa/);
    expect(body).not.toMatch(/Perfil de poder/);
    expect(body).toContain("**Lema:**");
    expect(body).toContain("**Símbolo:**");
    expect(body).toContain("### Origem");
  });

  it("does not publish a glossary entry from a top-level heading", () => {
    const entries = parseMarkdownEntries(`# 13. Glossário e uso no site

Rotas mortas como /valdren/coroa. ${"x".repeat(80)}

# 1. Descrição geral de Valdren

## 1.1 Um reino cercado

${"y".repeat(80)}
`);

    expect(entries.map((entry) => entry.title)).toEqual(["Valdren, o reino-ilha"]);
    expect(entries.map((entry) => entry.section)).toEqual(["visao-geral"]);
    expect(entries.some((entry) => entry.body.includes("/valdren/coroa"))).toBe(false);
  });
});
