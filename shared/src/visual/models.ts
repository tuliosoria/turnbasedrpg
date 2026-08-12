export const CANONICAL_LEVELS = ["DRAFT", "CANDIDATE", "CANONICAL", "LOCKED"] as const;
export type CanonicalLevel = (typeof CANONICAL_LEVELS)[number];

export const VISUAL_ENTITY_TYPES = [
  "CHARACTER", "HOUSE", "CITY", "SETTLEMENT", "REGION", "LANDMARK", "CREATURE",
  "ANCESTRY", "ARTIFACT", "VEHICLE", "SHIP", "BUILDING", "ROOM", "MAP", "SYMBOL",
  "WEAPON", "CLOTHING_SET", "EVENT", "SCENE",
] as const;
export type VisualEntityType = (typeof VISUAL_ENTITY_TYPES)[number];

export const VISUAL_ASSET_TYPES = [
  "PORTRAIT", "FULL_BODY", "SCENE", "ESTABLISHING", "MAP", "REGION_MAP",
  "REFERENCE_SHEET", "EMBLEM", "OBJECT", "ARCHITECTURE",
] as const;
export type VisualAssetType = (typeof VISUAL_ASSET_TYPES)[number];

export const GENERATION_STATUSES = ["PENDING", "RUNNING", "NEEDS_REVIEW", "COMPLETED", "FAILED"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const GENERATION_OPERATIONS = ["GENERATE", "EDIT"] as const;
export type GenerationOperation = (typeof GENERATION_OPERATIONS)[number];

export const REFERENCE_ROLES = [
  "STYLE", "IDENTITY", "FACE", "BODY", "COSTUME", "ARCHITECTURE", "GEOGRAPHY",
  "COMPOSITION", "LIGHTING", "OBJECT", "SYMBOL", "CONTINUITY",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const TRAIT_SOURCES = ["AUTHORED", "DISCOVERED", "LORE"] as const;
export type TraitSource = (typeof TRAIT_SOURCES)[number];

export interface CanonTrait {
  id: string;
  text: string;
  source: TraitSource;
  originAssetId: string | null;
  createdAt: string;
}

export interface NewCanonTraitInput {
  id: string;
  text: string;
  source?: TraitSource;
  originAssetId?: string | null;
}

export function newCanonTrait(input: NewCanonTraitInput): CanonTrait {
  return {
    id: input.id,
    text: clampVisualText(input.text),
    source: input.source ?? "AUTHORED",
    originAssetId: input.originAssetId ?? null,
    createdAt: new Date().toISOString(),
  };
}

function isTraitSource(v: unknown): v is TraitSource {
  return typeof v === "string" && (TRAIT_SOURCES as readonly string[]).includes(v);
}

/**
 * Accepts either the current CanonTrait[] shape or the legacy string[] shape and
 * always returns CanonTrait[]. Legacy strings become AUTHORED traits with no
 * origin asset, since nothing recorded where they came from.
 */
export function coerceCanonTraits(value: unknown): CanonTrait[] {
  if (!Array.isArray(value)) return [];

  // `id` is the trait's identity for edit and delete, so every returned trait
  // must have a distinct one no matter what the stored array contained. Collect
  // the explicitly stored ids up front, otherwise a synthesized id could collide
  // with an explicit id that only appears later in the array.
  const storedIds = new Set<string>();
  for (const raw of value) {
    if (typeof raw === "object" && raw !== null) {
      const id = (raw as Record<string, unknown>).id;
      if (typeof id === "string" && id) storedIds.add(id);
    }
  }

  const usedIds = new Set<string>();
  let nextLegacy = 0;
  const synthesizeId = (): string => {
    let id = `legacy-${nextLegacy++}`;
    while (storedIds.has(id) || usedIds.has(id)) id = `legacy-${nextLegacy++}`;
    usedIds.add(id);
    return id;
  };
  // Falls back to a synthesized id when the stored data repeats one, so the
  // first element keeps the id it was saved with.
  const claimId = (id: unknown): string => {
    if (typeof id === "string" && id && !usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    return synthesizeId();
  };

  const out: CanonTrait[] = [];
  for (const raw of value) {
    if (typeof raw === "string") {
      const text = clampVisualText(raw);
      if (!text) continue;
      out.push({
        id: synthesizeId(),
        text,
        source: "AUTHORED",
        originAssetId: null,
        createdAt: "",
      });
      continue;
    }
    if (typeof raw !== "object" || raw === null) continue;
    const o = raw as Record<string, unknown>;
    const text = clampVisualText(o.text);
    if (!text) continue;
    out.push({
      id: claimId(o.id),
      text,
      source: isTraitSource(o.source) ? o.source : "AUTHORED",
      originAssetId: typeof o.originAssetId === "string" ? o.originAssetId : null,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    });
  }
  return out;
}

export const VISUAL_TEXT_MAX = 2000;

export function isCanonicalLevel(v: unknown): v is CanonicalLevel {
  return typeof v === "string" && (CANONICAL_LEVELS as readonly string[]).includes(v);
}
export function isVisualEntityType(v: unknown): v is VisualEntityType {
  return typeof v === "string" && (VISUAL_ENTITY_TYPES as readonly string[]).includes(v);
}
export function isGenerationStatus(v: unknown): v is GenerationStatus {
  return typeof v === "string" && (GENERATION_STATUSES as readonly string[]).includes(v);
}
export function clampVisualText(v: unknown, max = VISUAL_TEXT_MAX): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}
export function canDeleteAsset(level: CanonicalLevel): boolean {
  return level !== "LOCKED";
}

export interface VisualStyleBible {
  campaignId: string;
  version: number;
  status: "ACTIVE" | "ARCHIVED";
  artMedium: string;
  renderingStyle: string;
  lightingRules: string;
  colorPalette: string;
  architectureRenderingRules: string;
  characterRenderingRules: string;
  prohibitedStyles: string[];
  globalNegativeInstructions: string[];
  referenceAssetIds: string[];
  createdAt: string;
}

export interface VisualEntity {
  id: string;
  campaignId: string;
  entityType: VisualEntityType;
  canonicalName: string;
  aliases: string[];
  slug: string;
  publicDescription: string;
  immutableTraits: CanonTrait[];
  wikiEntryId: string | null;
  flexibleTraits: string[];
  prohibitedChanges: string[];
  visualKeywords: string[];
  negativeInstructions: string[];
  scaleDescription: string;
  culturalContext: string;
  houseId: string | null;
  regionId: string | null;
  parentEntityId: string | null;
  relatedEntityIds: string[];
  status: CanonicalLevel;
  canonicalAssetIds: string[];
  supportingAssetIds: string[];
  referenceSheetAssetId: string | null;
  mapAssetId: string | null;
  version: number;
  profile: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsistencyViolation {
  severity: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  description: string;
}
export interface ConsistencyReport {
  overallScore: number;
  styleScore: number;
  characterIdentityScore: number;
  architectureScore: number;
  paletteScore: number;
  violations: ConsistencyViolation[];
  recommendedAction: "ACCEPT" | "AUTO_CORRECT" | "CORRECTIVE_EDIT" | "REJECT" | "NEEDS_REVIEW";
  correctionInstructions: string[];
}

export interface VisualAsset {
  id: string;
  campaignId: string;
  entityId: string | null;
  assetType: VisualAssetType;
  storageKey: string;
  storageUrl: string;
  thumbnailStorageKey: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: string;
  checksum: string;
  status: "READY" | "PENDING";
  canonicalLevel: CanonicalLevel;
  styleBibleVersion: number;
  entityVersion: number | null;
  generationId: string | null;
  parentAssetIds: string[];
  referenceRoles: ReferenceRole[];
  cameraAngle: string;
  viewType: string;
  description: string;
  extractedVisualDescription: string;
  consistencyScore: number | null;
  consistencyReport: ConsistencyReport | null;
  tags: string[];
  createdAt: string;
}

export interface VisualGeneration {
  id: string;
  campaignId: string;
  requestedBy: string;
  requestText: string;
  entityId: string | null;
  assetType: VisualAssetType;
  compiledPrompt: string;
  operationType: GenerationOperation;
  model: string;
  inputFidelity: "high" | "low" | null;
  size: string;
  quality: string;
  styleBibleVersion: number | null;
  entityVersions: Record<string, number>;
  referenceAssetIds: string[];
  sceneThreadId: string | null;
  outputAssetIds: string[];
  status: GenerationStatus;
  retryCount: number;
  usage: Record<string, number> | null;
  estimatedCost: number | null;
  latencyMs: number | null;
  consistencyReport: ConsistencyReport | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NewVisualEntityInput {
  id: string;
  campaignId: string;
  entityType: VisualEntityType;
  canonicalName: string;
  slug: string;
  publicDescription?: string;
  immutableTraits?: CanonTrait[] | string[];
  wikiEntryId?: string | null;
  houseId?: string | null;
  regionId?: string | null;
}
export function newVisualEntity(input: NewVisualEntityInput): VisualEntity {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    entityType: input.entityType,
    canonicalName: clampVisualText(input.canonicalName, 200),
    aliases: [],
    slug: input.slug,
    publicDescription: clampVisualText(input.publicDescription),
    immutableTraits: coerceCanonTraits(input.immutableTraits),
    wikiEntryId: input.wikiEntryId ?? null,
    flexibleTraits: [],
    prohibitedChanges: [],
    visualKeywords: [],
    negativeInstructions: [],
    scaleDescription: "",
    culturalContext: "",
    houseId: input.houseId ?? null,
    regionId: input.regionId ?? null,
    parentEntityId: null,
    relatedEntityIds: [],
    status: "DRAFT",
    canonicalAssetIds: [],
    supportingAssetIds: [],
    referenceSheetAssetId: null,
    mapAssetId: null,
    version: 1,
    profile: null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface NewVisualGenerationInput {
  id: string;
  campaignId: string;
  requestedBy: string;
  requestText: string;
  entityId?: string | null;
}
export function newVisualGeneration(input: NewVisualGenerationInput): VisualGeneration {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    requestedBy: input.requestedBy,
    requestText: clampVisualText(input.requestText),
    entityId: input.entityId ?? null,
    assetType: "SCENE",
    compiledPrompt: "",
    operationType: "GENERATE",
    model: "gpt-image-1",
    inputFidelity: null,
    size: "1536x1024",
    quality: "medium",
    styleBibleVersion: null,
    entityVersions: {},
    referenceAssetIds: [],
    sceneThreadId: null,
    outputAssetIds: [],
    status: "PENDING",
    retryCount: 0,
    usage: null,
    estimatedCost: null,
    latencyMs: null,
    consistencyReport: null,
    error: null,
    createdAt: now,
    completedAt: null,
  };
}
