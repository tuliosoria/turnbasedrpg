import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { seatOf, type CompletionEffects } from "@ravenloft/content";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getHouse, updateHouseAttributes, updateHouseStabilityAndAssets } from "../db/houses";
import { getActiveTurn } from "../db/turns";
import { listWikiEntries } from "../db/wiki";
import { getProject, putProject, listHouseProjects, listFavorsForHouse, putFavor } from "../db/projects";
import { getTemplate, DEFAULT_PROJECT_TEMPLATES, houseStability, recommendStarterCards, clampText, CARD_TITLE_MAX, CARD_DESCRIPTION_MAX } from "@ravenloft/content";
import type { ProjectCard, ProjectTemplate, Favor } from "@ravenloft/content";
import { projectSlotLimit, activeProjectCount, canAffordStart, applyStartCharges, energiaDoTurno, energiaMaximaPara, validarAlocacao } from "../projects/engine";
import { getAlocacaoEnergia, putAlocacaoEnergia } from "../db/energia";
import { generateJson } from "../ai/openai";
import { buildProjectCardPrompt, buildEnhanceCardPrompt, buildProjectCanon, parseProjectCardProposal, enforceGmTriggers, type ProjectProposal } from "../ai/projectPrompts";
import { parseStartTemplateBody, parseEnhanceCardBody, parseCustomCardDraftBody, parseProjectIdBody, parseRevisionBody, parseFavorRespondBody, parseEnergiaBody } from "../validation/schemas";
import type { CustomCardDraft } from "@ravenloft/content";

function genId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

async function loadHouse(deps: Deps, houseId: string) {
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");
  return house;
}

async function currentTurnId(deps: Deps): Promise<number> {
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  return turn?.turnId ?? 0;
}

function templateToCard(t: ProjectTemplate, campaignId: string, houseId: string, turnId: number): ProjectCard {
  const now = new Date().toISOString();
  return {
    id: genId(), campaignId, houseId, title: t.title, description: t.description, publicDescription: t.description,
    category: t.category, status: "DRAFT", durationTurns: t.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: t.costs, requirements: t.requirements, completionEffects: t.completionEffects, risks: t.risks, complications: [],
    targetHouseId: null, requiresTargetApproval: t.requiresTargetApproval, requiresGmApproval: t.requiresGmApproval,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: t.id, pagamentoNarrativo: t.pagamentoNarrativo,
    createdBy: "PLAYER", createdAtTurn: turnId, createdAt: now, updatedAt: now, completedAt: null,
  };
}

function proposalToCard(p: ProjectProposal, request: { request: string }, campaignId: string, houseId: string, turnId: number): ProjectCard {
  const now = new Date().toISOString();
  return {
    id: genId(), campaignId, houseId, title: p.title, description: p.description, publicDescription: p.publicDescription,
    category: p.category, status: "PENDING_PLAYER", durationTurns: p.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: p.costs, requirements: p.requirements, completionEffects: p.completionEffects, risks: p.risks, complications: p.complications,
    targetHouseId: p.targetHouseId, requiresTargetApproval: p.requiresTargetApproval, requiresGmApproval: p.requiresGmApproval,
    aiBalanceStatus: p.aiBalanceStatus, aiBalanceExplanation: p.aiBalanceExplanation, playerOriginalRequest: request.request,
    gmNotes: null, templateId: null, createdBy: "AI", createdAtTurn: turnId, createdAt: now, updatedAt: now, completedAt: null,
  };
}

export async function getProjects(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const house = await loadHouse(deps, player.houseId);
  const [projects, favors] = await Promise.all([
    listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId),
    listFavorsForHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId),
  ]);
  const turnId = await currentTurnId(deps);
  const alocada = await getAlocacaoEnergia(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, player.houseId);
  const ativas = projects.filter((p) => p.status === "ACTIVE");
  const tetoPorProjeto: Record<string, number> = {};
  for (const p of ativas) tetoPorProjeto[p.id] = energiaMaximaPara(p);

  return {
    status: 200,
    body: {
      templates: DEFAULT_PROJECT_TEMPLATES,
      recommended: recommendStarterCards(house).map((t) => t.id),
      projects,
      favors: favors.filter((f) => f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
      attributes: house.attributes,
      energia: { total: energiaDoTurno(projects), porProjeto: alocada ?? {}, tetoPorProjeto, distribuiu: alocada !== null },
    },
  };
}

export async function startProjectFromTemplate(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { templateId, targetHouseKey } = parseStartTemplateBody(req.body);
  const template = getTemplate(templateId);
  if (!template) throw new HttpError(404, "NOT_FOUND", "Modelo de projeto não encontrado.");
  const house = await loadHouse(deps, player.houseId);
  const existing = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (activeProjectCount(existing) >= projectSlotLimit(house)) {
    throw new HttpError(409, "BAD_STATUS", "Limite de projetos ativos atingido.");
  }
  const turnId = await currentTurnId(deps);
  const card = templateToCard(template, deps.config.campaignId, player.houseId, turnId);

  if (template.requiresGmApproval) {
    card.status = "PENDING_GM";
  } else if (template.requiresSecretTarget) {
    // Alvo obrigatório, aprovação nenhuma: a vítima não é consultada nem
    // avisada, senão a sabotagem chegaria antes da mentira.
    if (!targetHouseKey || !seatOf(targetHouseKey)) {
      throw new HttpError(400, "INVALID_BODY", "Escolha a Casa que será enganada.");
    }
    card.targetHouseId = targetHouseKey;
    const afford = canAffordStart(house, card);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, card);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes, `custo de início da carta "${card.title}"`);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    card.status = "ACTIVE";
  } else if (template.requiresTargetApproval) {
    // Uma carta que precisa de alvo e não guarda qual é fica esperando a
    // aprovação de ninguém: catorze modelos de diplomacia nasciam assim e nunca
    // saíam do lugar. Sem alvo, a carta não começa.
    if (!targetHouseKey || !seatOf(targetHouseKey)) {
      throw new HttpError(400, "INVALID_BODY", "Escolha a Casa com quem esta carta é feita.");
    }
    card.targetHouseId = targetHouseKey;
    card.status = "PENDING_TARGET";
  } else {
    const afford = canAffordStart(house, card);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, card);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes, `custo de início da carta "${card.title}"`);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    card.status = "ACTIVE";
  }
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, card);
  return { status: 200, body: card };
}

export async function enhanceCustomProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const input = parseEnhanceCardBody(req.body);
  const house = await loadHouse(deps, player.houseId);
  const wiki = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = buildProjectCanon(wiki);
  const { system, user } = buildEnhanceCardPrompt(house, canon, input);
  const proposal = enforceGmTriggers(await generateJson(deps.chat, system, user, parseProjectCardProposal, 2, 1200));
  const title = clampText(proposal.title, CARD_TITLE_MAX);
  const description = clampText(proposal.description, CARD_DESCRIPTION_MAX);
  const draft: CustomCardDraft = {
    title,
    description,
    publicDescription: proposal.publicDescription ? clampText(proposal.publicDescription, CARD_DESCRIPTION_MAX) : description,
    category: proposal.category,
    durationTurns: proposal.durationTurns,
    costs: proposal.costs,
    requirements: proposal.requirements,
    risks: proposal.risks,
    completionEffects: proposal.completionEffects,
    targetHouseId: proposal.targetHouseId ?? input.targetHouseId,
    playerOriginalRequest: input.body,
    playerEditedRules: false,
    aiBalanceStatus: proposal.aiBalanceStatus,
    aiBalanceExplanation: proposal.aiBalanceExplanation,
  };
  return { status: 200, body: draft };
}

function draftToProposal(d: CustomCardDraft): ProjectProposal {
  return {
    title: d.title, description: d.description, publicDescription: d.publicDescription,
    category: d.category, durationTurns: d.durationTurns, costs: d.costs,
    requirements: d.requirements, risks: d.risks, complications: [],
    completionEffects: d.completionEffects, targetHouseId: d.targetHouseId,
    requiresTargetApproval: Boolean(d.targetHouseId), requiresGmApproval: false,
    aiBalanceStatus: d.aiBalanceStatus, aiBalanceExplanation: d.aiBalanceExplanation,
  };
}

export async function startCustomProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const draft = parseCustomCardDraftBody(req.body);
  const house = await loadHouse(deps, player.houseId);
  const proposal = enforceGmTriggers(draftToProposal(draft));
  if (draft.playerEditedRules) proposal.requiresGmApproval = true;
  const turnId = await currentTurnId(deps);
  const card = proposalToCard(proposal, { request: draft.playerOriginalRequest }, deps.config.campaignId, player.houseId, turnId);
  card.templateId = null;
  card.createdBy = "PLAYER";

  if (proposal.requiresGmApproval) {
    card.status = "PENDING_GM";
  } else if (proposal.requiresTargetApproval) {
    card.status = "PENDING_TARGET";
  } else {
    const existing = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
    if (activeProjectCount(existing) >= projectSlotLimit(house)) {
      throw new HttpError(409, "BAD_STATUS", "Limite de projetos ativos atingido.");
    }
    const afford = canAffordStart(house, card);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, card);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes, `custo de início da carta "${card.title}"`);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    card.status = "ACTIVE";
  }
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, card);
  return { status: 200, body: card };
}

async function loadOwnProject(deps: Deps, houseId: string, projectId: string): Promise<ProjectCard> {
  const project = await getProject(deps.doc, deps.config.tableName, deps.config.campaignId, houseId, projectId);
  if (!project || project.houseId !== houseId) throw new HttpError(403, "NO_HOUSE", "Projeto não pertence à sua Casa.");
  return project;
}

export async function acceptProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  if (project.status !== "PENDING_PLAYER") throw new HttpError(409, "BAD_STATUS", "Projeto não está aguardando sua decisão.");
  const house = await loadHouse(deps, player.houseId);
  if (project.requiresGmApproval) {
    project.status = "PENDING_GM";
  } else if (project.requiresTargetApproval) {
    project.status = "PENDING_TARGET";
  } else {
    const activeList = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
    if (activeProjectCount(activeList) >= projectSlotLimit(house)) {
      throw new HttpError(409, "BAD_STATUS", "Limite de projetos ativos atingido.");
    }
    const afford = canAffordStart(house, project);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, project);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes, `custo de início da carta "${project.title}"`);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    project.status = "ACTIVE";
  }
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

/**
 * Uma segunda chance para a carta que o motor fracassou.
 *
 * O desfecho de uma carta é sorteado por um juiz de IA, e quando ele diz não o
 * jogador perde os turnos e o custo sem ter feito nada errado. A reparação
 * escolhida foi esta: a carta volta ao jogo marcada como `refeita`, e carta
 * refeita não passa pelo juiz — conclui garantido, em um turno.
 *
 * O motor já sabia disso, a tela do Mestre já mostrava o selo e a revisão já
 * travava o prêmio para impedir que a reparação virasse porta para uma aposta
 * maior. Faltava o começo: `refeita` não era atribuído em nenhum lugar do
 * código, então nada nunca virava carta refeita e o caminho inteiro era morto.
 *
 * Não cobra custo de novo. É reparação de bug, não nova aposta.
 */
export async function refazerProjeto(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  if (project.status !== "FAILED") {
    throw new HttpError(409, "BAD_STATUS", "Só uma carta que fracassou pode ser refeita.");
  }

  Object.assign(project, {
    refeita: true,
    status: "ACTIVE" as const,
    outcome: null,
    // A narrativa do fracasso sai: ela descreve um desfecho que deixou de valer.
    outcomeNarrative: null,
    completedAt: null,
    resolvedAt: null,
    // O prazo da segunda tentativa é um turno, como a tela promete.
    durationTurns: 1,
    turnsCompleted: 0,
    // Sem isto a carta não anda no turno em que foi refeita: o motor pula quem
    // já tem este turno carimbado.
    lastProcessedTurnId: null,
    updatedAt: new Date().toISOString(),
  });
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function requestProjectRevision(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { projectId, note } = parseRevisionBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  const house = await loadHouse(deps, player.houseId);
  const wiki = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = buildProjectCanon(wiki);
  const { system, user } = buildProjectCardPrompt(house, canon, {
    request: `${project.playerOriginalRequest ?? project.title}\n\nAjuste pedido: ${note}`,
  });
  const proposal = enforceGmTriggers(await generateJson(deps.chat, system, user, parseProjectCardProposal, 2, 1200));

  // Uma carta refeita conclui sem passar pelo juiz de desfecho. Reescrevê-la
  // livremente transformaria a reparação de um bug numa porta para trocar um
  // prêmio pequeno por um grande, com sucesso garantido de brinde.
  //
  // A trava é o teto do prêmio que a carta já tinha: crescer é permitido, mas
  // passa pela mesa do Mestre. Conferido em código, porque uma regra que só
  // pede ao modelo para se comportar não é uma regra.
  const tetoDe = (e: CompletionEffects) =>
    e.attributeChanges.filter((c) => c.permanent).reduce((m, c) => Math.max(m, c.amount), 0);
  const cresceu = project.refeita && tetoDe(proposal.completionEffects) > tetoDe(project.completionEffects);

  Object.assign(project, {
    title: proposal.title, description: proposal.description, publicDescription: proposal.publicDescription,
    category: proposal.category,
    // O prazo da segunda tentativa é sempre um turno: foi o que a tela prometeu.
    durationTurns: project.refeita ? 1 : proposal.durationTurns,
    costs: proposal.costs,
    requirements: proposal.requirements, risks: proposal.risks, complications: proposal.complications,
    completionEffects: proposal.completionEffects, targetHouseId: proposal.targetHouseId,
    requiresTargetApproval: proposal.requiresTargetApproval,
    requiresGmApproval: proposal.requiresGmApproval || cresceu,
    aiBalanceStatus: proposal.aiBalanceStatus,
    aiBalanceExplanation: cresceu
      ? `${proposal.aiBalanceExplanation ?? ""}\n\nA reescrita pede prêmio maior que o da carta original, que conclui com sucesso garantido. Por isso desceu para a mesa do Mestre.`.trim()
      : proposal.aiBalanceExplanation,
    status: "PENDING_PLAYER", updatedAt: new Date().toISOString(),
  });
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function submitProjectToGm(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  project.status = "PENDING_GM";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function cancelProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  project.status = "CANCELLED";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function respondToFavor(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { favorId, accept } = parseFavorRespondBody(req.body);
  const favors = await listFavorsForHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  const favor = favors.find((f) => f.id === favorId);
  if (!favor) throw new HttpError(404, "NOT_FOUND", "Favor não encontrado.");
  const next: Favor = { ...favor, status: accept ? "ACCEPTED" : "DECLINED", updatedAt: new Date().toISOString() };
  await putFavor(deps.doc, deps.config.tableName, deps.config.campaignId, next);
  return { status: 200, body: next };
}

/**
 * Grava como a Casa distribuiu os pontos de Energia deste turno.
 *
 * Só com o turno aberto: depois de fechado o Mestre já está resolvendo, e mudar
 * a alocação ali mudaria o resultado por baixo dele.
 */
export async function setEnergia(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { porProjeto } = parseEnergiaBody(req.body);

  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "OPEN") {
    throw new HttpError(423, "TURN_LOCKED", "O turno não está aberto para distribuir Energia.");
  }

  const projects = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  const conferido = validarAlocacao(porProjeto, projects);
  if (!conferido.ok) throw new HttpError(409, "BAD_STATUS", conferido.motivo ?? "Alocação inválida.");

  await putAlocacaoEnergia(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, player.houseId, porProjeto);
  return { status: 200, body: { porProjeto } };
}
