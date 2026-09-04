import { clampVisualText } from "../visual/models.js";

export const MESSAGE_AUTHORS = ["PLAYER", "AI"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];

export const MESSAGE_MAX = 3000;

/** Uma carta entre duas Casas, ou a resposta a ela. */
export interface DiplomaticMessage {
  id: string;
  campaignId: string;
  turnNumber: number;
  /** Casa do jogador remetente (id da Casa viva). */
  fromHouseId: string;
  /** Casa destinatária, chave canônica de geography.ts. */
  toHouseKey: string;
  author: MessageAuthor;
  body: string;
  replyToId: string | null;
  /**
   * Pessoa a quem a carta foi endereçada, ou null para a chancelaria da Casa.
   *
   * A chave da mensagem não muda por causa disto: todas as cartas a uma Casa
   * ficam sob o mesmo par, para o orçamento de mensageiros seguir sendo por
   * Casa. Os fios por pessoa saem de agrupar por este campo.
   */
  toCharacterId: string | null;
  createdAt: string;
}

export const FACT_KINDS = ["ALIANCA", "ACORDO", "PROMESSA", "AMEACA", "RECUSA", "PEDIDO"] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_STATUSES = ["ATIVO", "REVOGADO"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/**
 * Um fato desta partida, extraído da correspondência.
 *
 * Deliberadamente separado do wiki. O wiki é cânone do mundo e vale para
 * qualquer campanha; uma aliança firmada no turno 3 é o que aconteceu nesta
 * mesa. Se morassem no mesmo lugar, uma promessa quebrada viraria verdade
 * permanente de Valdren e uma campanha nova nasceria contaminada.
 */
export interface CampaignFact {
  id: string;
  campaignId: string;
  turnNumber: number;
  kind: FactKind;
  /**
   * Casa do jogador. O razão é centrado nela de propósito.
   *
   * Um fato entre terceiros não cabe aqui, mesmo quando o jogador ficou sabendo
   * dele: "Karasoy prometeu tropas à Coroa" é cânone do mundo e pertence ao
   * texto do turno. Registrar isso no par Solarion↔Karasoy porque a carta que o
   * contou foi endereçada a Solarion confunde quem lê — a carta é onde se
   * contou, não onde a promessa foi feita.
   */
  betweenA: string;
  /** Casa destinatária, chave canônica. */
  betweenB: string;
  summary: string;
  /** De qual mensagem veio. Sem isto o registro não é auditável. */
  sourceMessageId: string;
  status: FactStatus;
  createdAt: string;
}

export function isFactKind(v: unknown): v is FactKind {
  return typeof v === "string" && (FACT_KINDS as readonly string[]).includes(v);
}

export function clampMessage(v: unknown): string {
  return clampVisualText(v, MESSAGE_MAX);
}

export interface NewMessageInput {
  id: string;
  campaignId: string;
  turnNumber: number;
  fromHouseId: string;
  toHouseKey: string;
  author: MessageAuthor;
  body: string;
  replyToId?: string | null;
  toCharacterId?: string | null;
}

export function newMessage(input: NewMessageInput): DiplomaticMessage {
  return {
    id: input.id,
    campaignId: input.campaignId,
    turnNumber: input.turnNumber,
    fromHouseId: input.fromHouseId,
    toHouseKey: input.toHouseKey,
    author: input.author,
    body: clampMessage(input.body),
    replyToId: input.replyToId ?? null,
    toCharacterId: input.toCharacterId ?? null,
    createdAt: new Date().toISOString(),
  };
}

/** Chave estável de um par, independente da ordem. */
export function pairKey(houseId: string, houseKey: string): string {
  return `${houseId}~${houseKey}`;
}

/**
 * Quantos envios o jogador ainda tem para esta Casa neste turno.
 *
 * Só mensagens do jogador contam; respostas da IA são consequência, não custo.
 *
 * E quem é procurado tem DIREITO DE RESPOSTA. O orçamento nasceu para limitar
 * quem PUXA conversa — Solarion fica a catorze dias de Ninho Alto, e um envio
 * por turno é o preço da distância. Mas ele estava calando também quem foi
 * abordado: a Casa Euralune escreveu a Solarion, Solarion respondeu, Euralune
 * respondeu de volta, e o jogador ficou sem poder dizer nada até o turno virar.
 * Levar uma carta e não poder responder não é distância; é mordaça.
 *
 * O direito vale UMA vez por turno e por par, independente de quantas cartas a
 * outra Casa mandar — senão dois lados conversando de graça esvaziam o
 * orçamento inteiro.
 */
export function sendsRemaining(messages: DiplomaticMessage[], budgetSends: number): number {
  const used = messages.filter((m) => m.author === "PLAYER").length;
  const foiProcurado = messages.some((m) => m.author === "AI");
  return Math.max(0, budgetSends + (foiProcurado ? 1 : 0) - used);
}
