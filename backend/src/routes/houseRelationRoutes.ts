import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { requireAdmin } from "../auth/adminAuth";
import { listHouseRelations, putHouseRelation } from "../db/houseRelations";
import { RELATIONS_DOC, SEATS, clampRelationValue, describeRelation, emptyHouseRelation, findDivergence, relationKey, seatOf } from "@ravenloft/content";
import { relationsBetween } from "../ai/diplomacy/housePrompt";

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
      // Onde o passado e o presente discordam. Não é defeito — uma Casa pode ter
      // superado a ferida que a outra ainda cobra — mas o Mestre precisa ver a
      // divergência para saber se ela foi escolha ou esquecimento de um dial.
      relations: relations.map((r) => {
        const historia = relationsBetween(
          RELATIONS_DOC,
          seatOf(r.fromKey)?.name ?? r.fromKey,
          seatOf(r.toKey)?.name ?? r.toKey,
        ).join(" ");
        return { ...r, resumo: describeRelation(r), divergencia: findDivergence(r, historia) };
      }),
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
