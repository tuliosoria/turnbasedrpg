import {
  ATTRIBUTE_KEYS, SEATS, briefingsDoPorto, describeFacts, selectFactsForTurn,
  type Attributes, type TurnAttributeChange, type Turn, type WorldFact, type Pendencias,
} from "@ravenloft/content";
import { updateNpcWorld } from "../ai/npc/worldUpdate";
import { getNpcDynamic, putNpcDynamic } from "../db/npcDynamic";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { uploadHouseImages } from "./publicRoutes";
import { requireAdmin, requireDraftIngest } from "../auth/adminAuth";
import { getTurnDraft, putTurnDraft, deleteTurnDraft } from "../db/turnDraft";
import { parseAdminLoginBody, parseApplyResolutionBody, parseComposeTurnBody, parseAdminCreateHouseBody, parseAdminUpdateHouseBody, parseAdminDeleteHouseBody, parseWorldBibleBody, parseTurnDraftBody, parseSetTurnImageUrlBody, parseNpcDynamicBody, parseGenerateTurnImageBody, parseUploadTurnImageBody, parseDeleteTurnImageBody, parseWikiCreateBody, parseWikiUpdateBody, parseWikiDeleteBody, parseGmCreateBody, parseGmUpdateBody, parseGmDeleteBody } from "../validation/schemas";
import { generatePlayerCode, hashCode } from "../auth/codes";
import { signToken, type AdminTokenPayload } from "../auth/tokens";
import { createNextTurnDraft, getActiveTurn, listTurns, putTurn, saveTurnResult, setTurnStatus, setTurnImage } from "../db/turns";
import { createAccountAndHouse, getHouse, listHouses, updateHouseAttributes, updateHouseFull, deleteHouseCascade, updateHouseStabilityAndAssets } from "../db/houses";
import { listCampaignProjects, putProject, putFavor } from "../db/projects";
import { getAlocacaoEnergia } from "../db/energia";
import { processProjectsForTurn } from "../projects/processTurn";
import { canAffordStart, applyStartCharges } from "../projects/engine";
import { parseApproveProjectBody, parseRejectProjectBody, parseProjectIdBody } from "../validation/schemas";
import { listSubmissions } from "../db/submissions";
import { listAllMessages, putMessage } from "../db/diplomacy/messages";
import { deleteWorldFactsOfTurn, listWorldFacts, putWorldFact } from "../db/worldFacts";
import { listCanonSubmissions } from "../db/canonSubmissions";
import { listAllSpyOps } from "../db/spyOps";
import {
  FACT_EXTRACTION_SYSTEM_PROMPT, buildFactExtractionUser, parseFacts, turnBlocks,
} from "../ai/campaign/factExtraction";
import { listHouseRelations } from "../db/houseRelations";
import { sendOutreach } from "../diplomacy/sendOutreach";
import { resetCampaign as dbResetCampaign } from "../db/campaignReset";
import { getWorldBible as dbGetWorldBible, putWorldBible as dbPutWorldBible } from "../db/worldBible";
import { listNpcDynamics as dbListNpcDynamics, putNpcDynamic as dbPutNpcDynamic } from "../db/npcDynamic";
import { characterFor, npcFor } from "@ravenloft/content";
import { listWikiEntries, putWikiEntry, deleteWikiEntry, generateWikiId, seedDefaultWiki } from "../db/wiki";
import { listGmEntries, putGmEntry, deleteGmEntry, generateGmId, seedDefaultGm } from "../db/gm";
import { buildChronicle, buildImagePrompt, buildPrivateInfoPrompt, findPrivateInfoLeaks, buildPublicEventContext, buildPublicEventPrompt, buildResolutionPrompt, findPublicEventLeaks } from "../ai/prompts";
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
  // A dívida do Porto sai no painel porque ela é invisível de todo outro
  // ângulo: o Recurso já foi cobrado e a carta já concluiu, mas o briefing só
  // existe se alguém o escrever neste turno. Um turno publicado por outro
  // caminho — rascunho salvo à mão, texto escrito pelo Mestre — perderia a
  // entrega em silêncio, e nunca mais haveria como recuperá-la.
  const portoPendente = turn ? briefingsDoPorto(
    await listCampaignProjects(deps.doc, tableName, campaignId),
    turn.turnId - 1,
    Object.fromEntries(houses.map((h) => [h.houseId, h.attributes.controle])),
  ) : [];
  // O que está parado esperando o Mestre, contado de uma vez só.
  //
  // Antes o painel contava projetos no navegador e ignorava cânone, espionagem
  // e rascunho — o Mestre só descobria trabalho parado abrindo aba por aba, e o
  // número mudava conforme a aba aberta. Contar aqui, onde os dados já estão,
  // torna o aviso uma coisa só e verdadeira.
  const [projetos, canonSubs, spyOps, draft] = await Promise.all([
    listCampaignProjects(deps.doc, tableName, campaignId),
    listCanonSubmissions(deps.doc, tableName, campaignId),
    listAllSpyOps(deps.doc, tableName, campaignId),
    getTurnDraft(deps.doc, tableName, campaignId),
  ]);
  const pendencias: Pendencias = {
    projetos: projetos.filter((p) => p.status === "PENDING_GM" || p.status === "PENDING_TARGET").length,
    canonico: canonSubs.filter((c) => c.status === "PENDING_GM").length,
    espioes: spyOps.filter((o) => o.status === "EM_CURSO").length,
    rascunho: draft ? 1 : 0,
    porto: portoPendente.length,
    // Só conta como pendente quando as ordens já não podem mais mudar: num
    // turno aberto o jogador ainda está escrevendo, e cobrar resolução ali
    // seria avisar sobre trabalho que ainda não existe.
    resolucao: turn?.status === "LOCKED" && !turn.result ? submissions.length : 0,
  };

  return {
    status: 200,
    body: {
      pendencias,
      portoPendente,
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

export async function aiStatus(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const model = deps.config.openAiModel;
  if (!deps.chat) {
    return { status: 200, body: { configured: false, status: "NOT_CONFIGURED", model } };
  }
  try {
    await deps.chat("ping", "ping", false, 1);
    return { status: 200, body: { configured: true, status: "OK", model } };
  } catch (e) {
    const code = e instanceof HttpError ? e.code : "AI_ERROR";
    const message = e instanceof Error ? e.message : "Falha desconhecida ao contatar a IA.";
    return { status: 200, body: { configured: true, status: "DOWN", code, message, model } };
  }
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

/**
 * Rascunho de turno proposto de fora (por Claude). O envio aceita sessão de
 * admin OU o token dedicado de ingestão; ler e descartar são só de admin.
 */
export async function saveTurnDraft(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireDraftIngest(deps.config, req);
  const body = parseTurnDraftBody(req.body);
  const draft = await putTurnDraft(deps.doc, deps.config.tableName, deps.config.campaignId, body);
  return { status: 200, body: draft };
}

export async function fetchTurnDraft(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const draft = await getTurnDraft(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { draft } };
}

export async function discardTurnDraft(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  await deleteTurnDraft(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 204, body: undefined };
}

/**
 * Publica o rascunho pendente como o turno atual, de uma vez: escreve o evento
 * público, as infos privadas (mapeando por nome de Casa), define a imagem do
 * evento e ABRE o turno. Funciona com o turno em DRAFT ou já OPEN (recompõe).
 * Aceita sessão de admin OU o token de ingestão.
 */
export async function publishTurnDraft(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireDraftIngest(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const draft = await getTurnDraft(deps.doc, tableName, campaignId);
  if (!draft) throw new HttpError(404, "NO_DRAFT", "Nenhum rascunho pendente.");
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");

  const houses = await listHouses(deps.doc, tableName, campaignId);
  const norm = (s: string) => s.trim().toLowerCase();
  const byName = new Map(houses.map((h) => [norm(h.name), h.houseId]));
  const byId = new Set(houses.map((h) => h.houseId));
  const privateInfo: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft.privateInfo)) {
    const id = byId.has(k) ? k : byName.get(norm(k));
    if (id) privateInfo[id] = v;
  }

  await putTurn(deps.doc, tableName, campaignId, { ...turn, publicEvent: draft.publicEvent, privateInfo });
  if (draft.eventImageUrl) await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, "event", draft.eventImageUrl);
  if (turn.status !== "OPEN") await setTurnStatus(deps.doc, tableName, campaignId, turn.turnId, "OPEN");
  await deleteTurnDraft(deps.doc, tableName, campaignId);
  return { status: 200, body: { turnId: turn.turnId, opened: true } };
}

/** Define a imagem do turno a partir de uma URL já existente (ex: retrato canônico). */
export async function setTurnImageUrl(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");
  const { kind, url } = parseSetTurnImageUrlBody(req.body);
  await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, kind, url);
  return { status: 200, body: { imageUrl: url } };
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

  // O mundo escreve primeiro. Antes disto a diplomacia era um monólogo: quem
  // não escrevia nunca recebia nada, e as Casas NPC pareciam mortas até serem
  // cutucadas. Falhar aqui não pode impedir o turno de abrir.
  try {
    await enviarCartasDoMundo(deps, turn.turnId, turn.publicEvent);
  } catch {
    // O turno já está aberto; um mundo calado é melhor que um turno travado.
  }

  return { status: 204, body: undefined };
}

/**
 * Manda o mundo escrever agora, sem esperar a abertura do próximo turno.
 *
 * O gatilho automático é a abertura do turno, o que significa esperar o turno
 * corrente ser resolvido. Isto dá ao Mestre o botão para ver as cartas saindo
 * quando ele quiser — e para mandar de novo se as primeiras não prestarem.
 */
export async function sendWorldLetters(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Não há turno ativo.");
  const enviadas = await enviarCartasDoMundo(deps, turn.turnId, turn.publicEvent);
  return { status: 200, body: { enviadas } };
}

/** As cartas não solicitadas das Casas NPC, no momento em que o turno abre. */
async function enviarCartasDoMundo(deps: Deps, turnId: number, publicEvent: string): Promise<number> {
  const { tableName, campaignId } = deps.config;
  const [houses, relations, mensagens, turnosAnteriores] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listHouseRelations(deps.doc, tableName, campaignId),
    listAllMessages(deps.doc, tableName, campaignId),
    listSubmissions(deps.doc, tableName, campaignId, turnId - 1),
  ]);

  const enviadas = await sendOutreach({
    chat: deps.chatDiplomacia ?? deps.chat,
    houses: houses.map((h) => ({ houseId: h.houseId, name: h.name })),
    relations,
    publicEvent,
    lastOrders: Object.fromEntries(turnosAnteriores.map((s) => [s.houseId, s.orderText])),
    // Conversa viva não recebe carta por cima: seria o NPC falando sozinho no
    // meio de um assunto que já está em andamento.
    alreadyTalking: new Set(
      mensagens.filter((m) => m.turnNumber === turnId).map((m) => `${m.fromHouseId}~${m.toHouseKey}`),
    ),
    turnNumber: turnId,
    campaignId,
    putMessage: (m) => putMessage(deps.doc, tableName, campaignId, m),
    putFavor: (f) => putFavor(deps.doc, tableName, campaignId, f),
    newId: () => `out-${turnId}-${Math.random().toString(36).slice(2, 10)}`,
  });
  return enviadas.length;
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

export async function listNpcDynamic(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const states = await dbListNpcDynamics(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { states } };
}

export async function updateNpcDynamic(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const dynamic = parseNpcDynamicBody(req.body);
  if (!npcFor(dynamic.affiliation, dynamic.id) && !characterFor(dynamic.affiliation, dynamic.id)) {
    throw new HttpError(400, "INVALID_BODY", "Esse NPC não existe no Codex.");
  }
  await dbPutNpcDynamic(deps.doc, deps.config.tableName, deps.config.campaignId, { ...dynamic, updatedAt: new Date().toISOString() });
  return { status: 200, body: { state: dynamic } };
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
  const { system, user } = buildPublicEventPrompt(houses, {
    lore: worldBible?.lore, chronicle, publicEventContext, worldFacts: await factsBlockFor(deps, tableName, campaignId),
  });
  const publicEvent = await generateJson(deps.chat, system, user, parsePublicEvent);
  if (findPublicEventLeaks(publicEvent, { turns: recentTurns, submissionsByTurn }).length > 0) {
    throw new HttpError(502, "AI_LEAKED_PRIVATE_CONTEXT", "A IA tentou expor contexto privado no evento público. Gere novamente.");
  }
  return { status: 200, body: { publicEvent } };
}

/**
 * O registro da campanha em forma de bloco, para quem escreve o turno.
 *
 * Aqui vai tudo que está ativo, e não a fatia de uma conversa: quem escreve o
 * turno precisa enxergar o tabuleiro inteiro, e o orçamento de um prompt de
 * turno é outro.
 */
async function factsBlockFor(deps: Deps, tableName: string, campaignId: string): Promise<string | undefined> {
  const fatos = await listWorldFacts(deps.doc, tableName, campaignId);
  const nome = (k: string) => SEATS.find((s) => s.key === k)?.name ?? k;
  return describeFacts(selectFactsForTurn(fatos), nome) ?? undefined;
}

/**
 * O registro da campanha, para o Mestre conferir e podar.
 *
 * Como não há aprovação por fato, esta tela é a única supervisão que existe. A
 * citação viaja junto de propósito: sem ela, revogar vira palpite — o Mestre
 * precisa ver de qual frase do turno o fato saiu.
 */
export async function listWorldFactsRoute(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const fatos = await listWorldFacts(deps.doc, tableName, campaignId);
  return {
    status: 200,
    body: {
      fatos: [...fatos].sort((a, b) => b.turnNumber - a.turnNumber || b.createdAt.localeCompare(a.createdAt)),
    },
  };
}

export async function revokeWorldFact(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const fatos = await listWorldFacts(deps.doc, tableName, campaignId);
  const fato = fatos.find((f) => f.id === req.pathParams.id);
  if (!fato) return { status: 404, body: { code: "NOT_FOUND", message: "Fato não encontrado." } };
  // Revogado, nunca apagado: o registro precisa continuar auditável, e um fato
  // que some não deixa ver que houve correção.
  await putWorldFact(deps.doc, tableName, campaignId, { ...fato, status: "REVOGADO" });
  return { status: 200, body: { ok: true } };
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
  // Quem compôs o turno N entrega o que foi comprado no N-1: a carta do Porto
  // dura um turno, então a informação chega no turno seguinte à compra. Deriva
  // das cartas e não guarda estado, então redesenhar o rascunho não duplica
  // nem perde briefing nenhum.
  const projects = await listCampaignProjects(deps.doc, tableName, campaignId);
  const controlePorCasa = Object.fromEntries(houses.map((h) => [h.houseId, h.attributes.controle]));
  const briefings = briefingsDoPorto(projects, turn.turnId - 1, controlePorCasa);
  const { system, user } = buildPrivateInfoPrompt(houses, turn.publicEvent, { lore: worldBible?.lore, chronicle }, briefings);
  const privateInfo = await generateJson(deps.chat, system, user, parsePrivateInfo);
  // Só há segredo novo a proteger quando alguém comprou: fora disso, "rumor
  // falso" numa frase de clima é linguagem do mundo, não vazamento.
  if (briefings.length > 0 && findPrivateInfoLeaks(privateInfo).length > 0) {
    throw new HttpError(502, "AI_LEAKED_PRIVATE_CONTEXT", "A IA expôs a mecânica do Porto no texto das Casas. Gere novamente.");
  }
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
  const { system, user } = buildResolutionPrompt(turn, houses, submissions, {
    lore: worldBible?.lore, chronicle, worldFacts: await factsBlockFor(deps, tableName, campaignId),
  });
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
  const attributeChanges: Record<string, TurnAttributeChange[]> = {};
  for (const [houseId, delta] of Object.entries(body.attributeDeltas)) {
    const h = await getHouse(deps.doc, tableName, campaignId, houseId);
    if (!h) continue;
    const next: Attributes = { ...h.attributes };
    const changes: TurnAttributeChange[] = [];
    for (const k of ATTRIBUTE_KEYS) {
      const d = delta[k];
      if (typeof d === "number") {
        const before = h.attributes[k];
        const after = Math.max(0, Math.min(5, before + d));
        next[k] = after;
        if (after !== before) changes.push({ key: k, before, after });
      }
    }
    if (changes.length > 0) attributeChanges[houseId] = changes;
    await updateHouseAttributes(deps.doc, tableName, campaignId, houseId, next);
  }
  await saveTurnResult(deps.doc, tableName, campaignId, turn.turnId, {
    publicResult: body.publicResult,
    houseResults: body.houseResults,
    attributeDeltas: body.attributeDeltas,
    discoveries: body.discoveries,
    attributeChanges,
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
      getAlocacaoEnergia: (h, t) => getAlocacaoEnergia(deps.doc, tableName, campaignId, t, h),
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
  // O registro da campanha: extrai do texto que o Mestre acabou de escrever os
  // fatos que ninguém pode esquecer. Roda aqui, no fim, e nunca desfaz o turno
  // — uma falha da IA deixa o registro como estava e a resolução segue gravada.
  if (chat) {
    try {
      const houses = await listHouses(deps.doc, tableName, campaignId);
      const seatOfHouseId = (h: string) => SEATS.find((s) => s.name === houses.find((x) => x.houseId === h)?.name)?.key ?? null;
      const entrada = {
        turnNumber: turn.turnId,
        publicEvent: turn.publicEvent ?? "",
        publicResult: body.publicResult ?? "",
        houseResults: body.houseResults ?? {},
        seatOfHouseId,
      };

      // Uma chamada por bloco. Com o turno inteiro numa chamada só, o modelo
      // gastou o orçamento todo em raciocínio e devolveu nada em duas de três
      // tentativas — a entrada grande é que dispara isso. Cada bloco também já
      // sabe de quem é o segredo, então a visibilidade para de ser dedução.
      const novos: WorldFact[] = [];
      let descartadosTotal = 0;
      for (const bloco of turnBlocks(entrada)) {
        let raw = "";
        for (let tentativa = 0; tentativa < 2 && !raw.trim(); tentativa++) {
          raw = await chat(FACT_EXTRACTION_SYSTEM_PROMPT, buildFactExtractionUser(turn.turnId, bloco), true, 4000);
        }
        if (!raw.trim()) {
          console.warn(`Registro de fatos: bloco ${bloco.visibility} do turno ${turn.turnId} sem resposta do modelo.`);
          continue;
        }
        const { facts, descartados } = parseFacts(raw, {
          bloco, turnNumber: turn.turnId, campaignId,
          now: new Date().toISOString(),
          id: () => `wf-${turn.turnId}-${Math.random().toString(36).slice(2, 9)}`,
        });
        novos.push(...facts);
        descartadosTotal += descartados;
      }

      if (novos.length > 0) {
        // Idempotente: reaplicar o turno reescreve os fatos dele em vez de
        // empilhar uma segunda cópia de cada um.
        await deleteWorldFactsOfTurn(deps.doc, tableName, campaignId, turn.turnId);
        for (const f of novos) await putWorldFact(deps.doc, tableName, campaignId, f);
      }
      if (descartadosTotal > 0) {
        // Fato descartado é fato que o modelo não conseguiu ancorar no texto.
        console.warn(`Registro de fatos: ${descartadosTotal} descartados por citação que não confere, ${novos.length} gravados.`);
      }
    } catch (e) {
      console.error("Falha ao extrair fatos (turno segue aplicado):", (e as Error)?.message);
    }
  }

  // Relationship Engine: depois da resolução gravada, atualiza os NPCs que
  // tomaram conhecimento do que aconteceu. Roda aqui, no fim, e nunca desfaz o
  // turno: uma falha da IA deixa os NPCs como estavam e o turno segue aplicado.
  if (chat) {
    try {
      const houses = await listHouses(deps.doc, tableName, campaignId);
      const keyByHouseId = new Map(
        houses.map((h) => [h.houseId, SEATS.find((s) => s.name === h.name)?.key ?? null] as const),
      );
      const resolvedTurn = {
        ...turn,
        result: { publicResult: body.publicResult, houseResults: body.houseResults, discoveries: body.discoveries },
      } as Turn;
      await updateNpcWorld(
        {
          chat,
          getDynamic: (aff, id) => getNpcDynamic(deps.doc, tableName, campaignId, aff, id),
          putDynamic: (d) => putNpcDynamic(deps.doc, tableName, campaignId, d),
          houseKeyOf: (hid) => keyByHouseId.get(hid) ?? null,
          // Quem os jogadores procuraram entra na frente: o estado vivo só é
          // lido quando alguém escreve para aquele NPC, e ele estava sendo
          // gasto com líderes que quase ninguém procura.
          recentlyContacted: async () => {
            const msgs = await listAllMessages(deps.doc, tableName, campaignId);
            const chaves = new Set<string>();
            for (const m of msgs) {
              if (m.turnNumber >= turn.turnId - 1 && m.toCharacterId) {
                chaves.add(`${m.toHouseKey}:${m.toCharacterId}`);
              }
            }
            return chaves;
          },
          lastTouched: async () => {
            const rows = await dbListNpcDynamics(deps.doc, tableName, campaignId);
            return new Map(
              rows.map((d) => [
                `${d.affiliation}:${d.id}`,
                d.memory.reduce((max, m) => Math.max(max, m.turnNumber), 0),
              ]),
            );
          },
        },
        resolvedTurn,
      );
    } catch (e) {
      console.error("Falha no Relationship Engine (turno segue aplicado):", (e as Error)?.message);
    }
  }

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
