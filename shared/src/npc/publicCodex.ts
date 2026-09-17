import { HOUSE_CHARACTERS } from "../lore/characters.js";
import { LEADER_PERSONAS } from "../diplomacy/leaders.js";
import { NPC_BIOGRAPHIES } from "../lore/biographies.js";
import { identityFromCharacter, identityFromPersona, type NpcIdentity, type NpcPublic } from "./identity.js";
import { ROSTER_CODEX } from "./rosterCodex.js";

export function toPublicNpc(n: NpcIdentity | NpcPublic): NpcPublic {
  return {
    id: n.id,
    name: n.name,
    role: n.role,
    tier: n.tier,
    affiliation: n.affiliation,
    location: n.location,
    personality: n.personality,
    speechStyle: n.speechStyle,
    values: n.values,
    ...(n.biography ? { biography: n.biography } : {}),
  };
}

/**
 * O elenco público: as mesmas pessoas do Codex, sem o que só o Mestre lê.
 *
 * Montado a partir do elenco público das Casas e do roster sem overlay do
 * Mestre. Não importa `fullCodex` nem os arquivos de segredo, para o bundle do
 * jogador não carregar Alic, Kaelen ou Karasoy por acidente.
 */
export function publicCodex(): NpcPublic[] {
  const byId = new Map<string, NpcPublic>();

  for (const [houseKey, persona] of Object.entries(LEADER_PERSONAS)) {
    const identity = toPublicNpc(identityFromPersona(houseKey, persona));
    byId.set(`${houseKey}:${identity.id}`, identity);
  }

  for (const [houseKey, cast] of Object.entries(HOUSE_CHARACTERS)) {
    for (const c of cast) {
      const identity = toPublicNpc(identityFromCharacter(houseKey, c));
      const key = `${houseKey}:${identity.id}`;
      if (byId.has(key)) continue;
      byId.set(key, identity);
    }
  }

  for (const n of ROSTER_CODEX) byId.set(`${n.affiliation}:${n.id}`, n);

  return [...byId.entries()].map(([key, n]) => {
    const biography = NPC_BIOGRAPHIES[key];
    return biography ? { ...n, biography } : n;
  });
}
