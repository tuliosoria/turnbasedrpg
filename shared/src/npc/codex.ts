import { HOUSE_CHARACTERS } from "../lore/characters.js";
import { houseRoster } from "../lore/characterSecrets.js";
import { LEADER_PERSONAS } from "../diplomacy/leaders.js";
import { NPC_BIOGRAPHIES } from "../lore/biographies.js";
import {
  emptyGmFields,
  identityFromCharacter,
  identityFromPersona,
  seatKeyForAffiliation,
  type NpcIdentity,
} from "./identity.js";
import { ROSTER_CODEX } from "./rosterCodex.js";
import { ROSTER_SECRETS } from "./rosterSecrets.js";

export {
  identityFromCharacter,
  identityFromPersona,
  seatKeyForAffiliation,
  type NpcIdentity,
  type NpcPublic,
  type NpcTier,
} from "./identity.js";

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

  for (const houseKey of Object.keys(HOUSE_CHARACTERS)) {
    for (const c of houseRoster(houseKey)) {
      const identity = identityFromCharacter(houseKey, c);
      // O líder já entrou pela persona; não o duplique pela figura de mesmo nome.
      if (seen.has(`${houseKey}:${identity.id}`)) continue;
      out.push(identity);
      seen.add(`${houseKey}:${identity.id}`);
    }
  }

  return out;
}

function withBiography(key: string, n: NpcIdentity): NpcIdentity {
  const biography = NPC_BIOGRAPHIES[key];
  return biography ? { ...n, biography } : n;
}

/**
 * O Codex inteiro: o derivado das Casas mais o roster gerado (Coroa, magos,
 * generais). O gerado tem prioridade quando um id colide — uma ficha autorada
 * é mais rica que a derivada.
 */
export function fullCodex(): NpcIdentity[] {
  const byId = new Map<string, NpcIdentity>();
  for (const n of derivedCodex()) byId.set(`${n.affiliation}:${n.id}`, n);
  for (const n of ROSTER_CODEX) {
    const key = `${n.affiliation}:${n.id}`;
    const extra = ROSTER_SECRETS[key] ?? emptyGmFields();
    byId.set(key, { ...n, ...extra });
  }
  // A biografia é autorada à parte e sobreposta aqui para valer tanto no
  // cânone derivado das Casas quanto no roster.
  return [...byId.entries()].map(([key, n]) => withBiography(key, n));
}

/** Um NPC pela afiliação e pelo id, ou null. */
export function npcFor(affiliation: string, id: string): NpcIdentity | null {
  return fullCodex().find((n) => n.affiliation === affiliation && n.id === id) ?? null;
}

/** Os NPCs endereçáveis por carta: os Major, de Casa ou organização. */
export function addressableNpcs(): NpcIdentity[] {
  return fullCodex().filter((n) => n.tier === "MAJOR");
}

/** Os Major NPCs alcançáveis por uma sede — para listar como destinatários. */
export function codexBySeat(seatKey: string): NpcIdentity[] {
  return addressableNpcs().filter((n) => seatKeyForAffiliation(n.affiliation) === seatKey);
}

/** Um Major NPC pela sede que o alcança e pelo id. */
export function codexNpcBySeatAndId(seatKey: string, id: string): NpcIdentity | null {
  return codexBySeat(seatKey).find((n) => n.id === id) ?? null;
}
