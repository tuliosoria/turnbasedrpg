import type { Turn, House, Submission } from "@ravenloft/content";

const PREMISE = `Você é o mestre de uma campanha narrativa de estratégia chamada "O Inverno dos Mortos", ambientada em Valdren, um reino de Ravenloft cercado pelas Brumas. Cada jogador lidera uma Grande Casa com quatro atributos (Riqueza, Recursos, Soldados, Controle), de 0 a 5. REGRA CENTRAL: os atributos são RESTRIÇÕES, não ações — um plano só é tão plausível quanto os atributos da Casa permitem. Uma Casa com Soldados 1 não mobiliza um grande exército; uma Casa com Riqueza 0 não contrata mercenários. Escreva sempre em português.`;

function houseLine(h: House): string {
  const a = h.attributes;
  return `${h.name} (id: ${h.houseId}) — Riqueza ${a.riqueza}, Recursos ${a.recursos}, Soldados ${a.soldados}, Controle ${a.controle}. Especialidade: ${h.specialty}. Fraqueza: ${h.weakness}.`;
}

export function buildPrivateInfoPrompt(houses: House[], publicEvent: string, lastPublicResult?: string): { system: string; user: string } {
  const system = PREMISE + " Gere uma informação privada curta (2-4 frases) para CADA Casa, coerente com seus atributos e com o evento público. Responda ESTRITAMENTE em JSON: um objeto onde cada chave é o id da Casa e o valor é o texto da informação privada.";
  const user = [
    lastPublicResult ? `Resultado do turno anterior: ${lastPublicResult}` : "Início da campanha.",
    `Evento público deste turno: ${publicEvent}`,
    "Casas:",
    ...houses.map(houseLine),
  ].join("\n");
  return { system, user };
}

export function buildResolutionPrompt(turn: Turn, houses: House[], submissions: Submission[]): { system: string; user: string } {
  const system = PREMISE + ` Resolva o turno com base nas ordens escritas pelos jogadores. Lembre-se: os atributos limitam o que é plausível. Responda ESTRITAMENTE em JSON com o formato: {"publicResult": string, "houseResults": { [houseId]: string }, "attributeDeltas": { [houseId]: { riqueza?: number, recursos?: number, soldados?: number, controle?: number } }, "discoveries": string[] }. As variações de atributo (deltas) devem ser pequenas inteiras (entre -2 e +1) e justificadas pela narrativa.`;
  const houseById = new Map(houses.map((h) => [h.houseId, h]));
  const subText = submissions.map((s) => {
    const h = houseById.get(s.houseId);
    const cards = s.cardResponses.map((cr) => `  - Carta ${cr.cardId}: ${cr.declaredSpend ? `gasta ${cr.declaredSpend.amount} de ${cr.declaredSpend.attribute}; ` : ""}${cr.declaredChoice ? `escolhe ${cr.declaredChoice.attribute}; ` : ""}${cr.text}`).join("\n");
    return `Casa ${h?.name ?? s.houseId} (${s.houseId})\n${h ? houseLine(h) : ""}\nOrdem: ${s.orderText}\n${cards}`;
  }).join("\n\n");
  const user = [
    `Evento público: ${turn.publicEvent}`,
    "Ordens das Casas:",
    subText || "(nenhuma ordem enviada)",
  ].join("\n\n");
  return { system, user };
}
