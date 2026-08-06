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
