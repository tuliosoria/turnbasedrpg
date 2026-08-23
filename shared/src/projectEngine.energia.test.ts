import { describe, expect, it } from "vitest";
import { processProjectForTurn, projectSlotLimit } from "./projectEngine.js";
import { ENERGIA_POR_TURNO } from "./energia.js";
import type { ProjectCard } from "./projects.js";
import type { House } from "./types.js";

function carta(durationTurns: number, turnsCompleted = 0): ProjectCard {
  return { id: "a", durationTurns, turnsCompleted, lastProcessedTurnId: null } as ProjectCard;
}

function casa(controle: number): House {
  return { attributes: { riqueza: 1, recursos: 1, soldados: 1, controle } } as House;
}

describe("processProjectForTurn com passos", () => {
  it("sem passos, avança um turno — o comportamento de sempre", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3), 1);
    expect(project.turnsCompleted).toBe(1);
    expect(justCompleted).toBe(false);
  });

  it("com três passos, conclui uma carta de três turnos num turno só", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3), 1, 3);
    expect(project.turnsCompleted).toBe(3);
    expect(justCompleted).toBe(true);
  });

  it("com zero passos, não toca na carta", () => {
    const { project, justCompleted } = processProjectForTurn(carta(3, 1), 1, 0);
    expect(project.turnsCompleted).toBe(1);
    expect(justCompleted).toBe(false);
    expect(project.lastProcessedTurnId).toBe(null);
  });

  it("não avança duas vezes no mesmo turno", () => {
    const primeira = processProjectForTurn(carta(5), 7, 2).project;
    const segunda = processProjectForTurn(primeira, 7, 2).project;
    expect(segunda.turnsCompleted).toBe(2);
  });
});

describe("projectSlotLimit", () => {
  it("dá três cartas, para a escolha entre largura e profundidade existir", () => {
    expect(projectSlotLimit(casa(1))).toBe(3);
  });

  it("dá três também com Controle alto, para não passar do orçamento de Energia", () => {
    // Um teto de quatro exigiria Energia variável por Casa, que o Mestre
    // descartou ao dizer "cada casa, cada turno, tem 3".
    expect(projectSlotLimit(casa(4))).toBe(3);
    expect(projectSlotLimit(casa(5))).toBe(3);
  });

  it("o teto de cartas e o orçamento de Energia são o mesmo número", () => {
    // Se estes dois divergirem, distribuir passa a ser pior do que não mexer em
    // nada para a Casa que estiver no teto.
    expect(projectSlotLimit(casa(5))).toBe(ENERGIA_POR_TURNO);
  });
});
