import { clampText } from "../projects.js";
import type { VisualEntityType } from "../visual/models.js";

export const CANON_RAW_TEXT_MAX = 4000;
export const CANON_TITLE_MAX = 120;
export const CANON_BODY_MAX = 8000;
export const CANON_SUMMARY_MAX = 400;
export const CANON_TRAIT_MAX = 120;
export const CANON_MAX_TRAITS = 8;
export const CANON_GM_NOTE_MAX = 1000;

export const CANON_SUBMISSION_STATUSES = ["PENDING_GM", "APPROVED", "REJECTED"] as const;
export type CanonSubmissionStatus = (typeof CANON_SUBMISSION_STATUSES)[number];

export function isCanonSubmissionStatus(v: unknown): v is CanonSubmissionStatus {
  return typeof v === "string" && (CANON_SUBMISSION_STATUSES as readonly string[]).includes(v);
}

export const CANON_SUBMISSION_STATUS_LABELS: Record<CanonSubmissionStatus, string> = {
  PENDING_GM: "Aguardando o Mestre",
  APPROVED: "Publicado na Enciclopédia",
  REJECTED: "Recusado",
};

/** O texto livre do jogador depois de a IA transformá-lo em verbete. */
export interface CanonProposal {
  title: string;
  /** Id de seção da Enciclopédia (ver WIKI_SECTION_IDS). */
  section: string;
  body: string;
  summary: string;
  /** Null quando a proposta não merece entidade visual própria. */
  entityType: VisualEntityType | null;
  canonicalName: string;
  immutableTraits: string[];
  houseId: string | null;
}

export const CANON_FLAG_SEVERITIES = ["INFO", "WARN", "BLOCK"] as const;
export type CanonFlagSeverity = (typeof CANON_FLAG_SEVERITIES)[number];

export interface CanonReviewFlag {
  severity: CanonFlagSeverity;
  message: string;
}

export const CANON_VERDICTS = ["OK", "NEEDS_WORK", "CONFLICT"] as const;
export type CanonVerdict = (typeof CANON_VERDICTS)[number];

export const CANON_VERDICT_LABELS: Record<CanonVerdict, string> = {
  OK: "Aprovado pela IA",
  NEEDS_WORK: "Revisão necessária",
  CONFLICT: "Conflito detectado",
};

/** Parecer da IA. Informa o Mestre; nunca decide nada sozinho. */
export interface CanonReview {
  verdict: CanonVerdict;
  flags: CanonReviewFlag[];
  conflictingEntryIds: string[];
}

export interface CanonSubmission {
  id: string;
  campaignId: string;
  houseId: string;
  authorName: string;
  rawText: string;
  rawImageUrl: string | null;
  /** Chave S3 da imagem enviada. Necessária para montar o VisualAsset na publicação. */
  rawImageKey: string | null;
  proposal: CanonProposal;
  review: CanonReview | null;
  status: CanonSubmissionStatus;
  gmNote: string;
  wikiEntryId: string | null;
  visualEntityId: string | null;
  visualAssetId: string | null;
  /** Preenchido quando o Mestre aprova ou recusa. Null enquanto pendente. */
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function clampCanonProposal(p: CanonProposal): CanonProposal {
  return {
    title: clampText(p.title, CANON_TITLE_MAX),
    section: p.section,
    body: clampText(p.body, CANON_BODY_MAX),
    summary: clampText(p.summary, CANON_SUMMARY_MAX),
    entityType: p.entityType,
    canonicalName: clampText(p.canonicalName, CANON_TITLE_MAX),
    immutableTraits: p.immutableTraits.slice(0, CANON_MAX_TRAITS).map((t) => clampText(t, CANON_TRAIT_MAX)),
    houseId: p.houseId,
  };
}

export interface NewCanonSubmissionInput {
  id: string;
  campaignId: string;
  houseId: string;
  authorName: string;
  rawText: string;
  rawImageUrl: string | null;
  rawImageKey: string | null;
  proposal: CanonProposal;
}

export function newCanonSubmission(input: NewCanonSubmissionInput): CanonSubmission {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    houseId: input.houseId,
    authorName: input.authorName,
    rawText: clampText(input.rawText, CANON_RAW_TEXT_MAX),
    rawImageUrl: input.rawImageUrl,
    rawImageKey: input.rawImageKey,
    proposal: clampCanonProposal(input.proposal),
    review: null,
    status: "PENDING_GM",
    gmNote: "",
    wikiEntryId: null,
    visualEntityId: null,
    visualAssetId: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
