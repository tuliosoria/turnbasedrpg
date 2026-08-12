import {
  clampVisualText,
  coerceCanonTraits,
  isCanonicalLevel,
  isVisualEntityType,
  type CanonicalLevel,
  type CanonTrait,
  type VisualEntityType,
} from "@ravenloft/content";
import { HttpError } from "../types/domain";

export interface GenerateBody {
  requestText: string;
  entityId: string | null;
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "INVALID_BODY", "Corpo inválido.");
  return body as Record<string, unknown>;
}

export function parseGenerateBody(body: unknown): GenerateBody {
  const o = asObject(body);
  const requestText = clampVisualText(o.requestText);
  if (!requestText) throw new HttpError(400, "INVALID_BODY", "Descreva a imagem desejada.");
  const entityId = typeof o.entityId === "string" && o.entityId ? o.entityId : null;
  return { requestText, entityId };
}

export interface CreateEntityBody {
  canonicalName: string;
  entityType: VisualEntityType;
  slug: string;
  publicDescription: string;
  wikiEntryId: string | null;
}

export function slugify(name: string): string {
  // Strip the combining-diacritical-marks block after NFD so "Mandíbula"
  // becomes "mandibula".
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseCreateEntityBody(body: unknown): CreateEntityBody {
  const o = asObject(body);
  const canonicalName = clampVisualText(o.canonicalName, 200);
  if (!canonicalName) throw new HttpError(400, "INVALID_BODY", "Informe o nome canônico da entidade.");
  if (!isVisualEntityType(o.entityType)) throw new HttpError(400, "INVALID_BODY", "Tipo de entidade inválido.");
  const slugSource = typeof o.slug === "string" && o.slug ? o.slug : canonicalName;
  const slug = slugify(slugSource);
  if (!slug) throw new HttpError(400, "INVALID_BODY", "Não foi possível gerar um slug para essa entidade.");
  return {
    canonicalName,
    entityType: o.entityType,
    slug,
    publicDescription: clampVisualText(o.publicDescription),
    wikiEntryId: typeof o.wikiEntryId === "string" && o.wikiEntryId ? o.wikiEntryId : null,
  };
}

export interface UpdateEntityBody {
  canonicalName?: string;
  publicDescription?: string;
  immutableTraits?: CanonTrait[];
  flexibleTraits?: string[];
  prohibitedChanges?: string[];
  visualKeywords?: string[];
  negativeInstructions?: string[];
  scaleDescription?: string;
  culturalContext?: string;
  aliases?: string[];
  status?: CanonicalLevel;
  wikiEntryId?: string | null;
}

function parseStringList(v: unknown): string[] {
  if (!Array.isArray(v)) throw new HttpError(400, "INVALID_BODY", "Esperava uma lista de textos.");
  return v.map((s) => clampVisualText(s)).filter((s) => s.length > 0);
}

export function parseUpdateEntityBody(body: unknown): UpdateEntityBody {
  const o = asObject(body);
  const out: UpdateEntityBody = {};
  if (o.canonicalName !== undefined) {
    const name = clampVisualText(o.canonicalName, 200);
    if (!name) throw new HttpError(400, "INVALID_BODY", "O nome canônico não pode ficar vazio.");
    out.canonicalName = name;
  }
  if (o.publicDescription !== undefined) out.publicDescription = clampVisualText(o.publicDescription);
  if (o.scaleDescription !== undefined) out.scaleDescription = clampVisualText(o.scaleDescription);
  if (o.culturalContext !== undefined) out.culturalContext = clampVisualText(o.culturalContext);
  if (o.immutableTraits !== undefined) out.immutableTraits = coerceCanonTraits(o.immutableTraits);
  if (o.flexibleTraits !== undefined) out.flexibleTraits = parseStringList(o.flexibleTraits);
  if (o.prohibitedChanges !== undefined) out.prohibitedChanges = parseStringList(o.prohibitedChanges);
  if (o.visualKeywords !== undefined) out.visualKeywords = parseStringList(o.visualKeywords);
  if (o.negativeInstructions !== undefined) out.negativeInstructions = parseStringList(o.negativeInstructions);
  if (o.aliases !== undefined) out.aliases = parseStringList(o.aliases);
  if (o.status !== undefined) {
    if (!isCanonicalLevel(o.status)) throw new HttpError(400, "INVALID_BODY", "Status de cânone inválido.");
    out.status = o.status;
  }
  if (o.wikiEntryId !== undefined) {
    out.wikiEntryId = typeof o.wikiEntryId === "string" && o.wikiEntryId ? o.wikiEntryId : null;
  }
  return out;
}
