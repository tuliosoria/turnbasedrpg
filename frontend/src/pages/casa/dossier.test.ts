import { describe, expect, it } from "vitest";
import { buildDossier, formatPopulation, knownHouseKeys } from "./dossier";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";
import type { WikiEntry } from "../../types/api";

const asset = (id: string, entityId: string | null): VisualAsset =>
  ({ id, entityId, storageUrl: `https://img/${id}.png`, assetType: "SCENE" }) as VisualAsset;

const entity = (id: string, canonicalName: string): VisualEntity =>
  ({ id, canonicalName }) as VisualEntity;

const article = (title: string): WikiEntry => ({ title, section: "casas", body: "" }) as WikiEntry;

const ASTERIA = [
  "Alguns passageiros conseguiram sobreviver, mas dezenas morreram era o fim do navio Asteria.",
  "Entre os mortos confirmados estão Lorde Thrain Khazdrun, senhor de Khar-Durak;",
  "Aylin Karasoy, líder da Casa Karasoy.",
].join("\n");

const input = {
  assets: [
    asset("emb", "emblem-casa-khazdrun"),
    asset("cidade", "khar-durak"),
    asset("alheia", "solarion"),
    asset("sem-entidade", null),
  ],
  entities: [
    entity("emblem-casa-khazdrun", "Brasão — Casa Khazdrun"),
    entity("khar-durak", "Khar-Durak"),
    entity("solarion", "Solarion (Sahra-Lun)"),
  ],
  wiki: [article("Casa Khazdrun — Os Senhores da Pedra"), article("Casa Solarion")],
  chronicle: ASTERIA,
};

describe("buildDossier", () => {
  it("usa o brasão da Casa e não o repete entre as imagens", () => {
    const d = buildDossier("casa-khazdrun", input)!;
    expect(d.emblemUrl).toBe("https://img/emb.png");
    expect(d.images.map((a) => a.id)).toEqual(["cidade"]);
  });

  it("traz o verbete da Casa e descarta o das outras", () => {
    const d = buildDossier("casa-khazdrun", input)!;
    expect(d.articles.map((a) => a.title)).toEqual(["Casa Khazdrun — Os Senhores da Pedra"]);
  });

  /**
   * O ponto do arquivo. O elenco é cânone do mundo e não sabe quem morreu;
   * quem morreu sai da crônica desta campanha.
   */
  it("marca como morto quem a crônica declara morto", () => {
    const d = buildDossier("casa-khazdrun", input)!;
    expect(d.figures.find((f) => f.name.includes("Thrain"))?.dead).toBe(true);
  });

  // Thrain morreu na Asteria e a ficha seguia dizendo que ele governa — foi
  // assim que uma carta saiu assinada por um morto. Quem herda aparece vivo.
  it("mostra quem herdou, e não o morto, como líder da Casa", () => {
    const d = buildDossier("casa-khazdrun", input)!;
    expect(d.leader?.leaderName).toContain("Durgan");
    expect(d.leader?.dead).toBe(false);
  });

  it("mantém vivo o resto da Casa", () => {
    const d = buildDossier("casa-khazdrun", input)!;
    const others = d.figures.filter((f) => !f.name.includes("Thrain"));
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((f) => !f.dead)).toBe(true);
  });

  it("não mata ninguém quando a crônica está vazia", () => {
    const d = buildDossier("casa-khazdrun", { ...input, chronicle: "" })!;
    expect(d.leader?.dead).toBe(false);
    expect(d.figures.every((f) => !f.dead)).toBe(true);
  });

  it("devolve null para uma chave desconhecida", () => {
    expect(buildDossier("casa-inexistente", input)).toBeNull();
  });

  // Solarion é a exceção combinada com o Mestre: a corte dela é toda de cânone
  // aprovado do jogador e vive nas entidades, não no elenco estático. As outras
  // quinze continuam obrigadas a ter gente.
  it("cobre todas as sedes com dossiê e líder", () => {
    for (const key of knownHouseKeys()) {
      const d = buildDossier(key, input)!;
      expect(d, key).not.toBeNull();
      expect(d.canon, key).not.toBeNull();
      expect(d.leader, key).not.toBeNull();
      if (key !== "casa-solarion") expect(d.figures.length, key).toBeGreaterThan(0);
    }
  });

  it("não inventa elenco para a Casa cuja corte é toda do cânone", () => {
    expect(buildDossier("casa-solarion", input)!.figures).toEqual([]);
  });
});

describe("formatPopulation", () => {
  it("formata com separador de milhar", () => {
    expect(formatPopulation(155000)).toBe("155.000 habitantes");
  });

  it("diz quando o cânone não recenseou", () => {
    expect(formatPopulation(null)).toBe("não recenseada");
  });
});
