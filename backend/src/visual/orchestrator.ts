import type { ChatFn } from "../ai/openai";
import type { VisualEntity, VisualStyleBible, WikiEntry } from "@ravenloft/content";
import { compileVisualContext } from "../ai/visual/contextCompiler";
import { compilePrompt } from "../ai/visual/promptCompiler";
import { findCanonMatches, renderCanonMatches } from "../ai/visual/canonLookup";
import { buildCanonicalCanon } from "./canon";
import { runEnhancer } from "./enhancerRunner";

export interface OrchestratedPrompt {
  /** The exact text that will be sent to the image model. */
  compiledPrompt: string;
  /** The author's request rewritten as a concrete visual brief. */
  enhancedBrief: string;
  /** Wiki entries whose canon was folded in, for display. */
  canonSources: string[];
  entityName: string | null;
  warnings: string[];
}

export interface OrchestrateInput {
  requestText: string;
  entity: VisualEntity | null;
  styleBible: VisualStyleBible;
  wikiEntries: WikiEntry[];
  chat?: ChatFn;
  /** Whether a canonical emblem will be attached at generation time. */
  hasEmblemReference?: boolean;
  assetType?: string;
}

/**
 * Assembles everything that constrains an image — style bible, the entity's
 * canon sheet, matched wiki canon, and the author's request rewritten as a
 * visual brief — into the single prompt string the image model receives.
 *
 * Runs before any image is generated so the author can read and edit the
 * result. That review step replaces the old post-generation consistency
 * evaluator, which judged from prompt text without ever seeing the image and
 * so invented violations while triggering paid retries.
 */
export async function orchestratePrompt(input: OrchestrateInput): Promise<OrchestratedPrompt> {
  const warnings: string[] = [];

  const canon = await buildCanonicalCanon(input.entity, input.requestText, input.wikiEntries);

  const haystack = [input.requestText, input.entity?.canonicalName ?? ""].join(" ");
  const canonSources = findCanonMatches(haystack, input.wikiEntries).map((m) => m.entry.title);

  const rawPkg = compileVisualContext({
    styleBible: input.styleBible,
    entity: input.entity,
    canonicalCanon: canon,
    userRequest: input.requestText,
    hasEmblemReference: input.hasEmblemReference,
    assetType: input.assetType,
  });

  let enhancedBrief = "";
  if (input.chat) {
    try {
      enhancedBrief = await runEnhancer(input.chat, rawPkg);
    } catch {
      warnings.push("Não foi possível reescrever o pedido como descrição visual; o texto original será usado.");
    }
  } else {
    warnings.push("Serviço de texto indisponível; o texto original será usado.");
  }

  const pkg = enhancedBrief
    ? compileVisualContext({
        styleBible: input.styleBible,
        entity: input.entity,
        canonicalCanon: canon,
        userRequest: enhancedBrief,
        hasEmblemReference: input.hasEmblemReference,
        assetType: input.assetType,
      })
    : rawPkg;

  if (!canonSources.length) {
    warnings.push("Nenhum verbete do cânone foi reconhecido neste pedido. Cite uma Casa, cidade ou região pelo nome para que o cânone seja aplicado.");
  }
  if (input.entity && input.entity.immutableTraits.length === 0) {
    warnings.push(`${input.entity.canonicalName} ainda não tem traços imutáveis registrados.`);
  }
  if (input.styleBible.referenceAssetIds.length === 0) {
    warnings.push("A Bíblia Visual não tem imagem de referência: a consistência depende apenas do texto.");
  }

  return {
    compiledPrompt: compilePrompt(pkg),
    enhancedBrief,
    canonSources,
    entityName: input.entity?.canonicalName ?? null,
    warnings,
  };
}

/**
 * Restates the style bible's own palette and lighting at the tail of an edited
 * prompt. The wording is entirely the author's: if they loosen the palette in
 * the Bíblia Visual, this loosens with it. Nothing about a particular look is
 * hardcoded here.
 */
export function styleGuardrail(styleBible: VisualStyleBible): string {
  const lines = ["LEMBRETE DE ESTILO:"];
  if (styleBible.colorPalette) lines.push(`- Paleta: ${styleBible.colorPalette}`);
  if (styleBible.lightingRules) lines.push(`- Iluminação: ${styleBible.lightingRules}`);
  return lines.join("\n");
}

/** Appends the guardrail unless the prompt already ends with it. */
export function applyStyleGuardrail(prompt: string, styleBible: VisualStyleBible): string {
  const guard = styleGuardrail(styleBible);
  if (prompt.trimEnd().endsWith(guard.trimEnd())) return prompt;
  return `${prompt.trimEnd()}\n\n${guard}`;
}

export { renderCanonMatches };
