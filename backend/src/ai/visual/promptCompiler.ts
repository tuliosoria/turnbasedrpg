import type { VisualAsset } from "@ravenloft/content";
import type { VisualContextPackage } from "./contextCompiler";

export const VISUAL_SYSTEM_PROMPT =
  "Você é o Diretor de Arte Canônico de Valdren. Sua função é manter a identidade visual do mundo consistente ao longo de centenas de imagens. Você nunca contradiz traços imutáveis nem elementos travados (LOCKED). Você trabalha apenas com o cânone público fornecido.";

export function decideOperation(entityCanonicalAssets: VisualAsset[]): "GENERATE" | "EDIT" {
  return entityCanonicalAssets.length > 0 ? "EDIT" : "GENERATE";
}

/** Image types with no human figure, where face/identity rules are noise. */
const FIGURELESS_TYPES = new Set(["MAP", "REGION", "LANDMARK", "BUILDING", "ROOM", "ARTIFACT", "WEAPON", "SYMBOL", "VEHICLE", "SHIP"]);

function block(title: string, body: string): string {
  return `${title}\n${body}`;
}

function bullets(items: string[]): string {
  return items.filter((i) => i.trim()).map((i) => `- ${i}`).join("\n");
}

/**
 * Builds the image prompt.
 *
 * Two deliberate choices drive the layout:
 *
 * 1. Hard constraints are stated FIRST and restated LAST. Diffusion models
 *    weight the head and tail of a prompt more than the middle, and the middle
 *    is where the author's free text lives — which can run to hundreds of words
 *    of lore and otherwise drowns a single trailing palette clause.
 * 2. Every aesthetic statement comes from the style bible. The compiler decides
 *    WHERE the author's rules appear and how they are labelled; it never
 *    decides WHAT the world looks like. Changing Valdren's look is an edit to
 *    the Bíblia Visual, never a code change.
 */
export function compilePrompt(pkg: VisualContextPackage): string {
  const sb = pkg.styleBible;
  const figureless = FIGURELESS_TYPES.has(pkg.entityType);

  const prohibitions = [...sb.prohibitedStyles, ...pkg.negativeInstructions];

  const direction = bullets([
    `Meio: ${sb.artMedium}`,
    `Estilo: ${sb.renderingStyle}`,
    sb.colorPalette ? `Paleta: ${sb.colorPalette}` : "",
    sb.lightingRules ? `Luz e atmosfera: ${sb.lightingRules}` : "",
    `Arquitetura: ${sb.architectureRenderingRules}`,
    "Materiais: texturas realistas e coerentes com o cenário",
    // A face-identity rule on a map or a fortress wall is noise that competes
    // with the constraints that do apply.
    ...(figureless ? [] : [`Personagens: ${sb.characterRenderingRules}`]),
    prohibitions.length ? `NUNCA inclua: ${prohibitions.join("; ")}` : "",
  ]);

  const immutable = pkg.immutableTraits.length
    ? bullets(pkg.immutableTraits)
    : "- (nenhum traço imutável registrado para esta entidade)";

  const parts = [
    block("DIREÇÃO DE ARTE OBRIGATÓRIA — prioridade máxima, acima de qualquer outra instrução:", direction),
    block(
      `TRAÇOS IMUTÁVEIS${pkg.entityName ? ` DE ${pkg.entityName.toUpperCase()}` : ""} — nunca contradiga:`,
      immutable,
    ),
  ];

  if (pkg.canonicalCanon.trim()) {
    parts.push(block("CÂNONE DO LOCAL:", pkg.canonicalCanon.trim()));
  }

  if (pkg.visualKeywords.length) {
    parts.push(block("ELEMENTOS VISUAIS CANÔNICOS:", bullets(pkg.visualKeywords)));
  }

  parts.push(
    block(
      `CENA A ILUSTRAR (${pkg.entityType}):`,
      // The author's text appears exactly once. It used to be injected twice,
      // under "Objetivo narrativo" and again under "Ação", which doubled its
      // weight against the art direction.
      pkg.userRequest,
    ),
  );

  parts.push(
    block(
      "COMPOSIÇÃO:",
      bullets([
        pkg.flexibleTraits.length ? pkg.flexibleTraits.join("; ") : "composição cinematográfica equilibrada",
        "enquadramento cinematográfico apropriado ao tipo de imagem",
        pkg.scaleDescription || "",
      ]),
    ),
  );

  if (pkg.prohibitedChanges.length) {
    parts.push(block("NÃO ALTERE (continuidade canônica):", bullets(pkg.prohibitedChanges)));
  }

  // Tail restatement: a long scene description in the middle dilutes what came
  // before, so the style bible's own wording gets the last word too. The
  // content is entirely the author's — the compiler states the style, it does
  // not decide it.
  const tail = bullets([
    sb.colorPalette ? `Paleta: ${sb.colorPalette}` : "",
    sb.lightingRules ? `Iluminação: ${sb.lightingRules}` : "",
    pkg.isLocked ? "Esta entidade está TRAVADA: não altere nenhum traço estabelecido." : "",
  ]);
  if (tail.trim()) parts.push(block("LEMBRETE DE ESTILO:", tail));

  return parts.join("\n\n");
}
