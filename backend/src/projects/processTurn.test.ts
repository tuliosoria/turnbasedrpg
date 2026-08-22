import { describe, it, expect, vi } from "vitest";
import { processProjectsForTurn } from "./processTurn";
import type { ProjectCard, House, Attributes } from "@ravenloft/content";

function house(over: Partial<House> = {}): House {
  return { houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 2 }, createdAt: "", stability: 3, ...over };
}
function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return { id: "p1", campaignId: "c", houseId: "casa-a", title: "T", description: "", publicDescription: "",
    category: "MILITARY", status: "ACTIVE", durationTurns: 1, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "", updatedAt: "", completedAt: null, ...over };
}

describe("processProjectsForTurn", () => {
  it("advances, completes with a success verdict, applies effects, and persists once", async () => {
    const projects = [project()];
    const houses: Record<string, House> = { "casa-a": house({ attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 } }) };
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async (id: string) => houses[id]),
      putProject: vi.fn(async (_p: ProjectCard) => {}),
      updateHouseAttributes: vi.fn(async (_h: string, _a: Attributes) => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
      judgeOutcome: vi.fn(async () => ({ success: true, narrative: "As tropas se juntaram à Casa." })),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    expect(deps.judgeOutcome).toHaveBeenCalledTimes(1);
    expect(deps.putProject).toHaveBeenCalledTimes(1);
    const saved = deps.putProject.mock.calls[0][0];
    expect(saved.status).toBe("COMPLETED");
    expect(saved.outcome).toBe("SUCCESS");
    expect(saved.outcomeNarrative).toContain("tropas");
    expect(saved.resolvedAt).toBeTruthy();
    expect(deps.updateHouseAttributes).toHaveBeenCalled();
    const attrs = deps.updateHouseAttributes.mock.calls[0][1];
    expect(attrs.soldados).toBe(3);
  });

  it("completes with a failure verdict: no effects, status FAILED, narrative stored", async () => {
    const projects = [project()];
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async () => house()),
      putProject: vi.fn(async (_p: ProjectCard) => {}),
      updateHouseAttributes: vi.fn(async () => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
      judgeOutcome: vi.fn(async () => ({ success: false, narrative: "O cerco interrompeu tudo." })),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    const saved = deps.putProject.mock.calls[0][0];
    expect(saved.status).toBe("FAILED");
    expect(saved.outcome).toBe("FAILURE");
    expect(saved.outcomeNarrative).toContain("cerco");
    expect(deps.updateHouseAttributes).not.toHaveBeenCalled();
    expect(deps.putFavor).not.toHaveBeenCalled();
  });

  it("falls back to success when no judgeOutcome is provided (e.g. no OpenAI)", async () => {
    const projects = [project()];
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async () => house()),
      putProject: vi.fn(async (_p: ProjectCard) => {}),
      updateHouseAttributes: vi.fn(async () => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    const saved = deps.putProject.mock.calls[0][0];
    expect(saved.status).toBe("COMPLETED");
    expect(saved.outcome).toBe("SUCCESS");
    expect(deps.updateHouseAttributes).toHaveBeenCalled();
  });

  it("is idempotent — re-running same turnId writes nothing new", async () => {
    const projects = [project({ status: "ACTIVE", turnsCompleted: 1, lastProcessedTurnId: 4, durationTurns: 2 })];
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async () => house()),
      putProject: vi.fn(async (_p: ProjectCard) => {}),
      updateHouseAttributes: vi.fn(async (_h: string, _a: Attributes) => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    expect(deps.putProject).not.toHaveBeenCalled();
  });
});

describe("conversão de teto na narrativa", () => {
  function depsBase(projects: ProjectCard[], casa: House) {
    return {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async () => casa),
      putProject: vi.fn(async (_p: ProjectCard) => {}),
      updateHouseAttributes: vi.fn(async (_h: string, _a: Attributes) => {}),
      updateHouseStabilityAndAssets: vi.fn(async (_h: string, _s: number, _a: string[]) => {}),
      putFavor: vi.fn(async () => {}),
      judgeOutcome: vi.fn(async () => ({ success: true, narrative: "O porto ficou pronto." })),
    };
  }

  it("conta ao jogador quando o ganho não coube", async () => {
    // Casa com Riqueza no teto concluindo carta que dá Riqueza: o ganho vira
    // Estabilidade, e o jogador precisa ler isso.
    const carta = project({
      title: "Expandir o Porto",
      completionEffects: { attributeChanges: [{ attribute: "riqueza", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const cheia = house({ attributes: { riqueza: 5, recursos: 3, soldados: 3, controle: 2 }, stability: 3 });
    const deps = depsBase([carta], cheia);
    await processProjectsForTurn(deps as any, "winter-dead", 7);

    const salvo = deps.putProject.mock.calls[0][0];
    expect(salvo.outcomeNarrative).toContain("Riqueza já estava no teto");
    expect(salvo.outcomeNarrative).toContain("O porto ficou pronto.");
  });

  it("não polui a narrativa quando o ganho coube inteiro", async () => {
    const deps = depsBase([project()], house());
    await processProjectsForTurn(deps as any, "winter-dead", 7);
    expect(deps.putProject.mock.calls[0][0].outcomeNarrative ?? "").not.toContain("teto");
  });

  it("não avisa de teto quando o projeto fracassou", async () => {
    const carta = project({
      completionEffects: { attributeChanges: [{ attribute: "riqueza", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const cheia = house({ attributes: { riqueza: 5, recursos: 3, soldados: 3, controle: 2 } });
    const deps = { ...depsBase([carta], cheia), judgeOutcome: vi.fn(async () => ({ success: false, narrative: "Faltou dinheiro." })) };
    await processProjectsForTurn(deps as any, "winter-dead", 7);
    expect(deps.putProject.mock.calls[0][0].outcomeNarrative).toBe("Faltou dinheiro.");
  });

  it("não aplica o ganho duas vezes se o mesmo turno for processado de novo", async () => {
    // `processProjectForTurn` já é idempotente por `lastProcessedTurnId`, mas
    // agora a conclusão mexe em ativos além de atributos, e um ativo duplicado
    // não é revertível pelo clamp.
    const carta = project({
      completionEffects: { attributeChanges: [{ attribute: "riqueza", amount: 1, permanent: true }], favors: [], assets: ["Porto Novo"], qualitativeEffects: [], unlocks: [] },
    });
    let estado: ProjectCard = carta;
    const deps = {
      ...depsBase([], house()),
      listCampaignProjects: vi.fn(async () => [estado]),
      putProject: vi.fn(async (p: ProjectCard) => { estado = p; }),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 7);
    await processProjectsForTurn(deps as any, "winter-dead", 7);

    expect(deps.updateHouseAttributes).toHaveBeenCalledTimes(1);
    expect(deps.updateHouseStabilityAndAssets.mock.calls[0][2]).toEqual(["Porto Novo"]);
  });
});
