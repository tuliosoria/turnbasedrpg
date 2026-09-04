import { describe, expect, it } from "vitest";
import { processProjectsForTurn, type ProcessTurnDeps } from "./processTurn";
import type { ProjectCard, House } from "@ravenloft/content";

function carta(id: string, durationTurns: number, turnsCompleted = 0): ProjectCard {
  return {
    id, campaignId: "c", houseId: "casa-1", title: `Carta ${id}`, durationTurns, turnsCompleted,
    status: "ACTIVE", lastProcessedTurnId: null, costs: [], requirements: [], risks: [], complications: [],
    completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
  } as unknown as ProjectCard;
}

const casa: House = {
  id: "casa-1", name: "Casa 1", stability: 3,
  attributes: { riqueza: 2, recursos: 2, soldados: 2, controle: 2 },
} as unknown as House;

/** Um cenário de resolução com os projetos e a alocação que o teste quiser. */
function cenario(projetos: ProjectCard[], alocacao: Record<string, number> | null) {
  const gravados: ProjectCard[] = [];
  const deps: ProcessTurnDeps = {
    listCampaignProjects: async () => projetos,
    getHouse: async () => casa,
    putProject: async (p) => { gravados.push(p); },
    updateHouseAttributes: async () => {},
    updateHouseStabilityAndAssets: async () => {},
    putFavor: async () => {},
    getAlocacaoEnergia: async () => alocacao,
  };
  return { deps, gravados };
}

describe("processProjectsForTurn com Energia", () => {
  it("sem alocação, cada carta avança exatamente um turno — o ritmo de hoje", async () => {
    // A regra que protege a partida em andamento: espalhar os três pontos numa
    // Casa de uma carta só a faria saltar três turnos sem ninguém pedir.
    const projetos = [carta("a", 5)];
    const { deps, gravados } = cenario(projetos, null);
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(1);
  });

  it("a Energia SOMA ao passo do turno: três pontos avançam quatro", async () => {
    const projetos = [carta("a", 5)];
    const { deps, gravados } = cenario(projetos, { a: 3 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(4);
  });

  it("com um ponto em cada, as três andam dois passos", async () => {
    const projetos = [carta("a", 5), carta("b", 5), carta("c", 5)];
    const { deps, gravados } = cenario(projetos, { a: 1, b: 1, c: 1 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados.map((p) => p.turnsCompleted)).toEqual([2, 2, 2]);
  });

  // A queixa dos jogadores. Enquanto ninguém distribuía Energia, tudo andava um
  // passo pelo padrão; no instante em que alguém distribuía, toda carta fora da
  // distribuição TRAVAVA. Um Aqueduto ficou três turnos em 3/5 assim, e uma
  // Rota nunca deu um passo desde que foi criada.
  it("carta sem Energia continua andando um passo por turno", async () => {
    const projetos = [carta("a", 5), carta("b", 5)];
    const { deps, gravados } = cenario(projetos, { a: 2 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados.find((p) => p.id === "a")?.turnsCompleted).toBe(3);
    expect(gravados.find((p) => p.id === "b")?.turnsCompleted).toBe(1);
  });

  it("iniciar e concluir no mesmo turno — o exemplo do Mestre", async () => {
    // "gastar 3 de energia para recrutar mais soldados em um turno": uma carta
    // recém-iniciada tem turnsCompleted 0, e agora bastam dois pontos, porque o
    // passo do turno entra junto.
    const projetos = [carta("a", 3)];
    const { deps, gravados } = cenario(projetos, { a: 2 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados[0].turnsCompleted).toBe(3);
    expect(gravados[0].status).toBe("COMPLETED");
  });

  it("Casa sem carta ativa não quebra a resolução", async () => {
    const { deps, gravados } = cenario([], null);
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados).toEqual([]);
  });

  it("alocação para carta que não está mais ativa é ignorada", async () => {
    const cancelada = { ...carta("z", 5), status: "CANCELLED" } as ProjectCard;
    const projetos = [carta("a", 5), cancelada];
    const { deps, gravados } = cenario(projetos, { z: 3, a: 1 });
    await processProjectsForTurn(deps, "c", 1);
    expect(gravados.find((p) => p.id === "a")?.turnsCompleted).toBe(2);
    expect(gravados.find((p) => p.id === "z")).toBeUndefined();
  });
});
