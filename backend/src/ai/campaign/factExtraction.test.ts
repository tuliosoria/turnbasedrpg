import { describe, expect, it } from "vitest";
import { buildFactExtractionUser, parseFacts, turnBlocks } from "./factExtraction";

const FONTE = `Khazdrun mandou cem.

Cem homens e um comboio de suprimentos, sob o martelo de Khar-Durak, de uma Casa que sustenta três mil. O oficial de registro contou duas vezes.

Alic decretou o aumento dos tributos cobrados das Casas que não contribuíram com tropas.`;

const ctx = { bloco: { visibility: "PUBLICO", rotulo: "r", texto: FONTE }, turnNumber: 6, campaignId: "c", now: "2026-08-29T00:00:00Z", id: () => "id1" };

const json = (fatos: unknown) => JSON.stringify({ fatos });

describe("a citação decide se o fato existe", () => {
  it("aceita o fato cuja citação está no texto", () => {
    const r = parseFacts(json([{ kind: "MILITAR", partes: ["casa-khazdrun"], resumo: "Khazdrun enviou cem homens.", citacao: "Cem homens e um comboio de suprimentos" }]), ctx);
    expect(r.facts).toHaveLength(1);
    expect(r.facts[0].summary).toBe("Khazdrun enviou cem homens.");
  });

  // O ponto inteiro do desenho: sem aprovação humana, é aqui que a invenção morre.
  it("descarta o fato com número que a fonte não tem", () => {
    const r = parseFacts(json([{ kind: "MILITAR", partes: ["casa-khazdrun"], resumo: "Khazdrun enviou mil homens.", citacao: "Mil homens e trinta navios subiram a estrada" }]), ctx);
    expect(r.facts).toEqual([]);
    expect(r.descartados).toBe(1);
  });

  it("descarta o fato sem citação nenhuma", () => {
    const r = parseFacts(json([{ kind: "DECRETO", partes: [], resumo: "A Coroa taxou todo mundo." }]), ctx);
    expect(r.facts).toEqual([]);
  });

  it("descarta tipo que não existe", () => {
    const r = parseFacts(json([{ kind: "FOFOCA", partes: [], resumo: "x", citacao: "Alic decretou o aumento dos tributos" }]), ctx);
    expect(r.facts).toEqual([]);
  });
});

describe("as partes", () => {
  it("guarda vazio para o fato do reino", () => {
    const r = parseFacts(json([{ kind: "DECRETO", partes: [], resumo: "Tributo agravado.", citacao: "Alic decretou o aumento dos tributos cobrados das Casas" }]), ctx);
    expect(r.facts[0].parties).toEqual([]);
  });

  // Uma chave inventada entregaria o fato a ninguém; some a parte, o fato fica.
  it("joga fora chave de Casa que não existe, mantendo o fato", () => {
    const r = parseFacts(json([{ kind: "MILITAR", partes: ["casa-inventada", "casa-khazdrun"], resumo: "x", citacao: "Cem homens e um comboio de suprimentos" }]), ctx);
    expect(r.facts[0].parties).toEqual(["casa-khazdrun"]);
  });

  it("não repete a mesma Casa duas vezes", () => {
    const r = parseFacts(json([{ kind: "MILITAR", partes: ["casa-khazdrun", "casa-khazdrun"], resumo: "x", citacao: "Cem homens e um comboio de suprimentos" }]), ctx);
    expect(r.facts[0].parties).toEqual(["casa-khazdrun"]);
  });
});

describe("respostas que não são JSON", () => {
  it("resposta vazia não vira fato nem quebra", () => {
    expect(parseFacts("", ctx).facts).toEqual([]);
  });

  it("aceita JSON embrulhado em cerca de markdown", () => {
    const r = parseFacts("```json\n" + json([{ kind: "MILITAR", partes: [], resumo: "x", citacao: "Cem homens e um comboio de suprimentos" }]) + "\n```", ctx);
    expect(r.facts).toHaveLength(1);
  });
});

describe("o turno fatiado por audiência", () => {
  const input = {
    turnNumber: 6, publicEvent: "Vinte mil marcham.", publicResult: "Khazdrun mandou cem.",
    houseResults: { "khazdrun-wxey": "A montanha não rachou.", "vazio-1": "" },
    seatOfHouseId: (h: string) => (h === "khazdrun-wxey" ? "casa-khazdrun" : null),
  };

  // Uma chamada por bloco, e não uma pelo turno inteiro: com o turno todo o
  // modelo estourou o orçamento em raciocínio e devolveu nada, duas vezes.
  it("separa o público do que cada Casa viveu por dentro", () => {
    const b = turnBlocks(input);
    expect(b).toHaveLength(2);
    expect(b[0].visibility).toBe("PUBLICO");
    expect(b[0].texto).toContain("Vinte mil marcham.");
    expect(b[0].texto).toContain("Khazdrun mandou cem.");
    expect(b[1].visibility).toBe("casa-khazdrun");
    expect(b[1].texto).toContain("A montanha não rachou.");
  });

  it("ignora bloco vazio e Casa sem sede conhecida", () => {
    expect(turnBlocks(input).map((b) => b.visibility)).not.toContain("vazio-1");
  });

  it("o texto que vai ao modelo diz de quem é o bloco", () => {
    const u = buildFactExtractionUser(6, turnBlocks(input)[1]);
    expect(u).toContain("que só ela sabe");
    expect(u).toContain("A montanha não rachou.");
    // O bloco privado NÃO leva o texto público junto: menos entrada, menos
    // raciocínio, e nenhuma chance de confundir a audiência.
    expect(u).not.toContain("Vinte mil marcham.");
  });
});

describe("quem pode saber de cada fato", () => {
  const bloco = { visibility: "casa-khazdrun", rotulo: "r", texto: "O ourives do Patriarca examinou as moedas e disse que saíram de uma bolsa só, cheia." };
  const c = { bloco, turnNumber: 6, campaignId: "c", now: "t", id: () => "i" };

  // O caso real: a investigação de Khazdrun não pode virar contexto de carta.
  it("herda a visibilidade do bloco que gerou a chamada", () => {
    const r = parseFacts(json([{ kind: "DIVIDA", partes: ["casa-khazdrun", "casa-do-ouro"], resumo: "Moedas pagaram agitadores.", citacao: "saíram de uma bolsa só, cheia" }]), c);
    expect(r.facts[0].visibility).toBe("casa-khazdrun");
  });

  it("descarta citação que não está no bloco desta chamada", () => {
    const r = parseFacts(json([{ kind: "MILITAR", partes: [], resumo: "x", citacao: "Mil homens desceram do céu numa quinta-feira" }]), c);
    expect(r.facts).toEqual([]);
    expect(r.descartados).toBe(1);
  });
});
