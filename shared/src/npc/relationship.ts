import type { NpcMemoryEntry } from "./worldMemory.js";
import type { LeaderPersona } from "../diplomacy/leaders.js";

/**
 * Relationship Engine: como o que aconteceu mudou as relações.
 *
 * Relação não é `gosta: 57`. É multidimensional, porque "confia mas teme" e
 * "respeita mas ressente" são leituras diferentes que produzem cartas
 * diferentes. Cada dimensão vai de 0 a 100; o `summary` em prosa é o que a IA
 * de fato usa no roleplay.
 */
export interface NpcRelation {
  trust: number;
  respect: number;
  fear: number;
  resentment: number;
  obligation: number;
  /** O resumo em prosa, gerado — é o que serve ao roleplay, não os números. */
  summary: string;
}

/**
 * O estado vivo de um NPC: muda todo turno. Separado da identidade (Codex) de
 * propósito — vinte turnos de atualização não podem destruir a personalidade.
 *
 * Chaveado por afiliação + id, não por Casa: os NPCs agora incluem a Coroa, as
 * organizações e figuras que não saem de uma Casa. As relações são por entidade
 * (uma Casa, a Coroa, uma organização, outro NPC), pela mesma chave.
 */
export interface NpcDynamic {
  affiliation: string;
  id: string;
  mood: string;
  location: string;
  objective: string;
  concerns: string;
  loyalty: string;
  relations: Record<string, NpcRelation>;
  memory: NpcMemoryEntry[];
  updatedAt: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function emptyRelation(): NpcRelation {
  return { trust: 50, respect: 50, fear: 20, resentment: 10, obligation: 20, summary: "" };
}

export function emptyDynamic(affiliation: string, id: string): NpcDynamic {
  return { affiliation, id, mood: "", location: "", objective: "", concerns: "", loyalty: "", relations: {}, memory: [], updatedAt: "" };
}

/**
 * Semente das relações de um líder, a partir da persona política.
 *
 * distrusts e trusts (da fase das personas) são o ponto de partida: uma Casa
 * de quem o líder desconfia começa com confiança baixa e ressentimento alto;
 * uma em quem confia, o contrário. O resumo herda o motivo já escrito.
 */
export function seedRelationsFromPersona(p: LeaderPersona): Record<string, NpcRelation> {
  const relations: Record<string, NpcRelation> = {};
  for (const [key, why] of Object.entries(p.distrusts ?? {})) {
    relations[key] = { trust: 20, respect: 45, fear: 30, resentment: 65, obligation: 10, summary: why };
  }
  for (const [key, why] of Object.entries(p.trusts ?? {})) {
    relations[key] = { trust: 75, respect: 70, fear: 10, resentment: 5, obligation: 30, summary: why };
  }
  return relations;
}

/** O que o Relationship Engine devolve para um NPC afetado por um turno. */
export interface NpcImpact {
  affected: boolean;
  /** Deltas por entidade, em cada dimensão. Só o que muda. */
  relationshipChanges?: Record<string, Partial<Omit<NpcRelation, "summary">> & { summary?: string }>;
  newMemory?: string;
  objectiveChanges?: string;
  moodChange?: string;
  loyaltyChange?: string;
}

/**
 * Aplica um impacto ao estado de um NPC — validando, fazendo clamp em 0–100, e
 * registrando a memória.
 *
 * Puro e idempotente por turno: a orquestração passa o turno de origem, e uma
 * memória com aquele turno não é gravada duas vezes. Assim reprocessar um turno
 * não empilha a mesma mudança nem duplica a lembrança.
 */
export function applyImpact(
  dynamic: NpcDynamic,
  impact: NpcImpact,
  turnNumber: number,
  now: string,
): NpcDynamic {
  if (!impact.affected) return dynamic;

  const relations: Record<string, NpcRelation> = { ...dynamic.relations };
  for (const [entity, change] of Object.entries(impact.relationshipChanges ?? {})) {
    const base = relations[entity] ?? emptyRelation();
    relations[entity] = {
      trust: clamp(base.trust + (change.trust ?? 0)),
      respect: clamp(base.respect + (change.respect ?? 0)),
      fear: clamp(base.fear + (change.fear ?? 0)),
      resentment: clamp(base.resentment + (change.resentment ?? 0)),
      obligation: clamp(base.obligation + (change.obligation ?? 0)),
      summary: change.summary?.trim() ? change.summary.trim() : base.summary,
    };
  }

  const memory = [...dynamic.memory];
  if (impact.newMemory?.trim() && !memory.some((m) => m.turnNumber === turnNumber && m.description === impact.newMemory!.trim())) {
    memory.push({ turnNumber, description: impact.newMemory.trim(), impact: summarizeChange(impact) });
  }

  return {
    ...dynamic,
    relations,
    memory,
    objective: impact.objectiveChanges?.trim() ? impact.objectiveChanges.trim() : dynamic.objective,
    mood: impact.moodChange?.trim() ? impact.moodChange.trim() : dynamic.mood,
    loyalty: impact.loyaltyChange?.trim() ? impact.loyaltyChange.trim() : dynamic.loyalty,
    updatedAt: now,
  };
}

/** Um rótulo curto da mudança, para a coluna `impact` da memória. */
function summarizeChange(impact: NpcImpact): string {
  const parts: string[] = [];
  for (const [entity, c] of Object.entries(impact.relationshipChanges ?? {})) {
    const dims = (["trust", "respect", "fear", "resentment", "obligation"] as const)
      .filter((d) => typeof c[d] === "number" && c[d] !== 0)
      .map((d) => `${d} ${c[d]! > 0 ? "+" : ""}${c[d]}`);
    if (dims.length) parts.push(`${entity}: ${dims.join(", ")}`);
  }
  return parts.join(" · ");
}
