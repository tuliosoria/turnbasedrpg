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
  /**
   * Quem escreveu, quando o remetente é outro JOGADOR.
   *
   * Numa carta a NPC isto é null e `author` basta: PLAYER é o dono do fio, AI é
   * a Casa do outro lado. Entre dois jogadores esse par não distingue nada —
   * as duas pontas são PLAYER, e os dois leem o mesmo registro. Aqui fica o
   * houseId de quem escreveu, e é ele que decide de que lado da tela a carta
   * aparece para cada um.
   */
  fromPlayerHouseId?: string | null;
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
  /** Quem escreveu, quando o remetente é outro jogador. */
  fromPlayerHouseId?: string | null;
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
    fromPlayerHouseId: input.fromPlayerHouseId ?? null,
    createdAt: new Date().toISOString(),
  };
}

/** Chave estável de um par, independente da ordem. */
export function pairKey(houseId: string, houseKey: string): string {
  return `${houseId}~${houseKey}`;
}

/**
 * A chave do fio entre dois JOGADORES.
 *
 * O par normal é (id da Casa viva, sede do NPC), e cada jogador só enxerga o
 * seu lado. Entre dois jogadores isso não funciona: Solarion gravaria em
 * `solarion-k0hc~casa-khazdrun` e Khazdrun procuraria em
 * `khazdrun-wxey~casa-solarion` — a mesma carta, duas chaves, e cada um
 * enxergando um fio vazio.
 *
 * Ordenar as duas SEDES dá uma chave que os dois lados calculam igual, então
 * existe um registro só e ele é a verdade. A alternativa era gravar duas
 * cópias, e cópia que diverge em silêncio é o bug que este projeto já pagou
 * caro para aprender.
 */
export function playerPairKey(seatA: string, seatB: string): string {
  return [seatA, seatB].sort().join("|");
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
export function sendsRemaining(
  messages: DiplomaticMessage[],
  budgetSends: number,
  /** Quem está perguntando. Só é preciso no fio entre dois jogadores. */
  ownHouseId?: string,
): number {
  // Num fio entre jogadores as duas pontas são PLAYER, então "quem escreveu"
  // deixa de ser o autor e passa a ser a Casa. Sem isto, a carta que o outro
  // jogador manda debitaria do orçamento de quem a recebeu.
  const minha = (m: DiplomaticMessage) =>
    m.fromPlayerHouseId ? m.fromPlayerHouseId === ownHouseId : m.author === "PLAYER";
  const used = messages.filter(minha).length;
  const foiProcurado = messages.some((m) => !minha(m));
  return Math.max(0, budgetSends + (foiProcurado ? 1 : 0) - used);
}
