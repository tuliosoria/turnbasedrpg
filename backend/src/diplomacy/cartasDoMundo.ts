import type { Deps } from "../routes/publicRoutes";
import type { DiplomaticMessage, Favor } from "@ravenloft/content";
import { listHouses } from "../db/houses";
import { listHouseRelations } from "../db/houseRelations";
import { listAllMessages, putMessage } from "../db/diplomacy/messages";
import { putFavor } from "../db/projects";
import { listWorldFacts } from "../db/worldFacts";
import { listTurns } from "../db/turns";
import { buildPublicChronicle } from "../ai/diplomacy/chronicle";
import { OUTREACH_DEADLINE_MS, sendOutreach } from "./sendOutreach";
import { montarDossie } from "../ai/diplomacy/dossie";
import { getNpcDynamic } from "../db/npcDynamic";
import { personaFor, characterId } from "@ravenloft/content";
import { publicObservations } from "../ai/diplomacy/publicObservation";

/** As cartas não solicitadas das Casas NPC, no momento em que o turno abre. */
export async function enviarCartasDoMundo(deps: Deps, turnId: number, publicEvent: string): Promise<number> {
  const { tableName, campaignId } = deps.config;
  const [houses, relations, mensagens, turns] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listHouseRelations(deps.doc, tableName, campaignId),
    listAllMessages(deps.doc, tableName, campaignId),
    listTurns(deps.doc, tableName, campaignId),
  ]);

  const enviadas = await sendOutreach({
    chat: deps.chatDiplomacia ?? deps.chat,
    houses: houses.map((h: { houseId: string; name: string }) => ({ houseId: h.houseId, name: h.name })),
    relations,
    publicEvent,
    publicObservations: publicObservations(turns.find((t) => t.turnId === turnId - 1), houses),
    // Conversa viva não recebe carta por cima: seria o NPC falando sozinho no
    // meio de um assunto que já está em andamento.
    alreadyTalking: new Set(
      mensagens.filter((m: DiplomaticMessage) => m.turnNumber === turnId).map((m: DiplomaticMessage) => `${m.fromHouseId}~${m.toHouseKey}`),
    ),
    turnNumber: turnId,
    campaignId,
    // Folga do worker de 900s: duas passadas por carta, e não é a rota que espera.
    deadlineMs: OUTREACH_DEADLINE_MS,
    dossieDe: (playerHouseId, seatKey) => montarDossie(deps.doc, tableName, campaignId, playerHouseId, seatKey),
    dynamicDe: async (seatKey) => {
      const p = personaFor(seatKey);
      return p ? getNpcDynamic(deps.doc, tableName, campaignId, seatKey, characterId(p.leaderName)) : null;
    },
    worldFacts: await listWorldFacts(deps.doc, tableName, campaignId),
    chronicle: buildPublicChronicle(turns),
    putMessage: (m: DiplomaticMessage) => putMessage(deps.doc, tableName, campaignId, m),
    putFavor: (f: Favor) => putFavor(deps.doc, tableName, campaignId, f),
    newId: () => `out-${turnId}-${Math.random().toString(36).slice(2, 10)}`,
  });
  return enviadas.length;
}
