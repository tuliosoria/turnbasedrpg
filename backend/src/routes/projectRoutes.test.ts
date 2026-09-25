import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjects, startProjectFromTemplate, cancelProject, acceptProject, enhanceCustomProject, startCustomProject, requestProjectRevision, refazerProjeto, submitProjectToGm } from "./projectRoutes";
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
    expect(body.templates.length).toBe(70);
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

  /**
   * Defeito 2: uma alocação gravada sobrevive à carta mudar. `refeita: true`
   * reescreve com prazo de um turno, e a Energia que o jogador tinha posto lá
   * vira desperdício silencioso — o mesmo defeito que este trabalho existe
   * para consertar, só que num lugar novo se a leitura não corrigir também.
   */
  describe("getProjects recorta a alocação gravada para o teto atual da carta", () => {
    it("derruba a entrada inteira quando a carta refeita zerou o teto, e avisa no ajuste", async () => {
      vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([
        { id: "p1", houseId: "casa-a", status: "ACTIVE", title: "Guarda de Elite", durationTurns: 1, turnsCompleted: 0, refeita: true } as any,
      ]);
      vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue({ p1: 3 });
      const res = await getProjects(deps(), req(undefined));
      const body: any = res.body;
      expect(body.energia.tetoPorProjeto.p1).toBe(0);
      // A tela nunca recebe um valor que já não cabe no teto da carta.
      expect(body.energia.porProjeto).toEqual({});
      expect(body.energia.ajustes).toEqual([{ id: "p1", title: "Guarda de Elite", de: 3, para: 0 }]);
    });

    it("recorta parcialmente quando o teto caiu mas não zerou", async () => {
      vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([
        { id: "p1", houseId: "casa-a", status: "ACTIVE", title: "Rota Comercial", durationTurns: 3, turnsCompleted: 1 } as any,
      ]);
      vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue({ p1: 3 });
      const res = await getProjects(deps(), req(undefined));
      const body: any = res.body;
      expect(body.energia.tetoPorProjeto.p1).toBe(1);
      expect(body.energia.porProjeto).toEqual({ p1: 1 });
      expect(body.energia.ajustes).toEqual([{ id: "p1", title: "Rota Comercial", de: 3, para: 1 }]);
    });

    it("não gera ajuste quando a alocação gravada ainda cabe no teto atual", async () => {
      vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([
        { id: "p1", houseId: "casa-a", status: "ACTIVE", title: "Aqueduto", durationTurns: 5, turnsCompleted: 0 } as any,
      ]);
      vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue({ p1: 2 });
      const res = await getProjects(deps(), req(undefined));
      const body: any = res.body;
      expect(body.energia.porProjeto).toEqual({ p1: 2 });
      expect(body.energia.ajustes).toEqual([]);
    });

    it("derruba a entrada quando a carta voltou para PENDING_GM — o motor de turno nem a processa", async () => {
      vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([
        { id: "p1", houseId: "casa-a", status: "PENDING_GM", title: "Trabuco de Defesa", durationTurns: 4, turnsCompleted: 1 } as any,
      ]);
      vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue({ p1: 2 });
      const res = await getProjects(deps(), req(undefined));
      const body: any = res.body;
      expect(body.energia.porProjeto).toEqual({});
      expect(body.energia.ajustes).toEqual([{ id: "p1", title: "Trabuco de Defesa", de: 2, para: 0 }]);
    });

    it("sem alocação gravada, não há ajuste — não existe registro para corrigir", async () => {
      vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([
        { id: "p1", houseId: "casa-a", status: "ACTIVE", title: "Guarda de Elite", durationTurns: 1, turnsCompleted: 0 } as any,
      ]);
      vi.spyOn(energiaDb, "getAlocacaoEnergia").mockResolvedValue(null);
      const res = await getProjects(deps(), req(undefined));
      const body: any = res.body;
      expect(body.energia.porProjeto).toEqual({});
      expect(body.energia.ajustes).toEqual([]);
      expect(body.energia.distribuiu).toBe(false);
    });
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

  /** Uma carta refeita, com o prêmio que ela tinha antes de ser reescrita. */
  function cartaRefeita(amount: number) {
    return {
      id: "p1", houseId: "casa-a", title: "Guarda de Elite", refeita: true, durationTurns: 1,
      status: "ACTIVE", playerOriginalRequest: "guarda de elite",
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    } as any;
  }

  // Reescrever é para a carta fazer sentido no mundo que mudou, não para trocar
  // prêmio pequeno por grande com o sucesso garantido de brinde.
  it("reescrita de carta refeita que pede prêmio maior mantém o prêmio original", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(cartaRefeita(1));
    vi.spyOn(openai, "generateJson").mockResolvedValue({
      ...aiProposal, durationTurns: 5,
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const res = await requestProjectRevision(depsAi(), req({ projectId: "p1", note: "quero maior" }));
    const p: any = res.body;
    // Sem mesa do Mestre para segurar o crescimento, o prêmio simplesmente não cresce.
    expect(p.completionEffects.attributeChanges).toEqual([{ attribute: "soldados", amount: 1, permanent: true }]);
    expect(p.aiBalanceExplanation).toContain("prêmio original foi mantido");
    // O prazo da segunda tentativa é sempre um turno, aconteça o que acontecer
    // com o resto da carta — foi o que a tela prometeu.
    expect(p.durationTurns).toBe(1);
    expect(p.refeita).toBe(true);
  });

  it("reescrita que mantém o prêmio volta direto para o jogador", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(cartaRefeita(2));
    vi.spyOn(openai, "generateJson").mockResolvedValue({
      ...aiProposal,
      completionEffects: { attributeChanges: [{ attribute: "controle", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const res = await requestProjectRevision(depsAi(), req({ projectId: "p1", note: "vigias noturnos" }));
    const p: any = res.body;
    expect(p.requiresGmApproval).toBe(false);
    expect(p.status).toBe("PENDING_PLAYER");
    expect(p.durationTurns).toBe(1);
  });

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

  // O Mestre tirou a mesa de aprovação em 2026-09-24: carta com regras
  // editadas pelo jogador também começa na hora, pagando o custo.
  it("startCustomProject activates even when rules were edited — no GM desk", async () => {
    const res = await startCustomProject(deps(), req(draft({ playerEditedRules: true })));
    const p: any = res.body;
    expect(p.status).toBe("ACTIVE");
    expect(p.requiresGmApproval).toBe(true);
    expect(housesDb.updateHouseAttributes).toHaveBeenCalled();
  });

  it("startCustomProject with a target house activates without waiting for it", async () => {
    const res = await startCustomProject(deps(), req(draft({ targetHouseId: "casa-khazdrun" })));
    expect((res.body as any).status).toBe("ACTIVE");
  });

  it("acceptProject activates a card that asked for GM approval", async () => {
    const card = { id: "p2", houseId: "casa-a", title: "Ritual", status: "PENDING_PLAYER", requiresGmApproval: true, requiresTargetApproval: false, costs: [] };
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(card as any);
    const res = await acceptProject(deps(), req({ projectId: "p2" }));
    expect((res.body as any).status).toBe("ACTIVE");
  });

  // Balões de Vento: refeita, reescrita pelo jogador, aceita — e cobrada de novo.
  it("aceitar uma carta refeita reescrita não cobra o início de novo", async () => {
    const card = { id: "p2", houseId: "casa-a", title: "Balões", status: "PENDING_PLAYER", refeita: true, requiresGmApproval: false, requiresTargetApproval: false, costs: [{ type: "RESOURCES", amount: 2, timing: "ON_START" }] };
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(card as any);
    const res = await acceptProject(deps(), req({ projectId: "p2" }));
    expect((res.body as any).status).toBe("ACTIVE");
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("carta que já pagou, reescrita e aceita de novo, não paga outra vez", async () => {
    const card = { id: "p2", houseId: "casa-a", title: "Muralha", status: "PENDING_PLAYER", inicioPago: true, requiresGmApproval: false, requiresTargetApproval: false, costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }] };
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(card as any);
    await acceptProject(deps(), req({ projectId: "p2" }));
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("carta nova paga o início e fica marcada como paga", async () => {
    const res = await startCustomProject(deps(), req(draft()));
    expect((res.body as any).inicioPago).toBe(true);
    expect(housesDb.updateHouseAttributes).toHaveBeenCalledTimes(1);
  });

  it("submitProjectToGm (old button) now just accepts", async () => {
    const card = { id: "p2", houseId: "casa-a", title: "Ritual", status: "PENDING_PLAYER", requiresGmApproval: false, requiresTargetApproval: false, costs: [] };
    vi.spyOn(projectsDb, "getProject").mockResolvedValue(card as any);
    const res = await submitProjectToGm(deps(), req({ projectId: "p2" }));
    expect((res.body as any).status).toBe("ACTIVE");
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

  /**
   * Sabotagem não pede licença. "Plantar um Rumor Falso" precisa de alvo, mas
   * pedir a aprovação do alvo entregaria o golpe a quem ele quer enganar — a
   * carta ficaria PENDING_TARGET esperando a vítima autorizar ser enganada.
   */
  it("carta de alvo secreto começa ativa, sem pedir licença à vítima", async () => {
    const res = await startProjectFromTemplate(
      deps(),
      req({ templateId: "plantar-um-rumor-falso", targetHouseKey: "casa-khazdrun" }),
    );
    const card = res.body as any;
    expect(card.status).toBe("ACTIVE");
    expect(card.targetHouseId).toBe("casa-khazdrun");
    expect(card.requiresTargetApproval).toBe(false);
    expect(housesDb.updateHouseAttributes).toHaveBeenCalled();
  });

  it("carta de alvo secreto também recusa começar sem alvo", async () => {
    await expect(
      startProjectFromTemplate(deps(), req({ templateId: "plantar-um-rumor-falso" })),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
  });

  it("comprar rumores no Porto não pede alvo nenhum", async () => {
    const res = await startProjectFromTemplate(
      deps(),
      req({ templateId: "rumores-do-porto-vozes-do-norte" }),
    );
    expect((res.body as any).status).toBe("ACTIVE");
    expect((res.body as any).targetHouseId).toBeNull();
  });

  it("guarda o alvo escolhido e começa sem esperar a resposta dele", async () => {
    const res = await startProjectFromTemplate(
      deps(),
      req({ templateId: "enviar-um-presente-cerimonial", targetHouseKey: "casa-khazdrun" }),
    );
    expect(res.status).toBe(200);
    const card = res.body as any;
    expect(card.status).toBe("ACTIVE");
    expect(card.targetHouseId).toBe("casa-khazdrun");
  });
});

/**
 * Tentar de novo uma carta que o motor fracassou.
 *
 * O motor já sabia honrar `refeita` — pula o juiz de desfecho e conclui com
 * sucesso garantido —, a tela do Mestre já mostrava o selo, e a revisão já
 * travava o prêmio. Só que `refeita: true` não era atribuído em lugar nenhum
 * do código: nada transformava uma carta FALHADA em carta refeita, e o
 * caminho inteiro era código morto. O Trabuco de Khazdrun ficou preso assim.
 */
describe("refazerProjeto", () => {
  const falhada = {
    id: "p-falha", houseId: "casa-a", title: "Trabuco de Defesa",
    status: "FAILED", outcome: "FAILURE", outcomeNarrative: "Sabotagem desmontou os materiais.",
    durationTurns: 4, turnsCompleted: 4, lastProcessedTurnId: 3,
    costs: [{ timing: "ON_START", type: "RESOURCES", amount: 1 }],
    completionEffects: { attributeChanges: [], assets: [], favors: [] },
  } as any;

  it("devolve a carta ao jogo com desfecho garantido", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada });
    const res = await refazerProjeto(deps(), req({ projectId: "p-falha" }));
    const card = res.body as any;
    expect(card.refeita).toBe(true);
    expect(card.status).toBe("ACTIVE");
    expect(card.outcome).toBeNull();
    // Um turno, como a tela promete, e do zero para poder andar.
    expect(card.durationTurns).toBe(1);
    expect(card.turnsCompleted).toBe(0);
  });

  // Reparação de bug, não nova aposta: cobrar de novo puniria o jogador pelo
  // erro que não foi dele.
  it("não cobra os custos outra vez", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada });
    const cobranca = vi.spyOn(housesDb, "updateHouseAttributes");
    await refazerProjeto(deps(), req({ projectId: "p-falha" }));
    expect(cobranca).not.toHaveBeenCalled();
  });

  // Sem isto a carta refeita não anda no turno em que foi refeita: o motor
  // pula quem já foi processado neste turno.
  it("libera a carta para andar ainda neste turno", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada });
    const res = await refazerProjeto(deps(), req({ projectId: "p-falha" }));
    expect((res.body as any).lastProcessedTurnId).toBeNull();
  });

  it("recusa carta que não fracassou", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada, status: "ACTIVE", outcome: null });
    await expect(refazerProjeto(deps(), req({ projectId: "p-falha" }))).rejects.toMatchObject({ status: 409 });
  });

  it("recusa carta de outra Casa", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ ...falhada, houseId: "casa-b" });
    await expect(refazerProjeto(deps(), req({ projectId: "p-falha" }))).rejects.toMatchObject({ status: 403 });
  });
});
