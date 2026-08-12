import type { VisualContextPackage } from "./contextCompiler";

export const ENHANCER_SYSTEM_PROMPT = [
  "Você é o Diretor de Arte Canônico de Valdren.",
  "Recebe um pedido do autor — frequentemente prosa de lore, escrita para ser lida, não para ser desenhada — e o converte em uma DESCRIÇÃO VISUAL concreta para um modelo de imagem.",
  "",
  "Regras:",
  "1. Descreva apenas o que se VÊ. Converta propósito, história e política em aparência: 'construída para atrasar invasores' vira 'muralha maciça de pedra escura, contrafortes espessos, marcas de cerco'.",
  "2. Nunca invente fatos que contradigam o cânone fornecido. Se o cânone não especifica algo visual necessário (cor de um mar, material de um portão), escolha algo coerente com o tom do mundo e mantenha-se discreto.",
  "3. Não repita regras de estilo, paleta ou iluminação — elas são aplicadas separadamente. Descreva o assunto, não o acabamento.",
  "4. Um único parágrafo, no máximo 120 palavras, em português.",
  "5. Sem títulos, sem listas, sem preâmbulo. Apenas a descrição.",
].join("\n");

export const ENHANCED_BRIEF_MAX = 900;

export function buildEnhancerUser(pkg: VisualContextPackage): string {
  const parts: string[] = [];
  if (pkg.entityName) parts.push(`Entidade: ${pkg.entityName} (${pkg.entityType})`);
  if (pkg.immutableTraits.length) parts.push(`Traços imutáveis (nunca contradiga):\n- ${pkg.immutableTraits.join("\n- ")}`);
  if (pkg.visualKeywords.length) parts.push(`Elementos visuais canônicos: ${pkg.visualKeywords.join("; ")}`);
  if (pkg.canonicalCanon.trim()) parts.push(`Cânone do local:\n${pkg.canonicalCanon.trim()}`);
  if (pkg.scaleDescription) parts.push(`Escala: ${pkg.scaleDescription}`);
  parts.push(`Pedido do autor:\n${pkg.userRequest}`);
  parts.push("Converta em uma descrição visual concreta, seguindo as regras.");
  return parts.join("\n\n");
}

/**
 * Models sometimes wrap the brief in quotes or prefix it with a label despite
 * rule 5. Strip that rather than passing the noise into the image prompt.
 */
export function parseEnhancedBrief(raw: string): string {
  let out = (raw ?? "").trim();
  out = out.replace(/^(descrição visual|descricao visual|cena|brief)\s*:\s*/i, "");
  if (out.length > 1 && out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1);
  return out.trim().slice(0, ENHANCED_BRIEF_MAX);
}
