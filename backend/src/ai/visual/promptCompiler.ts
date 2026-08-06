import type { VisualAsset } from "@ravenloft/content";
import type { VisualContextPackage } from "./contextCompiler";

export const VISUAL_SYSTEM_PROMPT =
  "Você é o Diretor de Arte Canônico de Valdren. Sua função é manter a identidade visual do mundo consistente ao longo de centenas de imagens. Você nunca contradiz traços imutáveis nem elementos travados (LOCKED). Você trabalha apenas com o cânone público fornecido.";

export function decideOperation(entityCanonicalAssets: VisualAsset[]): "GENERATE" | "EDIT" {
  return entityCanonicalAssets.length > 0 ? "EDIT" : "GENERATE";
}

function section(n: number, title: string, body: string): string {
  return `${n}. ${title}: ${body}`.trim();
}

export function compilePrompt(pkg: VisualContextPackage): string {
  const sb = pkg.styleBible;
  const lines = [
    section(1, "Tipo de imagem", pkg.entityType),
    section(2, "Objetivo narrativo", pkg.userRequest),
    section(3, "Estilo global", `${sb.artMedium}, ${sb.renderingStyle}`),
    section(4, "Entidade principal", pkg.entityName || "cena original de Valdren"),
    section(5, "Restrições imutáveis", pkg.immutableTraits.join("; ") || "nenhuma"),
    section(6, "Local e geografia", pkg.canonicalCanon || "Valdren, reino sombrio de Ravenloft"),
    section(7, "Arquitetura", sb.architectureRenderingRules),
    section(8, "Roupas e símbolos", pkg.visualKeywords.join("; ") || "conforme o cânone"),
    section(9, "Ação", pkg.userRequest),
    section(10, "Composição", pkg.flexibleTraits.join("; ") || "composição cinematográfica equilibrada"),
    section(11, "Câmera", "enquadramento cinematográfico apropriado ao tipo"),
    section(12, "Luz e atmosfera", sb.lightingRules),
    section(13, "Materiais", "texturas realistas, desgaste condizente com dark fantasy"),
    section(14, "Continuidade", pkg.prohibitedChanges.join("; ") || "preservar identidade estabelecida"),
    section(15, "Proibições", [...sb.prohibitedStyles, ...pkg.negativeInstructions].join("; ") || "nenhuma"),
    section(16, "Requisitos técnicos", `paleta ${sb.colorPalette}; ${sb.characterRenderingRules}`),
  ];
  return lines.join("\n");
}
