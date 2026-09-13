import type { Deps } from "../routes/publicRoutes";
import type { DiplomaticMessage, Favor } from "@ravenloft/content";
import { listHouses } from "../db/houses";
import { listHouseRelations } from "../db/houseRelations";
import { listAllMessages, putMessage } from "../db/diplomacy/messages";
import { listSubmissions } from "../db/submissions";
import { putFavor } from "../db/projects";
import { listWorldFacts } from "../db/worldFacts";
import { sendOutreach } from "./sendOutreach";
import { montarDossie } from "../ai/diplomacy/dossie";

/** As cartas não solicitadas das Casas NPC, no momento em que o turno abre. */
export async function enviarCartasDoMundo(deps: Deps, turnId: number, publicEvent: string): Promise<number> {
  const { tableName, campaignId } = deps.config;
  const [houses, relations, mensagens, turnosAnteriores] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listHouseRelations(deps.doc, tableName, campaignId),
    listAllMessages(deps.doc, tableName, campaignId),
    listSubmissions(deps.doc, tableName, campaignId, turnId - 1),
  ]);

  const enviadas = await sendOutreach({
    chat: deps.chatDiplomacia ?? deps.chat,
    houses: houses.map((h: { houseId: string; name: string }) => ({ houseId: h.houseId, name: h.name })),
    relations,
    publicEvent,
    lastOrders: Object.fromEntries(turnosAnteriores.map((s: { houseId: string; orderText: string }) => [s.houseId, s.orderText])),
    // Conversa viva não recebe carta por cima: seria o NPC falando sozinho no
    // meio de um assunto que já está em andamento.
    alreadyTalking: new Set(
      mensagens.filter((m: DiplomaticMessage) => m.turnNumber === turnId).map((m: DiplomaticMessage) => `${m.fromHouseId}~${m.toHouseKey}`),
    ),
    turnNumber: turnId,
    campaignId,
    // Quinze minutos: duas passadas por carta, e não é a rota que espera.
    deadlineMs: 840_000,
    dossieDe: (playerHouseId, seatKey) => montarDossie(deps.doc, tableName, campaignId, playerHouseId, seatKey),
    worldFacts: await listWorldFacts(deps.doc, tableName, campaignId),
    putMessage: (m: DiplomaticMessage) => putMessage(deps.doc, tableName, campaignId, m),
    putFavor: (f: Favor) => putFavor(deps.doc, tableName, campaignId, f),
    newId: () => `out-${turnId}-${Math.random().toString(36).slice(2, 10)}`,
  });
  return enviadas.length;
}

