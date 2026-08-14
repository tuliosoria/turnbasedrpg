import {
  applyImpact,
  deriveWorldEvents,
  fullCodex,
  npcKnows,
  type NpcDynamic,
  type NpcIdentity,
  type Turn,
} from "@ravenloft/content";
import { IMPACT_SYSTEM_PROMPT, buildImpactUser, parseImpact } from "./impact";

export interface WorldUpdateDeps {
  chat: (system: string, user: string, json: boolean, maxTokens: number) => Promise<string>;
  getDynamic: (affiliation: string, id: string) => Promise<NpcDynamic>;
  putDynamic: (dynamic: NpcDynamic) => Promise<void>;
  houseKeyOf: (houseId: string) => string | null;
  now?: () => string;
}

export interface WorldUpdateResult {
  candidates: number;
  changed: number;
}

/**
 * O Relationship Engine, disparado quando um turno é aplicado.
 *
 * Não roda sobre os 200 NPCs: seleciona os que tomaram conhecimento de algum
 * fato deste turno (npcKnows) e só sobre eles pergunta ao modelo. Cada impacto
 * é validado e gravado, idempotente por (NPC, turno), para que reprocessar um
 * turno não empilhe mudança. Roda DEPOIS da resolução já estar gravada: uma
 * falha aqui não desfaz o turno.
 */
export async function updateNpcWorld(deps: WorldUpdateDeps, turn: Turn): Promise<WorldUpdateResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const events = deriveWorldEvents(turn, deps.houseKeyOf);
  if (events.length === 0) return { candidates: 0, changed: 0 };

  const codex: NpcIdentity[] = fullCodex();
  let changed = 0;
  const candidates: NpcIdentity[] = [];

  for (const npc of codex) {
    const known = events.filter((e) => npcKnows(npc, e, turn.turnId));
    if (known.length === 0) continue;
    candidates.push(npc);

    let dynamic = await deps.getDynamic(npc.affiliation, npc.id);
    // Não reprocessa o que já foi processado neste turno para este NPC.
    if (dynamic.memory.some((m) => m.turnNumber === turn.turnId)) continue;

    let raw: string;
    try {
      raw = await deps.chat(IMPACT_SYSTEM_PROMPT, buildImpactUser({ identity: npc, dynamic, events: known.map((e) => e.description) }), true, 600);
    } catch {
      // Uma falha num NPC não derruba os outros nem o turno.
      continue;
    }
    const impact = parseImpact(raw);
    if (!impact.affected) continue;

    dynamic = applyImpact(dynamic, impact, turn.turnId, now());
    await deps.putDynamic(dynamic);
    changed++;
  }

  return { candidates: candidates.length, changed };
}
