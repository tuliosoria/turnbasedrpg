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
  /** Teto de NPCs por turno; o padrão serve, o teste usa outro. */
  maxNpcs?: number;
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
/** Quantos NPCs ganham estado vivo novo por turno. */
export const MAX_NPCS_POR_TURNO = 20;

export async function updateNpcWorld(deps: WorldUpdateDeps, turn: Turn): Promise<WorldUpdateResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const events = deriveWorldEvents(turn, deps.houseKeyOf);
  if (events.length === 0) return { candidates: 0, changed: 0 };

  const codex: NpcIdentity[] = fullCodex();
  let changed = 0;
  const candidates: NpcIdentity[] = [];

  // Um teto por turno, e não os noventa do Codex.
  //
  // As duas defesas que já existiam — só entra quem soube de algo, e ninguém é
  // reprocessado no mesmo turno — não limitam o pior caso: um evento que toca
  // todo mundo vira noventa chamadas de IA numa aplicação de turno. Quem sabe
  // de mais coisas entra primeiro; o resto espera o turno em que for relevante,
  // e nada se perde porque o estado vivo é reconstruído quando alguém escreve.
  const porRelevancia = codex
    .map((npc) => ({ npc, known: events.filter((e) => npcKnows(npc, e, turn.turnId)) }))
    .filter((x) => x.known.length > 0)
    .sort((a, b) => b.known.length - a.known.length)
    .slice(0, deps.maxNpcs ?? MAX_NPCS_POR_TURNO);

  for (const { npc, known } of porRelevancia) {
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
