import type { DiplomaticMessage, Favor } from "@ravenloft/content";
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
  /** Grava a proposta como favor pendente, para o jogador aceitar ou recusar. */
  putFavor?: (f: Favor) => Promise<void>;
  newId: () => string;
  limit?: number;
  /**
   * Quanto tempo, no total, as cartas podem levar.
   *
   * O gateway corta em 30 segundos e um modelo de raciocínio leva ~15 por
   * carta. Se estourar, abandonamos as cartas: o turno já está aberto, e um
   * mundo calado é melhor que um Mestre olhando para um erro.
   */
  deadlineMs?: number;
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
  // Em paralelo por necessidade, não por elegância: um modelo de raciocínio
  // leva ~15s por carta, e três em série estouram os 30 segundos do gateway.
  const escrita = Promise.all(
    planos.map(async (plan) => ({
      plan,
      texto: await escrever(deps, plan, relacaoDe.get(`${plan.fromSeatKey}~${plan.toHouseId}`) ?? null),
    })),
  );
  const cartas = await Promise.race([
    escrita,
    new Promise<null>((r) => setTimeout(() => r(null), deps.deadlineMs ?? 20000)),
  ]);
  if (!cartas) return [];

  const enviadas: DiplomaticMessage[] = [];
  for (const { plan, texto: carta } of cartas) {
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
      body: clampMessage(carta.texto),
      replyToId: null,
      toCharacterId: null,
      createdAt: new Date().toISOString(),
    };
    await deps.putMessage(message);
    enviadas.push(message);

    // A proposta vira dívida pendente no razão. O jogador aceita ou recusa; a
    // IA propõe, o consentimento é que cria o registro.
    if (deps.putFavor && carta.oferta && carta.pedido) {
      const agora = new Date().toISOString();
      await deps.putFavor({
        id: `${message.id}-favor`,
        campaignId: deps.campaignId,
        fromHouseId: plan.fromSeatKey,
        toHouseId: plan.toHouseId,
        amount: 1,
        status: "PENDING",
        reason: `${plan.fromSeatName} oferece ${carta.oferta} e pede ${carta.pedido}.`,
        createdAt: agora,
        updatedAt: agora,
      });
    }
  }
  return enviadas;
}

interface CartaEscrita {
  texto: string;
  oferta: string;
  pedido: string;
}

async function escrever(
  deps: OutreachDeps,
  plan: OutreachPlan,
  relation: OutreachDeps["relations"][number] | null,
): Promise<CartaEscrita | null> {
  try {
    const user = buildOutreachUser({
      plan,
      relation: relation as never,
      publicEvent: deps.publicEvent,
      lastOrder: deps.lastOrders[plan.toHouseId] ?? "",
    });
    const raw = await deps.chat!(OUTREACH_SYSTEM_PROMPT, user, true, 900);
    const o = JSON.parse(raw) as Record<string, unknown>;
    const texto = typeof o.carta === "string" ? o.carta.trim() : "";
    if (texto.length <= 40) return null;
    return {
      texto,
      oferta: typeof o.oferta === "string" ? o.oferta.trim().slice(0, 120) : "",
      pedido: typeof o.pedido === "string" ? o.pedido.trim().slice(0, 120) : "",
    };
  } catch {
    // Modelo fora do ar ou JSON quebrado: esta carta não sai, as outras saem.
    return null;
  }
}
