import { describe, it, expect } from "vitest";
import { applyCompletion } from "./projectEngine.js";
import type { House } from "./types.js";
import type { ProjectCard } from "./projects.js";

function casa(over: Partial<House> = {}): House {
  return {
    id: "casa-teste", campaignId: "winter-dead", name: "Casa de Teste",
    leaderName: "Alguém", castleName: "Algum Lugar",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
    stability: 3,
    ...over,
  } as House;
}

function projeto(attribute: string, amount: number): ProjectCard {
  return {
    id: "p1", title: "Projeto de Teste", durationTurns: 4, turnsCompleted: 4,
    costs: [],
    completionEffects: {
      attributeChanges: [{ attribute, amount, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    },
  } as unknown as ProjectCard;
}

describe("applyCompletion no teto", () => {
  it("aplica normalmente quando cabe", () => {
    const r = applyCompletion(casa(), projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(3);
    expect(r.conversoes).toEqual([]);
  });

  it("converte em Estabilidade o que não cabe no atributo", () => {
    const r = applyCompletion(casa({ attributes: { riqueza: 4, recursos: 3, soldados: 2, controle: 2 } }), projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(4); // 1 ponto sobrou e virou Estabilidade
    expect(r.conversoes).toEqual(["Riqueza já estava no teto: 1 ponto virou Estabilidade."]);
  });

  it("converte em ativo quando Estabilidade também está no teto", () => {
    const cheia = casa({ attributes: { riqueza: 5, recursos: 3, soldados: 2, controle: 2 }, stability: 5 });
    const r = applyCompletion(cheia, projeto("riqueza", 2));
    expect(r.house.attributes.riqueza).toBe(5);
    expect(r.house.stability).toBe(5);
    expect(r.assetsAdded).toEqual(["Projeto de Teste"]);
    expect(r.conversoes).toEqual(["Riqueza e Estabilidade já estavam no teto: o ganho virou o ativo 'Projeto de Teste'."]);
  });

  it("nunca devolve conclusão vazia quando a carta prometia ganho", () => {
    const cheia = casa({ attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 }, stability: 5 });
    const r = applyCompletion(cheia, projeto("soldados", 2));
    const mudouAlgo = r.assetsAdded.length > 0 || r.favorsToCreate.length > 0;
    expect(mudouAlgo).toBe(true);
  });

  it("perda de Estabilidade continua funcionando e não vira conversão", () => {
    const r = applyCompletion(casa(), projeto("stability", -1));
    expect(r.house.stability).toBe(2);
    expect(r.conversoes).toEqual([]);
  });

  it("segue ignorando efeito temporário, que é o que a auditoria já proíbe", () => {
    const p = projeto("riqueza", 2);
    p.completionEffects.attributeChanges[0].permanent = false;
    const r = applyCompletion(casa(), p);
    expect(r.house.attributes.riqueza).toBe(3);
  });

  it("não duplica o ativo que a carta já concedia", () => {
    // A carta que dá um ativo E um atributo estourado não pode acabar com o
    // ativo listado duas vezes.
    const cheia = casa({ attributes: { riqueza: 5, recursos: 3, soldados: 2, controle: 2 }, stability: 5 });
    const p = projeto("riqueza", 2);
    p.completionEffects.assets = ["Porto Novo"];
    const r = applyCompletion(cheia, p);
    expect(r.assetsAdded).toEqual(["Porto Novo", "Projeto de Teste"]);
  });

  it("preserva os ativos que a Casa já tinha", () => {
    const comAtivos = casa({ assets: ["Velho Moinho"] } as Partial<House>);
    const p = projeto("riqueza", 1);
    p.completionEffects.assets = ["Porto Novo"];
    const r = applyCompletion(comAtivos, p);
    expect(r.house.assets).toEqual(["Velho Moinho", "Porto Novo"]);
  });
});
