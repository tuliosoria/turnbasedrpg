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

/** Lê a resposta do modelo como um impacto, tolerando cercas e lixo em volta. */
export function parseImpact(raw: string): NpcImpact {
  const text = raw.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { affected: false };
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as NpcImpact;
    return typeof parsed.affected === "boolean" ? parsed : { affected: false };
  } catch {
    return { affected: false };
  }
}
