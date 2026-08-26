import type { DiplomaticMessage } from "@ravenloft/content";
import { clampMessage, seatKeyForHouseId } from "@ravenloft/content";
import { planOutreach, type OutreachPlan } from "../ai/diplomacy/outreach";
import { buildOutreachUser, OUTREACH_SYSTEM_PROMPT } from "../ai/diplomacy/outreachPrompt";

export interface OutreachDeps {
  chat?: (system: string, user: string, json: boolean, maxTokens: number) => Promise<string>;
  houses: { houseId: string; name: string }[];
  relations: { fromKey: string; toKey: string; amizade: number; comercio: number; favores: number; note: string; updatedAt: string }[];
  publicEvent: string;
  lastOrders: Record<string, string>;
  alreadyTalking: Set<string>;
  turnNumber: number;
  campaignId: string;
  putMessage: (m: DiplomaticMessage) => Promise<void>;
  newId: () => string;
  limit?: number;
}

/**
 * As cartas que o mundo escreve sozinho, quando o turno abre.
 *
 * Antes disto a diplomacia era um monólogo: nenhuma Casa NPC jamais procurava
 * um jogador, então quem não escrevia primeiro nunca recebia nada. A carta é
 * gravada no mesmo fio da conversa (jogador, Casa), então aparece onde o
 * jogador já sabe olhar.
 *
 * Falha de IA não derruba a abertura do turno: se uma carta não sai, as outras
 * saem, e se nenhuma sai o turno abre do mesmo jeito. Um mundo silencioso é
 * pior que um mundo vivo, mas é muito melhor que um turno que não abre.
 */
export async function sendOutreach(deps: OutreachDeps): Promise<DiplomaticMessage[]> {
  if (!deps.chat) return [];

  const players = deps.houses.map((h) => ({
    houseId: h.houseId,
    name: h.name,
    seatKey: seatKeyForHouseId(h.name) ?? seatKeyForHouseId(h.houseId),
  }));
  const playerSeatKeys = new Set(players.map((p) => p.seatKey).filter((k): k is string => !!k));

  const planos = planOutreach({
    players,
    playerSeatKeys,
    relations: deps.relations as never,
    publicEvent: deps.publicEvent,
    lastOrders: deps.lastOrders,
    alreadyTalking: deps.alreadyTalking,
    limit: deps.limit ?? 3,
  });

  const relacaoDe = new Map(deps.relations.map((r) => [`${r.fromKey}~${r.toKey}`, r]));
  const enviadas: DiplomaticMessage[] = [];

  for (const plan of planos) {
    const carta = await escrever(deps, plan, relacaoDe.get(`${plan.fromSeatKey}~${plan.toHouseId}`) ?? null);
    if (!carta) continue;
    const message: DiplomaticMessage = {
      id: deps.newId(),
      campaignId: deps.campaignId,
      turnNumber: deps.turnNumber,
      // O fio é sempre (Casa do jogador, Casa NPC), mesmo quando quem começa é
      // o NPC: assim a carta cai onde o jogador já procura correspondência.
      fromHouseId: plan.toHouseId,
      toHouseKey: plan.fromSeatKey,
      author: "AI",
      body: clampMessage(carta),
      replyToId: null,
      toCharacterId: null,
      createdAt: new Date().toISOString(),
    };
    await deps.putMessage(message);
    enviadas.push(message);
  }
  return enviadas;
}

async function escrever(
  deps: OutreachDeps,
  plan: OutreachPlan,
  relation: OutreachDeps["relations"][number] | null,
): Promise<string | null> {
  try {
    const user = buildOutreachUser({
      plan,
      relation: relation as never,
      publicEvent: deps.publicEvent,
      lastOrder: deps.lastOrders[plan.toHouseId] ?? "",
    });
    const raw = await deps.chat!(OUTREACH_SYSTEM_PROMPT, user, false, 600);
    const texto = raw.trim();
    return texto.length > 40 ? texto : null;
  } catch {
    return null;
  }
}
