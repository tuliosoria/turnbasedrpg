import { characterId, type HouseCharacter, type HouseFigure } from "../lore/characters.js";
import type { LeaderPersona } from "../diplomacy/leaders.js";
import { SEATS } from "../diplomacy/geography.js";

/**
 * O NPC Codex: quem cada personagem é.
 *
 * Identidade é canon e muda quase nunca. Um ataque a Ninho Alto não torna
 * alguém reservado em impulsivo — o que muda é a opinião dele sobre quem
 * atacou, e isso é Estado e Relações (World Memory / Relationship Engine),
 * nunca Identidade. Por isso o Codex vive aqui, em `shared`, e não no banco.
 */

export type NpcTier = "MAJOR" | "RELEVANT" | "MINOR";

/**
 * A afiliação de um NPC. Uma Casa, uma organização (Ordem dos Três, Corvos) ou
 * a Coroa — pela chave. É por ela que a conversa acha o destinatário e o
 * orçamento de mensageiros mede a distância.
 */
export interface NpcIdentity {
  id: string;
  name: string;
  role: string;
  tier: NpcTier;
  /** Chave da Casa, organização ou Coroa a que pertence. */
  affiliation: string;
  /** Onde costuma estar, para o orçamento de mensageiros. */
  location: string;
  personality: string;
  speechStyle: string;
  values: string;
  fears: string;
  ambitions: string;
  /** O que ele nunca aceita — as linhas vermelhas. */
  redLines: string;
  /** Só o GM vê; nunca entregue numa conversa. */
  secrets: string;
  /** Como a IA deve interpretá-lo. */
  roleplayGuidance: string;
  /**
   * A história do personagem, em prosa, para a ficha pública. Autorada em
   * `lore/biographies.ts` e sobreposta por `fullCodex`, porque o cânone
   * derivado das Casas só carrega uma linha de descrição.
   */
  biography?: string;
}

/** O que uma ficha de jogador pode mostrar. Sem secrets nem orientação de cena. */
export type NpcPublic = Omit<
  NpcIdentity,
  "secrets" | "fears" | "ambitions" | "redLines" | "roleplayGuidance"
>;

const seatName = (key: string) => SEATS.find((s) => s.key === key)?.name ?? key;
const seatSeat = (key: string) => SEATS.find((s) => s.key === key)?.seat ?? "";

/**
 * O líder de uma Casa, promovido de LEADER_PERSONAS a Major NPC.
 *
 * Os dezesseis líderes já têm persona política rica — temperamento, voz,
 * postura com a Coroa. Entram no Codex sem reautorar: a persona é a semente da
 * identidade, e distrusts/trusts serão a semente das Relações no Engine 3.
 */
export function identityFromPersona(houseKey: string, p: LeaderPersona): NpcIdentity {
  return {
    id: characterId(p.leaderName),
    name: p.leaderName,
    role: p.title,
    tier: "MAJOR",
    affiliation: houseKey,
    location: seatSeat(houseKey),
    personality: p.temperament,
    speechStyle: p.speechStyle,
    values: p.interests,
    fears: "",
    ambitions: p.wants,
    redLines: p.refuses,
    secrets: "",
    roleplayGuidance: `Responde pela ${seatName(houseKey)}. Postura com a Coroa: ${p.crownStance}`,
  };
}

/**
 * Uma figura do elenco de uma Casa, promovida a NPC Relevante.
 *
 * As figuras têm role/description, e no roster completo também wants/hides.
 * `hides` vira o segredo que ele guarda.
 */
export function identityFromCharacter(
  houseKey: string,
  c: HouseFigure | HouseCharacter,
): NpcIdentity {
  const wants = "wants" in c ? c.wants : "";
  const hides = "hides" in c ? c.hides : "";
  return {
    id: characterId(c.name),
    name: c.name,
    role: c.role,
    tier: "RELEVANT",
    affiliation: houseKey,
    location: seatSeat(houseKey),
    personality: c.description,
    speechStyle: "",
    values: "",
    fears: "",
    ambitions: wants,
    redLines: "",
    secrets: hides,
    roleplayGuidance: `Uma figura da ${seatName(houseKey)}. Fala por si, com a própria agenda.`,
  };
}

/**
 * A sede pela qual um NPC é alcançado por carta.
 *
 * A afiliação quase sempre já é uma sede — as Casas e as ordens são sedes no
 * mapa. A exceção é a Coroa: "coroa" não é uma sede, mas a Coroa senta em
 * Asterhall, que é a sede de Casa Valerius. Assim o orçamento de mensageiros
 * mede a distância real, sem inventar geografia nova.
 */
export function seatKeyForAffiliation(affiliation: string): string {
  if (affiliation === "coroa") return "casa-valerius";
  return affiliation;
}

export function emptyGmFields(): Pick<
  NpcIdentity,
  "secrets" | "fears" | "ambitions" | "redLines" | "roleplayGuidance"
> {
  return { secrets: "", fears: "", ambitions: "", redLines: "", roleplayGuidance: "" };
}
