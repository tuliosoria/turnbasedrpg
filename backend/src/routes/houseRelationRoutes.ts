import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { requireAdmin } from "../auth/adminAuth";
import { listHouseRelations, putHouseRelation } from "../db/houseRelations";
import { SEATS, clampRelationValue, describeRelation, emptyHouseRelation, relationKey } from "@ravenloft/content";

const seatKeys = new Set(SEATS.map((s) => s.key));

/**
 * A matriz que o Mestre edita.
 *
 * Devolve as dezesseis sedes e só os pares já definidos. O painel completa o
 * resto com o padrão — mandar 240 pares médios pela rede seria pagar banda para
 * transportar a ausência de informação.
 */
export async function adminListRelations(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const relations = await listHouseRelations(deps.doc, deps.config.tableName, deps.config.campaignId);
  return {
    status: 200,
    body: {
      seats: SEATS.map((s) => ({ key: s.key, name: s.name })),
      relations: relations.map((r) => ({ ...r, resumo: describeRelation(r) })),
    },
  };
}

export async function adminPutRelation(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromKey = typeof body.fromKey === "string" ? body.fromKey : "";
  const toKey = typeof body.toKey === "string" ? body.toKey : "";

  if (!seatKeys.has(fromKey) || !seatKeys.has(toKey)) {
    throw new HttpError(400, "INVALID_BODY", "Casa desconhecida no mapa.");
  }
  // Uma Casa não tem relação consigo mesma, e gravar isso encheria a matriz de
  // diagonal sem sentido.
  if (fromKey === toKey) {
    throw new HttpError(400, "INVALID_BODY", "Uma Casa não tem relação consigo mesma.");
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 600) : "";
  const saved = await putHouseRelation(deps.doc, deps.config.tableName, deps.config.campaignId, {
    ...emptyHouseRelation(fromKey, toKey),
    amizade: clampRelationValue(body.amizade),
    comercio: clampRelationValue(body.comercio),
    favores: clampRelationValue(body.favores),
    note,
  });

  return { status: 200, body: { ...saved, id: relationKey(fromKey, toKey), resumo: describeRelation(saved) } };
}
