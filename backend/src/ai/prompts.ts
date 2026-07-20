import type { Turn, House, Submission } from "@ravenloft/content";
import { CHRONICLE_MAX_TURNS, DEFAULT_IMAGE_DIRECTIVES } from "@ravenloft/content";

const PREMISE = `Você é o mestre de uma campanha narrativa de estratégia chamada "O Inverno dos Mortos", ambientada em Valdren, um reino de Ravenloft cercado pelas Brumas. Cada jogador lidera uma Grande Casa com quatro atributos (Riqueza, Recursos, Soldados, Controle), de 0 a 5. REGRA CENTRAL: os atributos são RESTRIÇÕES, não ações — um plano só é tão plausível quanto os atributos da Casa permitem. Uma Casa com Soldados 1 não mobiliza um grande exército; uma Casa com Riqueza 0 não contrata mercenários. Escreva sempre em português.`;

export interface WorldContext {
  lore?: string;
  chronicle?: string;
}

function withContext(base: string, ctx?: WorldContext): string {
  let out = base;
  if (ctx?.lore && ctx.lore.trim()) out += `\n\nMUNDO:\n${ctx.lore.trim()}`;
  if (ctx?.chronicle && ctx.chronicle.trim()) out += `\n\nCRÔNICA (turnos recentes):\n${ctx.chronicle.trim()}`;
  return out;
}

export function buildChronicle(turns: Turn[], max: number = CHRONICLE_MAX_TURNS): string {
  return turns
    .filter((t) => t.status === "RESOLVED" && t.result?.publicResult?.trim())
    .sort((a, b) => a.turnId - b.turnId)
    .slice(-max)
    .map((t) => `Turno ${t.turnId}: ${t.result!.publicResult}`)
    .join("\n");
}

function houseLine(h: House): string {
  const a = h.attributes;
  return `${h.name} (id: ${h.houseId}) — Riqueza ${a.riqueza}, Recursos ${a.recursos}, Soldados ${a.soldados}, Controle ${a.controle}. Especialidade: ${h.specialty}. Fraqueza: ${h.weakness}.`;
}

export function buildImagePrompt(
  directives: string | undefined,
  kind: "event" | "result",
  turn: Turn,
  sceneDescription?: string,
): string {
  const style = (directives && directives.trim()) ? directives.trim() : DEFAULT_IMAGE_DIRECTIVES;
  const scene = (sceneDescription && sceneDescription.trim())
    ? sceneDescription.trim()
    : (kind === "event" ? turn.publicEvent : (turn.result?.publicResult ?? "")).trim();
  const label = kind === "event" ? "Evento do turno" : "Resultado do turno";
  return [
    "DIRETRIZES DE ESTILO (siga rigorosamente):",
    style,
    "",
    `CENA A ILUSTRAR (${label}):`,
    scene || "(sem descrição fornecida)",
  ].join("\n");
}

export function buildPublicEventPrompt(houses: House[], ctx?: WorldContext): { system: string; user: string } {
  const system = withContext(PREMISE, ctx) +
    " Crie o EVENTO PÚBLICO do próximo turno: um acontecimento marcante que afeta todo o reino de Valdren e provoca decisões das Casas. Escreva 2 a 4 frases, com tom sombrio e cinematográfico, coerente com o mundo e a crônica dos turnos anteriores. Não decida as ações das Casas nem os resultados. Responda ESTRITAMENTE em JSON no formato: {\"publicEvent\": string}.";
  const user = [
    "Casas atualmente em jogo:",
    houses.length ? houses.map(houseLine).join("\n") : "(nenhuma Casa cadastrada ainda)",
  ].join("\n");
  return { system, user };
}

export function buildPrivateInfoPrompt(houses: House[], publicEvent: string, ctx?: WorldContext): { system: string; user: string } {
  const system = withContext(PREMISE, ctx) + " Gere uma informação privada curta (2-4 frases) para CADA Casa, coerente com seus atributos e com o evento público. Responda ESTRITAMENTE em JSON: um objeto onde cada chave é o id da Casa e o valor é o texto da informação privada.";
  const user = [
    `Evento público deste turno: ${publicEvent}`,
    "Casas:",
    ...houses.map(houseLine),
  ].join("\n");
  return { system, user };
}

export function buildResolutionPrompt(turn: Turn, houses: House[], submissions: Submission[], ctx?: WorldContext): { system: string; user: string } {
  const system = withContext(PREMISE, ctx) + ` Resolva o turno com base nas ordens escritas pelos jogadores. Lembre-se: os atributos limitam o que é plausível. Responda ESTRITAMENTE em JSON com o formato: {"publicResult": string, "houseResults": { [houseId]: string }, "attributeDeltas": { [houseId]: { riqueza?: number, recursos?: number, soldados?: number, controle?: number } }, "discoveries": string[] }. As variações de atributo (deltas) devem ser pequenas inteiras (entre -2 e +1) e justificadas pela narrativa.`;
  const houseById = new Map(houses.map((h) => [h.houseId, h]));
  const subText = submissions.map((s) => {
    const h = houseById.get(s.houseId);
    return `Casa ${h?.name ?? s.houseId} (${s.houseId})\n${h ? houseLine(h) : ""}\nOrdem: ${s.orderText}`;
  }).join("\n\n");
  const user = [
    `Evento público: ${turn.publicEvent}`,
    "Ordens das Casas:",
    subText || "(nenhuma ordem enviada)",
  ].join("\n\n");
  return { system, user };
}
