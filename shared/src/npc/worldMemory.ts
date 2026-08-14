/**
 * World Memory: o que aconteceu, e quem sabe.
 *
 * Sem controle de conhecimento os NPCs viram uma hivemind — um sacerdote em
 * Porto Cinzento passaria a odiar Alic no instante em que ele ordena, em
 * segredo, um ataque a Ninho Alto. `npcKnows` é o que impede isso: resolve se
 * um fato já chegou a um NPC, a partir de a quem ele era visível e de quão
 * rápido se espalha.
 */

/** A quem um fato é visível na origem. */
export type Visibility =
  | "PUBLICO"
  | `CASA:${string}`
  | `ORG:${string}`
  | `NPC:${string}`
  | "GM";

/** Quão rápido um fato se espalha para além de quem já sabia. */
export type Propagation = "IMEDIATO" | "RUMOR" | "MENSAGEIROS" | "CORVOS" | "DESCONHECIDO";

/** Um fato do mundo, com o que governa quem toma conhecimento dele. */
export interface WorldEvent {
  id: string;
  turnNumber: number;
  description: string;
  visibility: Visibility;
  propagation: Propagation;
}

/** Uma entrada de memória de um NPC: por que ele pensa como pensa. */
export interface NpcMemoryEntry {
  turnNumber: number;
  description: string;
  /** Um resumo curto do efeito ("−15 confiança em Solarion"), para o roleplay. */
  impact: string;
}

/**
 * Deriva os fatos do mundo de um turno, do que o GM já escreve.
 *
 * Evita uma tela nova de tagueamento: o evento público vira PUBLICO/IMEDIATO;
 * a informação privada de cada Casa vira um segredo daquela Casa que vaza por
 * mensageiros; o resultado público e as descobertas voltam a ser públicos. O
 * GM refina visibilidade e propagação depois; isto é o piso.
 */
export function deriveWorldEvents(
  turn: {
    turnId: number;
    publicEvent?: string;
    privateInfo?: Record<string, string>;
    result?: { publicResult?: string; discoveries?: string[] } | null;
  },
  houseKeyOf: (houseId: string) => string | null,
): WorldEvent[] {
  const events: WorldEvent[] = [];
  const push = (suffix: string, description: string, visibility: Visibility, propagation: Propagation) => {
    if (description.trim()) {
      events.push({ id: `t${turn.turnId}-${suffix}`, turnNumber: turn.turnId, description: description.trim(), visibility, propagation });
    }
  };

  push("public", turn.publicEvent ?? "", "PUBLICO", "IMEDIATO");
  for (const [houseId, info] of Object.entries(turn.privateInfo ?? {})) {
    const key = houseKeyOf(houseId);
    if (key) push(`priv-${key}`, info, `CASA:${key}`, "MENSAGEIROS");
  }
  if (turn.result) {
    push("result", turn.result.publicResult ?? "", "PUBLICO", "IMEDIATO");
    (turn.result.discoveries ?? []).forEach((d, i) => push(`disc-${i}`, d, "PUBLICO", "RUMOR"));
  }
  return events;
}

/**
 * Turnos até um fato vazar para quem não estava no círculo inicial.
 *
 * Faixas, não simulação física: a spec começa simples. DESCONHECIDO nunca
 * chega; IMEDIATO é conhecimento imediato.
 */
const DELAY: Record<Propagation, number> = {
  IMEDIATO: 0,
  MENSAGEIROS: 1,
  CORVOS: 1,
  RUMOR: 2,
  DESCONHECIDO: Number.POSITIVE_INFINITY,
};

/** Quem estava no círculo inicial do fato, na origem. */
export function inAudience(npc: { affiliation: string; id: string }, visibility: Visibility): boolean {
  if (visibility === "GM") return false;
  if (visibility === "PUBLICO") return true;
  const [kind, key] = visibility.split(":");
  if (kind === "CASA" || kind === "ORG") return npc.affiliation === key;
  if (kind === "NPC") return npc.id === key;
  return false;
}

/**
 * Um NPC sabe deste fato no turno atual?
 *
 * Segredo do GM nunca chega a um NPC. Quem estava no círculo inicial sabe desde
 * a origem. Os de fora só sabem depois do atraso da propagação — e nunca, se o
 * fato é DESCONHECIDO (ainda não se espalhou).
 */
export function npcKnows(
  npc: { affiliation: string; id: string },
  event: Pick<WorldEvent, "visibility" | "propagation" | "turnNumber">,
  currentTurn: number,
): boolean {
  if (event.visibility === "GM") return false;
  if (currentTurn < event.turnNumber) return false;
  if (inAudience(npc, event.visibility)) return true;
  const delay = DELAY[event.propagation];
  return currentTurn >= event.turnNumber + delay;
}
