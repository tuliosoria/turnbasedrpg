import { ATTRIBUTE_KEYS, type Attributes, type NarrativeCard } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requireAdmin } from "../auth/adminAuth";
import { parseAdminLoginBody, parseApplyResolutionBody, parseComposeTurnBody, parseEditHouseBody, parseWorldBibleBody } from "../validation/schemas";
import { hashCode } from "../auth/codes";
import { signToken, type AdminTokenPayload } from "../auth/tokens";
import { createNextTurnDraft, getActiveTurn, listTurns, putTurn, saveTurnResult, setTurnStatus } from "../db/turns";
import { getHouse, listHouses, updateHouseAttributes } from "../db/houses";
import { listSubmissions } from "../db/submissions";
import { resetCampaign as dbResetCampaign } from "../db/campaignReset";
import { getWorldBible as dbGetWorldBible, putWorldBible as dbPutWorldBible } from "../db/worldBible";
import { buildChronicle, buildPrivateInfoPrompt, buildResolutionPrompt } from "../ai/prompts";
import { generateJson, parsePrivateInfo, parseResolution } from "../ai/openai";

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
      privateInfo: turn?.privateInfo ?? {},
      cards: turn?.cards ?? [],
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
    cards: body.cards as unknown as NarrativeCard[],
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

export async function editHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { houseId, attributes } = parseEditHouseBody(req.body);
  await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, houseId, attributes);
  return { status: 204, body: undefined };
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
  const next = await createNextTurnDraft(deps.doc, tableName, campaignId, turn.turnId + 1);
  return { status: 200, body: { nextTurnId: next.turnId } };
}
