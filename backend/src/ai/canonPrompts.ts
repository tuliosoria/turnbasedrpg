import {
  WIKI_SECTIONS,
  isCanonWikiSection,
  isVisualEntityType,
  clampCanonProposal,
  clampText,
  CANON_MAX_TRAITS,
  CANON_TRAIT_MAX,
  type WikiEntry,
  type CanonProposal,
  type CanonReview,
  type CanonReviewFlag,
  type CanonFlagSeverity,
  type CanonVerdict,
} from "@ravenloft/content";
import { HttpError } from "../types/domain.js";
import { joinWithBudget } from "./prompts.js";

export const CANON_CONTEXT_BUDGETS = {
  /** Teto total do bloco de contexto que vai para o prompt de proposta/revisão. */
  totalChars: 12000,
  /** Teto por verbete — clampa corpos longos antes de empilhar. */
  entryChars: 700,
} as const;

// Seções de ficção de Valdren; calculado uma vez ao carregar o módulo para
// evitar a filtragem repetida a cada chamada de prompt ou parse.
const CANON_SECTIONS: { id: string; label: string }[] = WIKI_SECTIONS.filter((s) =>
  isCanonWikiSection(s.id),
);

// Âncora no dado do módulo wiki: se "visao-geral" for renomeado, o build
// detecta imediatamente porque CANON_SECTIONS seria vazio na posição [0].
const FALLBACK_SECTION: string = CANON_SECTIONS[0].id;

/** Só o mundo de Valdren. Regras de mesa (campanha-dnd) nunca entram num prompt de ficção. */
export function buildCanonContext(wiki: WikiEntry[]): string {
  const parts = wiki
    .filter((e) => isCanonWikiSection(e.section))
    .map((e) => `[${e.entryId}] (${e.section}) ${e.title}\n${clampText(e.body, CANON_CONTEXT_BUDGETS.entryChars)}`);
  return joinWithBudget(parts, CANON_CONTEXT_BUDGETS.totalChars, "(a enciclopédia ainda está vazia)");
}

function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "A IA não devolveu JSON válido.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(502, "AI_PARSE", "A IA não devolveu um objeto JSON.");
  }
  return value as Record<string, unknown>;
}

function textField(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v.trim() : "";
}

export function buildCanonProposalPrompt(
  houseName: string,
  canon: string,
  rawText: string,
): { system: string; user: string } {
  const sections = CANON_SECTIONS
    .map((s) => `- ${s.id}: ${s.label}`)
    .join("\n");
  const system = [
    "Você é o arquivista de Valdren, uma ilha cercada pelas Brumas em uma campanha de fantasia política e horror sobrenatural.",
    "Transforme o pedido do jogador em um verbete de enciclopédia coerente com o cânone recebido.",
    "Escreva em português do Brasil, em prosa sóbria, sem números de regra e sem mecânica de mesa.",
    "Nunca invente eventos de escala continental nem mate personagens existentes: proponha apenas o que o jogador pediu.",
    'Responda SOMENTE com JSON no formato: {"title":string,"section":string,"body":string,"summary":string,"entityType":string|null,"canonicalName":string,"immutableTraits":string[],"houseId":string|null}.',
  ].join(" ");
  const user = [
    `Casa autora: ${houseName}`,
    "",
    "Seções disponíveis:",
    sections,
    "",
    "Cânone atual:",
    canon || "(a enciclopédia ainda está vazia)",
    "",
    "Pedido do jogador:",
    rawText,
    "",
    `Devolva no máximo ${CANON_MAX_TRAITS} traços imutáveis, cada um com até ${CANON_TRAIT_MAX} caracteres, descrevendo apenas o que é visualmente permanente.`,
    "Use entityType apenas quando a proposta descreve algo que pode ser desenhado (personagem, lugar, objeto). Caso contrário, null.",
  ].join("\n");
  return { system, user };
}

export function parseCanonProposalJson(raw: string): CanonProposal {
  const o = parseJsonObject(raw);
  const title = textField(o, "title");
  const body = textField(o, "body");
  if (!title) throw new HttpError(502, "AI_PARSE", "A IA não devolveu um título.");
  if (!body) throw new HttpError(502, "AI_PARSE", "A IA não devolveu um corpo de verbete.");

  const sectionRaw = textField(o, "section");
  const knownSection = CANON_SECTIONS.some((s) => s.id === sectionRaw);
  if (!knownSection && sectionRaw) {
    console.warn(`[canonPrompts] seção desconhecida devolvida pela IA: "${sectionRaw}" — usando "${FALLBACK_SECTION}"`);
  }
  const section = knownSection ? sectionRaw : FALLBACK_SECTION;

  const traitsRaw = Array.isArray(o.immutableTraits) ? o.immutableTraits : [];
  const immutableTraits = traitsRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  return clampCanonProposal({
    title,
    section,
    body,
    summary: textField(o, "summary") || body,
    entityType: isVisualEntityType(o.entityType) ? o.entityType : null,
    canonicalName: textField(o, "canonicalName") || title,
    immutableTraits,
    houseId: textField(o, "houseId") || null,
  });
}

export function buildCanonReviewPrompt(
  canon: string,
  proposal: CanonProposal,
): { system: string; user: string } {
  const system = [
    "Você é o revisor de continuidade de Valdren.",
    "Aponte contradições, repetições e riscos de poder do verbete proposto em relação ao cânone recebido.",
    "Você não aprova nem rejeita nada: o Mestre decide. Seja específico e curto.",
    'Responda SOMENTE com JSON no formato: {"verdict":"OK"|"NEEDS_WORK"|"CONFLICT","flags":[{"severity":"INFO"|"WARN"|"BLOCK","message":string}],"conflictingEntryIds":string[]}.',
  ].join(" ");
  const user = [
    "Cânone atual (o id entre colchetes identifica o verbete):",
    canon || "(a enciclopédia ainda está vazia)",
    "",
    "Verbete proposto:",
    `Seção: ${proposal.section}`,
    `Título: ${proposal.title}`,
    proposal.body,
    "",
    "Use BLOCK só quando publicar quebraria o cânone existente.",
  ].join("\n");
  return { system, user };
}

function normalizeSeverity(v: unknown): CanonFlagSeverity {
  if (v === "BLOCK" || v === "WARN" || v === "INFO") return v;
  if (v !== undefined && v !== null && v !== "") {
    console.warn(`[canonPrompts] severidade desconhecida devolvida pela IA: "${v}" — usando "INFO"`);
  }
  return "INFO";
}

export function parseCanonReviewJson(raw: string): CanonReview {
  const o = parseJsonObject(raw);

  const verdictRaw = o.verdict;
  if (verdictRaw !== undefined && verdictRaw !== "OK" && verdictRaw !== "CONFLICT" && verdictRaw !== "NEEDS_WORK") {
    console.warn(`[canonPrompts] veredicto desconhecido devolvido pela IA: "${verdictRaw}" — usando "OK"`);
  }
  const verdict: CanonVerdict =
    verdictRaw === "CONFLICT" || verdictRaw === "NEEDS_WORK" ? verdictRaw : "OK";

  const flagsRaw = Array.isArray(o.flags) ? o.flags : [];
  const flags: CanonReviewFlag[] = flagsRaw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null && !Array.isArray(f))
    .map((f) => ({
      severity: normalizeSeverity(f.severity),
      message: clampText(typeof f.message === "string" ? f.message : "", 300),
    }))
    .filter((f) => f.message.length > 0);

  const idsRaw = Array.isArray(o.conflictingEntryIds) ? o.conflictingEntryIds : [];
  const conflictingEntryIds = idsRaw.filter((id): id is string => typeof id === "string");

  return { verdict, flags, conflictingEntryIds };
}
