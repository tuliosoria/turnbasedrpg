import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { getHouse, updateHouseAttributes } from "../db/houses";
import { getActiveTurn } from "../db/turns";
import { listHouseSpyOps, listAllSpyOps, putSpyOp } from "../db/spyOps";
import { parseSpyStartBody, parseSpyResolveBody } from "../validation/schemas";
import {
  SPY_TIERS,
  canAffordSpy,
  seatOf,
  spyCost,
  type SpyOperation,
} from "@ravenloft/content";

function newId(): string {
  return `spy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** O que a Casa mandou investigar, e o que já voltou. */
export async function listSpyOps(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const ops = await listHouseSpyOps(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  return {
    status: 200,
    body: {
      // Os níveis viajam junto para a tela não guardar cópia própria dos preços
      // e do que acontece se der certo ou errado — duas verdades divergiriam.
      tiers: Object.values(SPY_TIERS),
      operations: ops.sort((a, b) => b.turnNumber - a.turnNumber || b.createdAt.localeCompare(a.createdAt)),
    },
  };
}

/**
 * Contrata uma operação: cobra na hora e grava.
 *
 * Cobrar só na resolução deixaria a Casa contratar dez operações com Recurso
 * para uma — e descobrir a conta no turno seguinte, quando não dá mais para
 * escolher.
 */
export async function startSpyOp(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { question, level, targetKey } = parseSpyStartBody(req.body);
  const { tableName, campaignId } = deps.config;

  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn || turn.status !== "OPEN") {
    throw new HttpError(409, "BAD_STATUS", "O turno precisa estar aberto para mandar alguém perguntar.");
  }
  if (targetKey && !seatOf(targetKey)) {
    throw new HttpError(400, "INVALID_BODY", "Alvo desconhecido no mapa.");
  }

  const house = await getHouse(deps.doc, tableName, campaignId, player.houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");

  const pode = canAffordSpy(house.attributes, level);
  if (!pode.ok) throw new HttpError(409, "BAD_STATUS", pode.reason ?? "Recursos insuficientes.");

  const custo = spyCost(level);
  await updateHouseAttributes(deps.doc, tableName, campaignId, player.houseId, {
    ...house.attributes,
    recursos: house.attributes.recursos - custo.recursos,
    riqueza: house.attributes.riqueza - custo.riqueza,
  });

  const op: SpyOperation = {
    id: newId(),
    campaignId,
    houseId: player.houseId,
    turnNumber: turn.turnId,
    question,
    level,
    targetKey,
    status: "EM_CURSO",
    outcome: null,
    report: "",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  await putSpyOp(deps.doc, tableName, campaignId, op);
  return { status: 201, body: op };
}

/** A fila do Mestre: tudo que as Casas mandaram perguntar. */
export async function adminListSpyOps(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const ops = await listAllSpyOps(deps.doc, deps.config.tableName, deps.config.campaignId);
  return {
    status: 200,
    body: {
      tiers: Object.values(SPY_TIERS),
      operations: ops.sort((a, b) => b.turnNumber - a.turnNumber || b.createdAt.localeCompare(a.createdAt)),
    },
  };
}

/**
 * O Mestre diz o que a Casa descobriu — ou o que deu errado.
 *
 * O desfecho é dele e não de um dado: o valor de uma operação depende do que
 * existe para achar, e só o Mestre sabe se o que foi perguntado tem resposta.
 */
export async function resolveSpyOp(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { id, outcome, report } = parseSpyResolveBody(req.body);
  const { tableName, campaignId } = deps.config;

  const todas = await listAllSpyOps(deps.doc, tableName, campaignId);
  const op = todas.find((o) => o.id === id);
  if (!op) return { status: 404, body: { code: "NOT_FOUND", message: "Operação não encontrada." } };
  if (op.status === "RESOLVIDA") {
    throw new HttpError(409, "BAD_STATUS", "Esta operação já foi resolvida.");
  }

  const resolvida: SpyOperation = {
    ...op,
    status: "RESOLVIDA",
    outcome,
    report,
    resolvedAt: new Date().toISOString(),
  };
  await putSpyOp(deps.doc, tableName, campaignId, resolvida);
  return { status: 200, body: resolvida };
}
