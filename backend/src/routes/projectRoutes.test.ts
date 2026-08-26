import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjects, startProjectFromTemplate, cancelProject, acceptProject, enhanceCustomProject, startCustomProject } from "./projectRoutes";
import type { Deps } from "./publicRoutes";
import type { HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import * as projectsDb from "../db/projects";
import * as housesDb from "../db/houses";
import * as wikiDb from "../db/wiki";
import * as turnsDb from "../db/turns";
import * as auth from "../auth/playerAuth";
import * as openai from "../ai/openai";
import * as energiaDb from "../db/energia";
import { projectSlotLimit, type House } from "@ravenloft/content";

const house: House = {
  houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
  attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 3 }, createdAt: "", stability: 3,
};

/**
 * Enche os espaços de projeto da Casa até o teto, seja ele qual for.
 * Deriva de projectSlotLimit para o teste não precisar mudar toda vez que o
 * teto muda — foi exatamente o que quebrou quando a Energia o levou de 1 para 3.
 */
function cartasNoTeto() {
  return Array.from({ length: projectSlotLimit(house) }, () => ({ status: "ACTIVE" }) as any);
}

function deps(): Deps { return { doc: {} as any, config: { tableName: "t", campaignId: "winter-dead" } as any }; }
function depsAi(): Deps { return { doc: {} as any, config: { tableName: "t", campaignId: "winter-dead" } as any, chat: {} as any }; }
function req(body: unknown): HandlerRequest { return { method: "POST", path: "/", headers: { authorization: "Bearer x" }, body } as any; }

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(auth, "requirePlayer").mockReturnValue({ type: "player", campaignId: "winter-dead", houseId: "casa-a", displayName: "A", exp: Date.now() + 1e6 } as any);
  vi.spyOn(housesDb, "getHouse").mockResolvedValue(house);
  vi.spyOn(wikiDb, "listWikiEntries").mockResolvedValue([]);
  vi.spyOn(turnsDb, "getActiveTurn").mockResolvedValue({ turnId: 3 } as any);
  vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([]);
  vi.spyOn(projectsDb, "listFavorsForHouse").mockResolvedValue([]);
  vi.spyOn(projectsDb, "putProject").mockResolvedValue();
  vi.spyOn(housesDb, "updateHouseAttributes").mockResolvedValue();
  vi.spyOn(housesDb, "updateHouseStabilityAndAssets").mockResolvedValue();
  vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue(null);
});

describe("projectRoutes", () => {
  it("getProjects returns templates, projects, favors, slotLimit, stability", async () => {
    const res = await getProjects(deps(), req(undefined));
    expect(res.status).toBe(200);
    const body: any = res.body;
    expect(body.templates.length).toBe(65);
    expect(body.slotLimit).toBe(3);
    expect(body.stability).toBe(3);
    expect(Array.isArray(body.recommended)).toBe(true);
    expect(body.energia.total).toBe(3);
    expect(body.energia.porProjeto).toEqual({});
    expect(body.energia.distribuiu).toBe(false);
  });

  it("marca distribuiu quando a Casa ja gravou uma alocacao, mesmo vazia", async () => {
    vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue({});
    const res = await getProjects(deps(), req(undefined));
    const body: any = res.body;
    // Alocacao vazia gravada e diferente de nao ter gravado nada: a tela precisa
    // saber que as cartas vao ficar paradas, em vez de andar um turno.
    expect(body.energia.porProjeto).toEqual({});
    expect(body.energia.distribuiu).toBe(true);
  });

  it("startProjectFromTemplate charges and activates an affordable card", async () => {
    const res = await startProjectFromTemplate(deps(), req({ templateId: "criar-uma-rede-de-batedores" }));
    expect(res.status).toBe(200);
    const p: any = res.body;
    expect(p.status).toBe("ACTIVE");
    expect(housesDb.updateHouseAttributes).toHaveBeenCalled();
  });

  it("startProjectFromTemplate blocks when slot limit reached", async () => {
    vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue(cartasNoTeto());
    await expect(startProjectFromTemplate(deps(), req({ templateId: "criar-uma-rede-de-batedores" }))).rejects.toThrow(HttpError);
  });

  it("cancelProject sets CANCELLED and does not refund", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ id: "p1", houseId: "casa-a", status: "ACTIVE" } as any);
    const res = await cancelProject(deps(), req({ projectId: "p1" }));
    expect((res.body as any).status).toBe("CANCELLED");
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("cancelProject rejects another house's project", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ id: "p1", houseId: "casa-b", status: "ACTIVE" } as any);
    await expect(cancelProject(deps(), req({ projectId: "p1" }))).rejects.toThrow(HttpError);
  });

  it("acceptProject blocks activation when the slot limit is already reached", async () => {
    const pendingCard = { id: "p2", houseId: "casa-a", status: "PENDING_PLAYER", requiresGmApproval: false, requiresTargetApproval: false, costs: [] };
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(pendingCard as any);
    vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue(cartasNoTeto());
    await expect(acceptProject(deps(), req({ projectId: "p2" }))).rejects.toThrow(HttpError);
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  const aiProposal = {
    title: "Muralha da Capital", description: "Construir uma muralha ao redor da capital.",
    publicDescription: "Uma muralha se ergue.", category: "INFRASTRUCTURE", durationTurns: 4,
    costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }], requirements: [], risks: ["sabotagem"],
    complications: [], completionEffects: { attributeChanges: [], favors: [], assets: ["Muralha"], qualitativeEffects: [], unlocks: [] },
    targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: "BALANCED", aiBalanceExplanation: "ok",
  } as const;

  it("enhanceCustomProject returns a non-persisted draft preserving player text", async () => {
    vi.spyOn(openai, "generateJson").mockResolvedValue({ ...aiProposal });
    const res = await enhanceCustomProject(depsAi(), req({ title: "Muralha", body: "Quero uma muralha" }));
    expect(res.status).toBe(200);
    const d: any = res.body;
    expect(d.playerEditedRules).toBe(false);
    expect(d.playerOriginalRequest).toBe("Quero uma muralha");
    expect(d.aiBalanceStatus).toBe("BALANCED");
    expect(projectsDb.putProject).not.toHaveBeenCalled();
  });

  it("enhanceCustomProject clamps AI title and description to the limits", async () => {
    vi.spyOn(openai, "generateJson").mockResolvedValue({
      ...aiProposal,
      title: "T".repeat(200),
      description: "D".repeat(900),
    });
    const res = await enhanceCustomProject(depsAi(), req({ title: "x", body: "y" }));
    const d: any = res.body;
    expect(d.title.length).toBeLessThanOrEqual(80);
    expect(d.description.length).toBeLessThanOrEqual(500);
  });

  it("enhanceCustomProject requires AI to be configured", async () => {
    await expect(enhanceCustomProject(deps(), req({ title: "x", body: "y" }))).rejects.toThrow(HttpError);
  });

  function draft(overrides: Record<string, unknown> = {}) {
    return {
      title: "Muralha", description: "Construir muralha", publicDescription: "Muralha",
      category: "INFRASTRUCTURE", durationTurns: 4, costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }],
      requirements: [], risks: [], completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
      targetHouseId: null, playerOriginalRequest: "Quero uma muralha", playerEditedRules: false,
      aiBalanceStatus: "BALANCED", aiBalanceExplanation: "ok", ...overrides,
    };
  }

  it("startCustomProject charges and activates an unedited affordable draft", async () => {
    const res = await startCustomProject(deps(), req(draft()));
    const p: any = res.body;
    expect(p.status).toBe("ACTIVE");
    expect(p.createdBy).toBe("PLAYER");
    expect(housesDb.updateHouseAttributes).toHaveBeenCalled();
  });

  it("startCustomProject forces GM approval when rules were edited", async () => {
    const res = await startCustomProject(deps(), req(draft({ playerEditedRules: true })));
    const p: any = res.body;
    expect(p.status).toBe("PENDING_GM");
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("startCustomProject blocks when slot limit reached", async () => {
    vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue(cartasNoTeto());
    await expect(startCustomProject(deps(), req(draft()))).rejects.toThrow(HttpError);
  });
});

describe("carta que precisa de uma Casa alvo", () => {
  // Catorze dos sessenta e cinco modelos exigem alvo. Todos eram gravados com
  // targetHouseId nulo e ficavam esperando a aprovação de ninguém: a linha
  // diplomática inteira nascia travada.
  it("recusa começar sem dizer com quem", async () => {
    await expect(
      startProjectFromTemplate(deps(), req({ templateId: "enviar-um-presente-cerimonial" })),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
  });

  it("recusa uma Casa que não existe no mapa", async () => {
    await expect(
      startProjectFromTemplate(deps(), req({ templateId: "enviar-um-presente-cerimonial", targetHouseKey: "casa-inventada" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("guarda o alvo escolhido, para haver quem responda", async () => {
    const res = await startProjectFromTemplate(
      deps(),
      req({ templateId: "enviar-um-presente-cerimonial", targetHouseKey: "casa-khazdrun" }),
    );
    expect(res.status).toBe(200);
    const card = res.body as any;
    expect(card.status).toBe("PENDING_TARGET");
    expect(card.targetHouseId).toBe("casa-khazdrun");
  });
});
