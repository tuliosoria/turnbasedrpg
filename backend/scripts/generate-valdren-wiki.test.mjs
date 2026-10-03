import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseCensusEntry,
  parseExpeditionEntry,
  parseMagesEntry,
  parseMarkdownEntries,
  parseWarsEntry,
  wikiSources,
} from "../../scripts/generate-valdren-wiki.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function assertInRepo(absPath) {
  const rel = relative(repoRoot, absPath);
  expect(rel).not.toMatch(/^\.\./);
  expect(absPath).not.toMatch(/Downloads|Desktop|\/Users\//);
}

describe("generate-valdren-wiki sources", () => {
  it("reads PUBLICO canon from the repo, not Downloads", () => {
    for (const path of Object.values(wikiSources)) {
      assertInRepo(path);
    }

    expect(wikiSources.encyclopedia).toContain("valdren-context/PUBLICO/01_ENCICLOPEDIA_PUBLICA_CANONICA.md");
    expect(wikiSources.atlas).toContain("valdren-context/PUBLICO/02_ATLAS_GEOGRAFICO_CANONICO.md");
    expect(wikiSources.census).toContain("valdren-context/PUBLICO/04_POPULACAO_DEMOGRAFIA_E_CAPACIDADE_MILITAR.md");
    expect(wikiSources.wars).toContain("valdren-context/PUBLICO/11_HISTORIA_PUBLICA_E_CRONOLOGIA.md");
    expect(wikiSources.mages).toContain("valdren-context/PUBLICO/06_ORDEM_DOS_TRES_E_OS_27_MAGOS.md");
    expect(wikiSources.expedition).toContain("valdren-context/PUBLICO/08_A_EXPEDICAO_ALEM_DAS_BRUMAS.md");

    for (const key of ["encyclopedia", "atlas", "census", "wars", "mages", "expedition"]) {
      expect(existsSync(wikiSources[key]), wikiSources[key]).toBe(true);
    }
  });

  it("parses wars from in-repo markdown instead of a PDF", () => {
    const entry = parseWarsEntry(readFileSync(wikiSources.wars, "utf8"));
    expect(entry).toMatchObject({ section: "guerras", title: "As Guerras de Valdren" });
    expect(entry.body).toContain("Guerra das Cinco Bandeiras");
    expect(entry.body).toContain("Inverno das Cinzas");
    expect(entry.body).toContain("Guerra dos Céus de Bronze");
    expect(entry.body).toContain("Guerra do Primeiro Refúgio");
  });

  it("parses encyclopedia, census, mages, and expedition from in-repo markdown", () => {
    const encyclopedia = parseMarkdownEntries(readFileSync(wikiSources.encyclopedia, "utf8"));
    expect(encyclopedia.some((entry) => entry.title === "Casa Khazdrun — A Montanha e a Maré")).toBe(true);
    expect(encyclopedia.some((entry) => entry.title === "Valdren, o reino-ilha")).toBe(true);

    const census = parseCensusEntry(readFileSync(wikiSources.census, "utf8"));
    expect(census).toMatchObject({ section: "censo", title: "Censo Canônico de Valdren" });
    expect(census.body).toContain("2.000.000");

    const mages = parseMagesEntry(readFileSync(wikiSources.mages, "utf8"));
    expect(mages).toMatchObject({ section: "os-magos", title: "Os Vinte e Sete Magos da Ordem dos Três" });
    expect(mages.body).toContain("vinte e sete magos plenamente iniciados");

    const expedition = parseExpeditionEntry(readFileSync(wikiSources.expedition, "utf8"));
    expect(expedition).toMatchObject({ section: "expedicao", title: "A Expedição Além das Brumas" });
    expect(expedition.body).toContain("Dia Entre os Anos");
  });
});

describe("generate-valdren-wiki helpers", () => {
  it("preserves expedition dividers that are not in the source preamble", () => {
    const entry = parseExpeditionEntry(`# A Expedição Além das Brumas

# Visão geral

Texto público.

---

# Outra seção

Mais texto.`);

    expect(entry.body).toContain("# Visão geral");
    expect(entry.body).toContain("---");
    expect(entry.body).toContain("# Outra seção");
  });
});
