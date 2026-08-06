import { ATTRIBUTE_KEYS, type Attributes } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { uploadHouseImages } from "./publicRoutes";
import { requireAdmin } from "../auth/adminAuth";
import { parseAdminLoginBody, parseApplyResolutionBody, parseComposeTurnBody, parseAdminCreateHouseBody, parseAdminUpdateHouseBody, parseAdminDeleteHouseBody, parseWorldBibleBody, parseGenerateTurnImageBody, parseUploadTurnImageBody, parseDeleteTurnImageBody, parseWikiCreateBody, parseWikiUpdateBody, parseWikiDeleteBody, parseGmCreateBody, parseGmUpdateBody, parseGmDeleteBody } from "../validation/schemas";
import { generatePlayerCode, hashCode } from "../auth/codes";
import { signToken, type AdminTokenPayload } from "../auth/tokens";
import { createNextTurnDraft, getActiveTurn, listTurns, putTurn, saveTurnResult, setTurnStatus, setTurnImage } from "../db/turns";
import { createAccountAndHouse, getHouse, listHouses, updateHouseAttributes, updateHouseFull, deleteHouseCascade, updateHouseStabilityAndAssets } from "../db/houses";
import { listCampaignProjects, putProject, putFavor } from "../db/projects";
import { processProjectsForTurn } from "../projects/processTurn";
import { canAffordStart, applyStartCharges } from "../projects/engine";
import { parseApproveProjectBody, parseRejectProjectBody, parseProjectIdBody } from "../validation/schemas";
import { listSubmissions } from "../db/submissions";
import { resetCampaign as dbResetCampaign } from "../db/campaignReset";
import { getWorldBible as dbGetWorldBible, putWorldBible as dbPutWorldBible } from "../db/worldBible";
import { listWikiEntries, putWikiEntry, deleteWikiEntry, generateWikiId, seedDefaultWiki } from "../db/wiki";
import { listGmEntries, putGmEntry, deleteGmEntry, generateGmId, seedDefaultGm } from "../db/gm";
import { buildChronicle, buildImagePrompt, buildPrivateInfoPrompt, buildPublicEventContext, buildPublicEventPrompt, buildResolutionPrompt, findPublicEventLeaks } from "../ai/prompts";
import { generateJson, parsePrivateInfo, parsePublicEvent, parseResolution } from "../ai/openai";
import { buildProjectCanon, buildProjectResolutionPrompt, parseProjectResolution } from "../ai/projectPrompts";

export async function adminLogin(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { adminCode } = parseAdminLoginBody(req.body);
  if (hashCode(adminCode) !== deps.config.adminCodeHash) {
    throw new HttpError(401, "INVALID_CODE", "Código de admin inválido.");
  }
  const payload: AdminTokenPayload = {
    type: "admin",
    campaignId: deps.config.campaignId,
    exp: Date.now() + deps.config.tokenTtlSeconds * 1000,
  };
  return { status: 200, body: { adminToken: signToken(payload, deps.config.tokenSigningSecret) } };
}

export async function getDashboard(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  const houses = await listHouses(deps.doc, tableName, campaignId);
  const submissions = turn ? await listSubmissions(deps.doc, tableName, campaignId, turn.turnId) : [];
  return {
    status: 200,
    body: {
      turnId: turn?.turnId ?? null,
      turnStatus: turn?.status ?? null,
      publicEvent: turn?.publicEvent ?? "",
      eventImageUrl: turn?.eventImageUrl,
      resultImageUrl: turn?.resultImageUrl,
      privateInfo: turn?.privateInfo ?? {},
      result: turn?.result ?? null,
      houses,
      submissions,
    },
  };
}

export async function composeTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "DRAFT") {
    throw new HttpError(409, "BAD_STATUS", "Só é possível compor um turno em rascunho.");
  }
  const body = parseComposeTurnBody(req.body);
  await putTurn(deps.doc, deps.config.tableName, deps.config.campaignId, {
    ...turn,
    publicEvent: body.publicEvent,
    privateInfo: body.privateInfo,
  });
  return { status: 204, body: undefined };
}

async function requireActiveTurnStatus(deps: Deps, expected: string): Promise<number> {
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== expected) {
    throw new HttpError(409, "BAD_STATUS", "Status do turno inválido para esta ação.");
  }
  return turn.turnId;
}

export async function openTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "DRAFT") {
    throw new HttpError(409, "BAD_STATUS", "Status do turno inválido para esta ação.");
  }
  if (!turn.publicEvent.trim()) {
    throw new HttpError(409, "EMPTY_EVENT", "Componha e salve um evento público antes de abrir o turno.");
  }
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, "OPEN");
  return { status: 204, body: undefined };
}

export async function lockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turnId = await requireActiveTurnStatus(deps, "OPEN");
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, "LOCKED");
  return { status: 204, body: undefined };
}

export async function unlockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turnId = await requireActiveTurnStatus(deps, "LOCKED");
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, "OPEN");
  return { status: 204, body: undefined };
}

function houseCodePrefix(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "casa";
}

export async function createHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const input = parseAdminCreateHouseBody(req.body);
  const playerCode = generatePlayerCode(houseCodePrefix(input.name));
  const codeHash = hashCode(playerCode);
  const { houseId } = await createAccountAndHouse(deps.doc, deps.config.tableName, deps.config.campaignId, { ...input, codeHash });
  await uploadHouseImages(deps, houseId, input.images);
  return { status: 200, body: { houseId, playerCode } };
}

export async function updateHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { houseId, ...fields } = parseAdminUpdateHouseBody(req.body);
  await updateHouseFull(deps.doc, deps.config.tableName, deps.config.campaignId, houseId, fields);
  return { status: 204, body: undefined };
}

export async function deleteHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { houseId } = parseAdminDeleteHouseBody(req.body);
  const result = await deleteHouseCascade(deps.doc, deps.config.tableName, deps.config.campaignId, houseId);
  return { status: 200, body: { deleted: result.deleted } };
}

export async function resetCampaign(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const result = await dbResetCampaign(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { deleted: result.deleted } };
}

export async function getWorldBible(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const wb = await dbGetWorldBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  return {
    status: 200,
    body: {
      lore: wb?.lore ?? "",
      visualDirectives: wb?.visualDirectives ?? "",
      updatedAt: wb?.updatedAt ?? "",
    },
  };
}

export async function putWorldBible(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseWorldBibleBody(req.body);
  await dbPutWorldBible(deps.doc, deps.config.tableName, deps.config.campaignId, body);
  return { status: 204, body: undefined };
}

export async function listWiki(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const entries = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { entries } };
}

export async function createWikiEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseWikiCreateBody(req.body);
  const entry = {
    entryId: generateWikiId(),
    section: body.section,
    title: body.title,
    body: body.body,
    order: body.order,
    updatedAt: new Date().toISOString(),
    ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}),
    ...(body.imageUrls ? { imageUrls: body.imageUrls } : {}),
  };
  await putWikiEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entry);
  return { status: 200, body: { entry } };
}

export async function updateWikiEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseWikiUpdateBody(req.body);
  const entry = {
    entryId: body.entryId,
    section: body.section,
    title: body.title,
    body: body.body,
    order: body.order,
    updatedAt: new Date().toISOString(),
    ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}),
    ...(body.imageUrls ? { imageUrls: body.imageUrls } : {}),
  };
  await putWikiEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entry);
  return { status: 200, body: { entry } };
}

export async function removeWikiEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { entryId } = parseWikiDeleteBody(req.body);
  await deleteWikiEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entryId);
  return { status: 204, body: undefined };
}

export async function seedWiki(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const result = await seedDefaultWiki(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: result };
}

export async function listGm(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const entries = await listGmEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { entries } };
}

export async function createGmEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseGmCreateBody(req.body);
  const entry = {
    entryId: generateGmId(),
    section: body.section,
    title: body.title,
    body: body.body,
    order: body.order,
    updatedAt: new Date().toISOString(),
  };
  await putGmEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entry);
  return { status: 200, body: { entry } };
}

export async function updateGmEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseGmUpdateBody(req.body);
  const entry = {
    entryId: body.entryId,
    section: body.section,
    title: body.title,
    body: body.body,
    order: body.order,
    updatedAt: new Date().toISOString(),
  };
  await putGmEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entry);
  return { status: 200, body: { entry } };
}

export async function removeGmEntry(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { entryId } = parseGmDeleteBody(req.body);
  await deleteGmEntry(deps.doc, deps.config.tableName, deps.config.campaignId, entryId);
  return { status: 204, body: undefined };
}

export async function seedGm(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const result = await seedDefaultGm(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: result };
}

export async function draftPublicEvent(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn || turn.status !== "DRAFT") {
    throw new HttpError(409, "BAD_STATUS", "O turno precisa estar em rascunho para gerar o evento.");
  }
  const [houses, turns, worldBible, wiki] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listTurns(deps.doc, tableName, campaignId),
    dbGetWorldBible(deps.doc, tableName, campaignId),
    listWikiEntries(deps.doc, tableName, campaignId),
  ]);
  const previousTurns = turns.filter((t) => t.turnId < turn.turnId && t.status === "RESOLVED");
  const recentTurns = previousTurns.slice(-5);
  const submissionPairs = await Promise.all(
    recentTurns.map(async (t) => [t.turnId, await listSubmissions(deps.doc, tableName, campaignId, t.turnId)] as const),
  );
  const submissionsByTurn = new Map(submissionPairs);
  const chronicle = buildChronicle(previousTurns);
  const publicEventContext = buildPublicEventContext({
    lore: worldBible?.lore,
    houses,
    wiki,
    turns: recentTurns,
    submissionsByTurn,
  });
  const { system, user } = buildPublicEventPrompt(houses, { lore: worldBible?.lore, chronicle, publicEventContext });
  const publicEvent = await generateJson(deps.chat, system, user, parsePublicEvent);
  if (findPublicEventLeaks(publicEvent, { turns: recentTurns, submissionsByTurn }).length > 0) {
    throw new HttpError(502, "AI_LEAKED_PRIVATE_CONTEXT", "A IA tentou expor contexto privado no evento público. Gere novamente.");
  }
  return { status: 200, body: { publicEvent } };
}

export async function draftPrivateInfo(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn || turn.status !== "DRAFT") {
    throw new HttpError(409, "BAD_STATUS", "Componha o turno antes de gerar informações privadas.");
  }
  const houses = await listHouses(deps.doc, tableName, campaignId);
  const [turns, worldBible] = await Promise.all([
    listTurns(deps.doc, tableName, campaignId),
    dbGetWorldBible(deps.doc, tableName, campaignId),
  ]);
  const chronicle = buildChronicle(turns.filter((t) => t.turnId < turn.turnId));
  const { system, user } = buildPrivateInfoPrompt(houses, turn.publicEvent, { lore: worldBible?.lore, chronicle });
  const privateInfo = await generateJson(deps.chat, system, user, parsePrivateInfo);
  return { status: 200, body: { privateInfo } };
}

export async function draftResolution(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn || turn.status !== "LOCKED") {
    throw new HttpError(409, "BAD_STATUS", "Tranque o turno antes de resolver.");
  }
  const [houses, submissions, turns, worldBible] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listSubmissions(deps.doc, tableName, campaignId, turn.turnId),
    listTurns(deps.doc, tableName, campaignId),
    dbGetWorldBible(deps.doc, tableName, campaignId),
  ]);
  const chronicle = buildChronicle(turns.filter((t) => t.turnId < turn.turnId));
  const { system, user } = buildResolutionPrompt(turn, houses, submissions, { lore: worldBible?.lore, chronicle });
  const result = await generateJson(deps.chat, system, user, parseResolution);
  return { status: 200, body: result };
}

export async function applyResolution(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn || turn.status !== "LOCKED") {
    throw new HttpError(409, "BAD_STATUS", "O turno precisa estar trancado para aplicar.");
  }
  const body = parseApplyResolutionBody(req.body);
  for (const [houseId, delta] of Object.entries(body.attributeDeltas)) {
    const h = await getHouse(deps.doc, tableName, campaignId, houseId);
    if (!h) continue;
    const next: Attributes = { ...h.attributes };
    for (const k of ATTRIBUTE_KEYS) {
      const d = delta[k];
      if (typeof d === "number") next[k] = Math.max(0, Math.min(5, h.attributes[k] + d));
    }
    await updateHouseAttributes(deps.doc, tableName, campaignId, houseId, next);
  }
  await saveTurnResult(deps.doc, tableName, campaignId, turn.turnId, {
    publicResult: body.publicResult,
    houseResults: body.houseResults,
    attributeDeltas: body.attributeDeltas,
    discoveries: body.discoveries,
  });
  const chat = deps.chat;
  const canon = chat ? buildProjectCanon(await listWikiEntries(deps.doc, tableName, campaignId)) : "";
  await processProjectsForTurn(
    {
      listCampaignProjects: (c) => listCampaignProjects(deps.doc, tableName, c),
      getHouse: (h) => getHouse(deps.doc, tableName, campaignId, h),
      putProject: (p) => putProject(deps.doc, tableName, campaignId, p),
      updateHouseAttributes: (h, a) => updateHouseAttributes(deps.doc, tableName, campaignId, h, a),
      updateHouseStabilityAndAssets: (h, s, assets) => updateHouseStabilityAndAssets(deps.doc, tableName, campaignId, h, s, assets),
      putFavor: (f) => putFavor(deps.doc, tableName, campaignId, f),
      judgeOutcome: chat
        ? async (project, house) => {
            const { system, user } = buildProjectResolutionPrompt(house, project, body.publicResult, canon);
            return generateJson(chat, system, user, parseProjectResolution, 2, 500);
          }
        : undefined,
    },
    campaignId,
    turn.turnId,
  );
  const next = await createNextTurnDraft(deps.doc, tableName, campaignId, turn.turnId + 1);
  return { status: 200, body: { nextTurnId: next.turnId } };
}

export async function generateTurnImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.image || !deps.imageStore) {
    throw new HttpError(503, "IMAGE_DISABLED", "Geração de imagens não configurada.");
  }
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");
  const { kind, sceneDescription } = parseGenerateTurnImageBody(req.body);
  const worldBible = await dbGetWorldBible(deps.doc, tableName, campaignId);
  const prompt = buildImagePrompt(worldBible?.visualDirectives, kind, turn, sceneDescription);
  const buffer = await deps.image(prompt);
  const imageUrl = await deps.imageStore.uploadTurnImage(kind, turn.turnId, buffer);
  await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, kind, imageUrl);
  return { status: 200, body: { imageUrl } };
}

export async function uploadTurnImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.imageStore) {
    throw new HttpError(503, "IMAGE_DISABLED", "Upload de imagens não configurado.");
  }
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");
  const { kind, body, contentType } = parseUploadTurnImageBody(req.headers, req.rawBody);
  const imageUrl = await deps.imageStore.uploadTurnImage(kind, turn.turnId, body, contentType);
  await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, kind, imageUrl);
  return { status: 200, body: { imageUrl } };
}

export async function deleteTurnImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");
  const { kind } = parseDeleteTurnImageBody(req.body);
  await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, kind, "");
  return { status: 204, body: undefined };
}

export async function adminListProjects(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const projects = await listCampaignProjects(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: projects };
}

async function loadProjectAcrossHouses(deps: Deps, projectId: string) {
  const all = await listCampaignProjects(deps.doc, deps.config.tableName, deps.config.campaignId);
  const project = all.find((p) => p.id === projectId);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Projeto não encontrado.");
  return project;
}

export async function adminApproveProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId, note } = parseApproveProjectBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  if (project.status !== "PENDING_GM" && project.status !== "PENDING_TARGET") {
    throw new HttpError(409, "BAD_STATUS", "Projeto não está aguardando aprovação.");
  }
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");
  const afford = canAffordStart(house, project);
  if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
  const charged = applyStartCharges(house, project);
  await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId, charged.attributes);
  await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId, charged.stability ?? 3, charged.assets ?? []);
  project.status = "ACTIVE";
  project.gmNotes = note || project.gmNotes;
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminRejectProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId, note } = parseRejectProjectBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "REJECTED";
  project.gmNotes = note;
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminPauseProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "PAUSED";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminResumeProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "ACTIVE";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}
