import { HOUSE_CHARACTERS, type HouseCharacter } from "../lore/characters.js";
import { LEADER_PERSONAS, type LeaderPersona } from "../diplomacy/leaders.js";
import { SEATS } from "../diplomacy/geography.js";
import { ROSTER_CODEX } from "./rosterCodex.js";

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
}

const slug = (name: string) =>
  name
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
    id: slug(p.leaderName),
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
 * As figuras têm role/description/wants/hides. É perfil intermediário: menos
 * que um líder, mais que um figurante. `hides` vira o segredo que ele guarda.
 */
export function identityFromCharacter(houseKey: string, c: HouseCharacter): NpcIdentity {
  return {
    id: slug(c.name),
    name: c.name,
    role: c.role,
    tier: "RELEVANT",
    affiliation: houseKey,
    location: seatSeat(houseKey),
    personality: c.description,
    speechStyle: "",
    values: "",
    fears: "",
    ambitions: c.wants,
    redLines: "",
    secrets: c.hides,
    roleplayGuidance: `Uma figura da ${seatName(houseKey)}. Fala por si, com a própria agenda.`,
  };
}

/**
 * O Codex que se deriva do cânone que já existe, sem geração de IA.
 *
 * O líder de cada Casa entra como Major; as demais figuras como Relevantes. O
 * roster expandido (Coroa, os 27 magos, generais) é gerado à parte por
 * `seed-npc-codex.mjs` e se soma a este — o líder aqui é o piso, não o teto.
 */
export function derivedCodex(): NpcIdentity[] {
  const out: NpcIdentity[] = [];
  const seen = new Set<string>();

  for (const [houseKey, persona] of Object.entries(LEADER_PERSONAS)) {
    const identity = identityFromPersona(houseKey, persona);
    out.push(identity);
    seen.add(`${houseKey}:${identity.id}`);
  }

  for (const [houseKey, cast] of Object.entries(HOUSE_CHARACTERS)) {
    for (const c of cast) {
      const id = slug(c.name);
      // O líder já entrou pela persona; não o duplique pela figura de mesmo nome.
      if (seen.has(`${houseKey}:${id}`)) continue;
      out.push(identityFromCharacter(houseKey, c));
      seen.add(`${houseKey}:${id}`);
    }
  }

  return out;
}

/**
 * O Codex inteiro: o derivado das Casas mais o roster gerado (Coroa, magos,
 * generais). O gerado tem prioridade quando um id colide — uma ficha autorada
 * é mais rica que a derivada.
 */
export function fullCodex(): NpcIdentity[] {
  const byId = new Map<string, NpcIdentity>();
  for (const n of derivedCodex()) byId.set(`${n.affiliation}:${n.id}`, n);
  for (const n of ROSTER_CODEX) byId.set(`${n.affiliation}:${n.id}`, n);
  return [...byId.values()];
}

/** Um NPC pela afiliação e pelo id, ou null. */
export function npcFor(affiliation: string, id: string): NpcIdentity | null {
  return fullCodex().find((n) => n.affiliation === affiliation && n.id === id) ?? null;
}

/** Os NPCs endereçáveis por carta: os Major, de Casa ou organização. */
export function addressableNpcs(): NpcIdentity[] {
  return fullCodex().filter((n) => n.tier === "MAJOR");
}

