import type { Turn, TurnResult, House, Submission, Emblem, WikiEntry, AttributeKey } from "@ravenloft/content";
import { CHRONICLE_MAX_TURNS, DEFAULT_IMAGE_DIRECTIVES, emblemColorName } from "@ravenloft/content";

const PREMISE = `Você é o mestre de uma campanha narrativa de estratégia chamada "O Inverno dos Mortos", ambientada em Valdren, um reino de Ravenloft cercado pelas Brumas. Cada jogador lidera uma Grande Casa com quatro atributos (Riqueza, Recursos, Soldados, Controle), de 0 a 5. REGRA CENTRAL: os atributos são RESTRIÇÕES, não ações — um plano só é tão plausível quanto os atributos da Casa permitem. Uma Casa com Soldados 1 não mobiliza um grande exército; uma Casa com Riqueza 0 não contrata mercenários. Escreva sempre em português.`;

export interface WorldContext {
  lore?: string;
  chronicle?: string;
  publicEventContext?: string;
}

export interface PublicEventContextInput {
  lore?: string;
  houses: readonly House[];
  wiki: readonly WikiEntry[];
  turns: readonly Turn[];
  submissionsByTurn: ReadonlyMap<number, readonly Submission[]>;
}

function houseName(houses: readonly House[], houseId: string): string {
  return houses.find((h) => h.houseId === houseId)?.name ?? houseId;
}

function publicHouseLine(h: House): string {
  const a = h.attributes;
  return [
    `${h.name} (${h.houseId})`,
    `Lema: ${h.motto}`,
    `Líder: ${h.leaderName}`,
    `Herdeiro: ${h.heirName}`,
    `Castelo: ${h.castleName}`,
    `Povoados: ${h.townsText}`,
    `História: ${h.historyText}`,
    `Especialidade: ${h.specialty}`,
    `Fraqueza: ${h.weakness}`,
    `Atributos: Riqueza ${a.riqueza}, Recursos ${a.recursos}, Soldados ${a.soldados}, Controle ${a.controle}`,
  ].join("\n");
}

function formatAttributeDeltas(houses: readonly House[], deltas: TurnResult["attributeDeltas"]): string {
  const lines: string[] = [];
  for (const [houseId, attrs] of Object.entries(deltas ?? {})) {
    const parts = Object.entries(attrs as Partial<Record<AttributeKey, number>>)
      .map(([key, value]) => `${key} ${value && value > 0 ? `+${value}` : value}`)
      .join(", ");
    if (parts) lines.push(`${houseName(houses, houseId)}: ${parts}`);
  }
  return lines.length ? lines.join("; ") : "nenhuma";
}

function formatTurnMemory(turn: Turn, houses: readonly House[], submissions: readonly Submission[]): string {
  const privateInfo = Object.entries(turn.privateInfo ?? {})
    .map(([houseId, text]) => `Informação privada para ${houseName(houses, houseId)}: ${text}`)
    .join("\n") || "Informação privada: nenhuma";
  const orders = submissions
    .map((s) => `Ordem da ${houseName(houses, s.houseId)}: ${s.orderText}`)
    .join("\n") || "Ordens: nenhuma";
  const privateResults = Object.entries(turn.result?.houseResults ?? {})
    .map(([houseId, text]) => `Resultado privado da ${houseName(houses, houseId)}: ${text}`)
    .join("\n") || "Resultados privados: nenhum";
  const discoveries = turn.result?.discoveries?.length ? turn.result.discoveries.join("; ") : "nenhuma";
  return [
    `Turno ${turn.turnId} (${turn.status})`,
    `Evento público: ${turn.publicEvent || "(vazio)"}`,
    privateInfo,
    orders,
    `Resultado público: ${turn.result?.publicResult ?? "(sem resultado público)"}`,
    privateResults,
    `Mudanças de atributos: ${formatAttributeDeltas(houses, turn.result?.attributeDeltas ?? {})}`,
    `Descobertas: ${discoveries}`,
  ].join("\n");
}

export function buildPublicEventContext(input: PublicEventContextInput): string {
  const recentTurns = [...input.turns]
    .sort((a, b) => a.turnId - b.turnId)
    .slice(-5);
  const wikiText = [...input.wiki]
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.title.localeCompare(b.title))
    .map((entry) => `[${entry.section}] ${entry.title}\n${entry.body}`)
    .join("\n\n") || "(nenhuma entrada pública na Wiki)";
  const turnText = recentTurns
    .map((turn) => formatTurnMemory(turn, input.houses, input.submissionsByTurn.get(turn.turnId) ?? []))
    .join("\n\n") || "(nenhum turno anterior)";

  return [
    "ENREDO",
    input.lore?.trim() || "(sem World Bible cadastrado)",
    "",
    "CASAS EM JOGO",
    input.houses.length ? input.houses.map(publicHouseLine).join("\n\n") : "(nenhuma Casa cadastrada)",
    "",
    "WIKI PÚBLICA",
    wikiText,
    "",
    "ÚLTIMOS 5 TURNOS",
    turnText,
    "",
    "REGRA DE SIGILO",
    "Use informações privadas, ordens e resultados privados apenas como memória de continuidade; não revele diretamente segredos, ordens privadas, consequências privadas, descobertas ocultas ou verdades de mestre no evento público. Transforme esse material em sinais públicos, rumores, pressões, consequências indiretas e novos problemas visíveis.",
  ].join("\n");
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

export function buildHouseImagePrompt(name: string, description: string, emblem: Emblem): string {
  const colors = `${emblemColorName(emblem.color1)} e ${emblemColorName(emblem.color2)}`;
  const desc = description.trim();
  return [
    "DIRETRIZES DE ESTILO (siga rigorosamente):",
    DEFAULT_IMAGE_DIRECTIVES,
    "",
    "CENA A ILUSTRAR (brasão/retrato heráldico de uma Grande Casa de Valdren):",
    `Casa: ${name}`,
    `Emblema: ${emblem.icon}, cores ${colors}.`,
    desc ? `Descrição: ${desc}` : "Sem descrição fornecida.",
    "Componha uma ilustração sombria e cinematográfica que represente a identidade desta Casa.",
  ].join("\n");
}

export function buildPublicEventPrompt(houses: House[], ctx?: WorldContext): { system: string; user: string } {
  const contextBlock = ctx?.publicEventContext?.trim()
    ? `\n\nCONTEXTO DA CAMPANHA:\n${ctx.publicEventContext.trim()}`
    : "";
  const system = withContext(PREMISE, { lore: ctx?.lore, chronicle: ctx?.chronicle }) +
    contextBlock +
    " Crie o EVENTO PÚBLICO do próximo turno: um acontecimento marcante que afeta todo o reino de Valdren e provoca decisões das Casas. Escreva 2 a 4 frases, com tom sombrio e cinematográfico, coerente com o mundo e a continuidade dos turnos anteriores. Não decida as ações das Casas nem os resultados. Não exponha diretamente informações privadas, ordens privadas, consequências privadas ou segredos ainda não revelados. Responda ESTRITAMENTE em JSON no formato: {\"publicEvent\": string}.";
  const user = [
    "Use o CONTEXTO DA CAMPANHA para criar continuidade. O texto final deve ser conhecimento público dos personagens.",
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
