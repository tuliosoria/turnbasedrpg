import { describe, expect, it } from "vitest";
import {
  describeFacts, quoteIsGrounded, selectFactsForLetter, selectFactsForTurn, type WorldFact,
} from "./worldFacts.js";

function fato(over: Partial<WorldFact> = {}): WorldFact {
  return {
    id: over.id ?? "f1", campaignId: "c", turnNumber: 6, kind: "MILITAR",
    parties: ["casa-khazdrun"], visibility: "PUBLICO", summary: "Khazdrun enviou cem homens à Marcha do Norte.",
    quote: "Khazdrun mandou cem. Cem homens e um comboio de suprimentos.",
    status: "ATIVO", supersededBy: null, createdAt: "2026-08-29T00:00:00Z", ...over,
  };
}

describe("a citação prova que o fato veio do texto", () => {
  const fonte = "Khazdrun mandou cem.\n\nCem homens e um comboio de suprimentos, sob o martelo de Khar-Durak.";

  it("aceita a citação que existe na fonte", () => {
    expect(quoteIsGrounded("Cem homens e um comboio de suprimentos", fonte)).toBe(true);
  });

  // O modelo reescreve quebra de linha e acento sem querer, e reprovar por isso
  // descartaria fato bom.
  it("perdoa espaço em branco e acentuação", () => {
    expect(quoteIsGrounded("Cem  homens e um  comboio de suprimentos,  sob o martelo", fonte)).toBe(true);
    expect(quoteIsGrounded("sob o martelo de Khar-Durak", "sob o martelo de Khar-Durák")).toBe(true);
  });

  // O ponto inteiro do campo: um número inventado não pode passar.
  it("recusa a citação que a fonte não contém", () => {
    expect(quoteIsGrounded("Khazdrun mandou mil homens e trinta navios", fonte)).toBe(false);
  });

  it("recusa citação curta demais para provar coisa alguma", () => {
    expect(quoteIsGrounded("a Coroa", "a Coroa decretou o tributo sobre as Casas")).toBe(false);
  });
});

describe("o segredo de uma Casa nunca vira contexto de carta", () => {
  // O caso real: a investigação sigilosa de Khazdrun descobriu moedas da Casa
  // do Ouro pagando agitadores. Isso sai do resultado PRIVADO de Khazdrun. Se
  // entrasse numa carta, um NPC da Casa do Ouro saberia o que o jogador de
  // Khazdrun pagou para descobrir.
  const segredo = fato({
    id: "segredo", visibility: "casa-khazdrun", kind: "DIVIDA",
    parties: ["casa-khazdrun", "casa-do-ouro"],
    summary: "Moedas da Casa do Ouro pagaram agitadores no Conselho de Pedra.",
  });

  it("mantém o fato privado fora de qualquer carta", () => {
    expect(selectFactsForLetter([segredo], { seats: ["casa-khazdrun", "casa-do-ouro"] })).toEqual([]);
  });

  it("mas entrega ao Mestre, que escreve o turno e já sabe de tudo", () => {
    expect(selectFactsForTurn([segredo]).map((f) => f.id)).toEqual(["segredo"]);
  });
});

describe("quais fatos chegam a uma carta", () => {
  const reino = fato({ id: "reino", parties: [], kind: "DECRETO", summary: "Tributo agravado sobre seis Casas.", turnNumber: 7 });
  const anoes = fato({ id: "anoes", parties: ["casa-khazdrun"] });
  const outros = fato({ id: "outros", parties: ["casa-vargen", "casa-auremont"], turnNumber: 5 });

  it("leva o fato do reino para qualquer conversa", () => {
    const r = selectFactsForLetter([reino, outros], { seats: ["casa-solarion", "casa-karasoy"] });
    expect(r.map((f) => f.id)).toEqual(["reino"]);
  });

  it("leva o fato que toca qualquer um dos dois lados", () => {
    const r = selectFactsForLetter([anoes, outros], { seats: ["casa-khazdrun", "casa-solarion"] });
    expect(r.map((f) => f.id)).toEqual(["anoes"]);
  });

  it("não vaza fato de terceiros para uma conversa que não os envolve", () => {
    const r = selectFactsForLetter([outros], { seats: ["casa-solarion", "casa-karasoy"] });
    expect(r).toEqual([]);
  });

  it("nunca leva fato revogado", () => {
    const morto = fato({ id: "morto", parties: [], status: "REVOGADO" });
    expect(selectFactsForLetter([morto], { seats: ["casa-solarion"] })).toEqual([]);
    expect(selectFactsForTurn([morto])).toEqual([]);
  });

  it("corta pelo teto, ficando com o mais recente", () => {
    const muitos = [1, 2, 3, 4].map((t) => fato({ id: `t${t}`, parties: [], turnNumber: t }));
    const r = selectFactsForLetter(muitos, { seats: [], limit: 2 });
    expect(r.map((f) => f.id)).toEqual(["t4", "t3"]);
  });
});

describe("o bloco de prompt", () => {
  const nome = (k: string) => (k === "casa-khazdrun" ? "Casa Khazdrun" : k);

  it("nomeia as Casas e o turno de cada fato", () => {
    const out = describeFacts([fato()], nome)!;
    expect(out).toContain("[Turno 6] Casa Khazdrun: Khazdrun enviou cem homens");
  });

  it("chama de reino o fato que não tem partes", () => {
    expect(describeFacts([fato({ parties: [] })], nome)).toContain("o reino:");
  });

  // Um cabeçalho sem fato debaixo ensina o modelo a ignorar a seção.
  it("não devolve cabeçalho sozinho quando não há fato", () => {
    expect(describeFacts([], nome)).toBeNull();
  });
});
