import type { NpcIdentity, NpcDynamic, NpcImpact } from "@ravenloft/content";

/**
 * O Relationship Engine pergunta, por NPC afetado: este acontecimento muda este
 * personagem, e como? A resposta é estruturada, para o backend validar e gravar
 * — nunca prosa livre reescrevendo a ficha.
 *
 * O mesmo evento move NPCs em direções opostas porque passa pela identidade de
 * cada um: o líder gnomo desaba em confiança no rei que atacou Ninho Alto; um
 * comandante Vargen pode subir ("finalmente um rei disposto a usar força").
 */
export const IMPACT_SYSTEM_PROMPT = [
  "Você é o motor de reações de um jogo político. Dado um acontecimento e um personagem,",
  "decide se aquilo muda o personagem e como — pela personalidade, valores, história e",
  "interesses DELE, não por uma reação genérica.",
  "",
  "Regras:",
  "1. A mudança passa pela identidade. O mesmo fato pode aproximar um e afastar outro.",
  "2. Só o que muda. Se o acontecimento não toca este personagem, responda affected:false.",
  "3. Relações têm cinco dimensões, de 0 a 100: trust, respect, fear, resentment, obligation.",
  "   Você devolve DELTAS (ex.: trust -35), não valores absolutos.",
  "4. Uma nova memória é uma frase curta do que ele registrou. Um novo objetivo, idem.",
  "5. Não invente fatos além do acontecimento dado.",
  "",
  "Responda APENAS com JSON, sem cercas de código, nesta forma:",
  '{ "affected": true, "relationshipChanges": { "<chave-da-entidade>": { "trust": -35, "fear": 40 } },',
  '  "newMemory": "…", "objectiveChanges": "…", "moodChange": "…", "loyaltyChange": "…" }',
].join("\n");

export function buildImpactUser(input: {
  identity: NpcIdentity;
  dynamic: NpcDynamic;
  events: string[];
}): string {
  const id = input.identity;
  const rel = Object.entries(input.dynamic.relations)
    .map(([k, r]) => `  ${k}: confiança ${r.trust}, respeito ${r.respect}, medo ${r.fear}, ressentimento ${r.resentment}${r.summary ? ` — ${r.summary}` : ""}`)
    .join("\n");

  return [
    `PERSONAGEM: ${id.name}, ${id.role} (${id.affiliation}).`,
    `Personalidade: ${id.personality}`,
    id.values ? `Valores: ${id.values}` : "",
    id.ambitions ? `Ambições: ${id.ambitions}` : "",
    id.redLines ? `Linhas vermelhas: ${id.redLines}` : "",
    input.dynamic.objective ? `Objetivo atual: ${input.dynamic.objective}` : "",
    input.dynamic.loyalty ? `Lealdade atual: ${input.dynamic.loyalty}` : "",
    rel ? `Relações atuais (0–100):\n${rel}` : "Sem relações registradas ainda.",
    "",
    "ACONTECEU (só o que este personagem tomou conhecimento):",
    ...input.events.map((e) => `- ${e}`),
    "",
    "Este acontecimento muda este personagem? Responda no JSON pedido.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Lê a resposta do modelo como um impacto, tolerando cercas e lixo em volta.
 *
 * E tolerando tipos errados dentro do JSON. O modelo às vezes devolve
 * `"loyaltyChange": -10` em vez de texto, e o cast cego deixava o número passar
 * até o `.trim()` do `applyImpact` — que estourava e abortava o motor inteiro
 * no meio do turno (18/09 e 23/09/2026): todo NPC depois daquele ficava sem
 * reação. Aqui cada campo entra só se tem o tipo certo; o resto é descartado.
 */
export function parseImpact(raw: string): NpcImpact {
  const text = raw.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { affected: false };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { affected: false };
  }
  if (typeof parsed.affected !== "boolean") return { affected: false };

  const texto = (v: unknown): string | undefined =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
  const numero = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;

  const relationshipChanges: NonNullable<NpcImpact["relationshipChanges"]> = {};
  if (parsed.relationshipChanges && typeof parsed.relationshipChanges === "object" && !Array.isArray(parsed.relationshipChanges)) {
    for (const [entity, c] of Object.entries(parsed.relationshipChanges as Record<string, unknown>)) {
      if (!c || typeof c !== "object") continue;
      const o = c as Record<string, unknown>;
      const change: NonNullable<NpcImpact["relationshipChanges"]>[string] = {};
      for (const d of ["trust", "respect", "fear", "resentment", "obligation"] as const) {
        const n = numero(o[d]);
        if (n !== undefined) change[d] = n;
      }
      const summary = texto(o.summary);
      if (summary !== undefined) change.summary = summary;
      relationshipChanges[entity] = change;
    }
  }

  return {
    affected: parsed.affected,
    relationshipChanges,
    newMemory: texto(parsed.newMemory),
    objectiveChanges: texto(parsed.objectiveChanges),
    moodChange: texto(parsed.moodChange),
    loyaltyChange: texto(parsed.loyaltyChange),
  };
}
