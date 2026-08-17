import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import {
  newVisualGeneration, newVisualEntity, isVisualEntityType, clampVisualText,
  type CanonTrait, type VisualEntity, type VisualEntityType,
} from "@ravenloft/content";
import { hitRateLimit } from "../db/rateLimit";
import { putGeneration, getGeneration } from "../db/visual/generations";
import { parseGenerateBody, parseCreateEntityBody, parseUpdateEntityBody, parseUpdateStyleBibleBody, slugify } from "../validation/visualSchemas";
import { listWikiEntries } from "../db/wiki";

// The Estúdio is open to players, so generation is rate limited rather than
// gated. Each request can cost up to three image calls plus three vision
// evaluations, because the worker retries twice on a low consistency score
// (MAX_RETRIES in visual/worker.ts) — so budget in images, not requests.
//
// Per-IP limits alone cannot bound spend: IPs are free to rotate. The daily
// campaign-wide ceiling is the only hard floor under the token bill.
const GEN_COOLDOWN_SECONDS = 60;
const GEN_LIMIT = 5;
const GEN_WINDOW_SECONDS = 3600;
const GEN_DAILY_LIMIT = 30;
const GEN_DAILY_WINDOW_SECONDS = 86400;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Applies the cooldown, hourly and daily ceilings in cheapest-first order.
 *
 * A rejected request still counts against the buckets it already passed, so
 * hammering the button extends the wait rather than earning free retries.
 */
async function enforceGenerationLimits(deps: Deps, ip: string): Promise<void> {
  const table = deps.config.tableName;

  const burst = await hitRateLimit(deps.doc, table, `visual-gen-cd#${ip}`, GEN_COOLDOWN_SECONDS);
  if (burst > 1) {
    throw new HttpError(429, "RATE_LIMITED", "Aguarde um minuto entre as gerações de imagem.");
  }

  const hourly = await hitRateLimit(deps.doc, table, `visual-gen#${ip}`, GEN_WINDOW_SECONDS);
  if (hourly > GEN_LIMIT) {
    throw new HttpError(429, "RATE_LIMITED", `Limite de ${GEN_LIMIT} gerações por hora atingido. Tente novamente mais tarde.`);
  }

  const daily = await hitRateLimit(deps.doc, table, `visual-gen-daily#${deps.config.campaignId}`, GEN_DAILY_WINDOW_SECONDS);
  if (daily > GEN_DAILY_LIMIT) {
    throw new HttpError(429, "RATE_LIMITED", "O limite diário de gerações da campanha foi atingido. Tente novamente amanhã.");
  }
}

export async function createGeneration(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const ip = req.sourceIp || "unknown";
  // The GM bypasses every limit so player traffic can never block turn prep.
  if (!isAdminRequest(deps.config, req)) {
    await enforceGenerationLimits(deps, ip);
  }

  const { requestText, entityId, compiledPrompt, assetType } = parseGenerateBody(req.body);
  const gen = newVisualGeneration({ id: newId(), campaignId: deps.config.campaignId, requestedBy: ip, requestText });
  gen.entityId = entityId;
  // When the author reviewed and approved a prompt in the Estudio, the worker
  // sends exactly that rather than recompiling it — otherwise the text they
  // read would not be the text that produced the image.
  gen.compiledPrompt = compiledPrompt;
  gen.assetType = assetType as typeof gen.assetType;
  await putGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, gen);

  if (deps.invokeWorker) {
    await deps.invokeWorker({ campaignId: deps.config.campaignId, generationId: gen.id });
  }
  return { status: 202, body: { generationId: gen.id, status: gen.status } };
}

export async function getGenerationStatus(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const id = req.pathParams.id;
  const gen = await getGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, id);
  if (!gen) return { status: 404, body: { code: "NOT_FOUND", message: "Geração não encontrada." } };
  return { status: 200, body: gen };
}

import { listEntities, getEntity } from "../db/visual/entities";
import { listAssets, getAsset, setAssetCanonicalLevel } from "../db/visual/assets";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getActiveStyleBible } from "../db/visual/styleBible";
import { campaignPk, assetSk } from "../keys";
import { canDeleteAsset } from "@ravenloft/content";

export async function listVisualEntities(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const entries = await listEntities(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { entries } };
}

export async function getVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const e = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!e) return { status: 404, body: { code: "NOT_FOUND", message: "Entidade não encontrada." } };
  return { status: 200, body: e };
}

export async function listEntityAssets(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const all = await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId);
  const entries = all.filter((a) => a.entityId === req.pathParams.id);
  return { status: 200, body: { entries } };
}

export async function listGallery(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const all = await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId);
  const entries = all.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
  return { status: 200, body: { entries } };
}

/**
 * Canoniza uma imagem e, quando ela não pertence a nenhuma entidade, cria a
 * entidade que passa a representá-la.
 *
 * Antes isto só mudava o nível da imagem. Uma geração feita por "Imagem
 * sem entidade" não tem entidade, então a imagem canonizada virava órfã:
 * aparecia na Galeria e em lugar nenhum mais, e nunca podia ser continuada
 * porque não havia entidade para escolher. O rótulo prometia um canônico novo
 * e entregava só uma figura.
 */
export async function canonizeAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };

  const body = (req.body ?? {}) as Record<string, unknown>;
  const requestedName = clampVisualText(body.canonicalName, 200);

  let entityId = asset.entityId;
  let createdEntity: VisualEntity | null = null;

  if (!entityId) {
    // O nome é do autor quando ele o informa; a descrição do pedido é o
    // recurso final, para nunca bloquear a canonização por falta de rótulo.
    const name = requestedName || clampVisualText(asset.description, 200) || "Canônico sem nome";
    const entityType = isVisualEntityType(body.entityType) ? body.entityType : assetTypeToEntityType(asset.assetType);

    const existing = await listEntities(deps.doc, deps.config.tableName, deps.config.campaignId);
    let slug = slugify(name);
    if (existing.some((e) => e.slug === slug)) slug = `${slug}-${newId().slice(0, 4)}`;

    createdEntity = newVisualEntity({
      id: newId(), campaignId: deps.config.campaignId, entityType,
      canonicalName: name, slug, publicDescription: asset.description,
    });
    createdEntity.canonicalAssetIds = [asset.id];
    createdEntity.status = "CANONICAL";
    await putEntity(deps.doc, deps.config.tableName, deps.config.campaignId, createdEntity);

    entityId = createdEntity.id;
    await putAsset(deps.doc, deps.config.tableName, deps.config.campaignId, {
      ...asset, entityId, canonicalLevel: "CANONICAL",
    });
  } else {
    await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "CANONICAL");
  }

  return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL", entityId, entity: createdEntity } };
}

/** Um retrato vira personagem; um plano geral vira lugar. */
function assetTypeToEntityType(assetType: string): VisualEntityType {
  switch (assetType) {
    case "PORTRAIT":
    case "FULL_BODY":
      return "CHARACTER";
    case "ESTABLISHING":
    case "ARCHITECTURE":
      return "CITY";
    case "MAP":
    case "REGION_MAP":
      return "MAP";
    case "EMBLEM":
      return "SYMBOL";
    case "OBJECT":
      return "ARTIFACT";
    default:
      return "SCENE";
  }
}

export async function getVisualAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  return { status: 200, body: asset };
}

export async function lockAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "LOCKED");
  return { status: 200, body: { id: asset.id, canonicalLevel: "LOCKED" } };
}

export async function unlockAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "CANONICAL");
  return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL" } };
}

export async function deleteAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  if (!canDeleteAsset(asset.canonicalLevel)) throw new HttpError(409, "ASSET_LOCKED", "Imagens travadas não podem ser excluídas. Destrave primeiro.");
  await deps.doc.send(new DeleteCommand({ TableName: deps.config.tableName, Key: { PK: campaignPk(deps.config.campaignId), SK: assetSk(asset.id) } }));
  return { status: 200, body: { id: asset.id, deleted: true } };
}

export async function getStyleBible(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const b = await getActiveStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!b) return { status: 404, body: { code: "NOT_FOUND", message: "Bíblia visual não definida." } };
  return { status: 200, body: b };
}

import { decideOperation } from "../ai/visual/promptCompiler";

export async function previewContext(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { entityId } = parseGenerateBody(req.body);
  const warnings: string[] = [];
  let operation: "GENERATE" | "EDIT" = "GENERATE";
  let referenceCount = 0;

  if (entityId) {
    const entity = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, entityId);
    if (entity) {
      const assets = (await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId)).filter((a) => a.entityId === entityId);
      const canonical = assets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
      operation = decideOperation(canonical);
      referenceCount = Math.min(canonical.length, 2) + 1;
      if (entity.immutableTraits.length) warnings.push(`Traços imutáveis de ${entity.canonicalName} serão preservados.`);
      if (entity.status === "LOCKED") warnings.push(`${entity.canonicalName} está travado (LOCKED): o pedido não poderá alterar sua identidade canônica.`);
      if (operation === "EDIT") warnings.push(`Esta geração continua a identidade canônica existente de ${entity.canonicalName}.`);
    }
  }
  return { status: 200, body: { operation, referenceCount, warnings } };
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { putStyleBible } from "../db/visual/styleBible";
import { putEntity } from "../db/visual/entities";
import { putAsset } from "../db/visual/assets";
import { seedVisualEncyclopedia, type SeedDeps } from "../visual/seed";
import { requireAdmin, isAdminRequest } from "../auth/adminAuth";

const SEED_IMAGE_DIR = process.env.SEED_IMAGE_DIR || "/var/task/seed-images";

export async function seedVisual(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.imageStore) throw new HttpError(503, "IMAGE_DISABLED", "Armazenamento de imagens não configurado.");
  const store = deps.imageStore;
  let counter = 0;
  const seedDeps: SeedDeps = {
    getActiveStyleBible: (c) => getActiveStyleBible(deps.doc, deps.config.tableName, c),
    putStyleBible: (c, b) => putStyleBible(deps.doc, deps.config.tableName, c, b),
    getEntity: (c, id) => getEntity(deps.doc, deps.config.tableName, c, id),
    putEntity: (c, e) => putEntity(deps.doc, deps.config.tableName, c, e),
    putAsset: (c, a) => putAsset(deps.doc, deps.config.tableName, c, a),
    loadSeedImage: (file) => readFile(join(SEED_IMAGE_DIR, file)),
    uploadAsset: async (assetId, original) => {
      const { default: sharp } = await import("sharp");
      const thumb = await sharp(original).resize(512).png().toBuffer();
      return store.uploadVisualAsset(assetId, original, thumb);
    },
    newId: () => `${Date.now().toString(36)}-${(counter++).toString(36)}`,
    now: () => new Date().toISOString(),
  };
  const summary = await seedVisualEncyclopedia(seedDeps, deps.config.campaignId);
  return { status: 200, body: summary };
}

export async function createVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseCreateEntityBody(req.body);

  const existing = await listEntities(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (existing.some((e) => e.slug === body.slug)) {
    throw new HttpError(409, "ENTITY_EXISTS", `Já existe uma entidade com o identificador "${body.slug}".`);
  }

  const entity = newVisualEntity({
    id: newId(),
    campaignId: deps.config.campaignId,
    entityType: body.entityType,
    canonicalName: body.canonicalName,
    slug: body.slug,
    publicDescription: body.publicDescription,
    wikiEntryId: body.wikiEntryId,
  });
  await putEntity(deps.doc, deps.config.tableName, deps.config.campaignId, entity);
  return { status: 201, body: entity };
}

export async function updateVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const current = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!current) return { status: 404, body: { code: "NOT_FOUND", message: "Entidade não encontrada." } };

  const patch = parseUpdateEntityBody(req.body);

  // Provenance is server-owned. A trait that already exists keeps the source and
  // origin asset it was stored with, and only its text may be edited. Anything
  // new is AUTHORED by definition — a client must never be able to claim that a
  // hand-typed trait was DISCOVERED by some image, because that would forge the
  // audit trail the whole canon engine rests on. Only the Phase 2 discovery flow
  // mints DISCOVERED traits, server-side.
  const existingById = new Map(current.immutableTraits.map((t) => [t.id, t]));
  const traits: CanonTrait[] | undefined = patch.immutableTraits?.map((t) => {
    const prior = existingById.get(t.id);
    if (prior) return { ...prior, text: t.text };
    return {
      id: newId(),
      text: t.text,
      source: "AUTHORED" as const,
      originAssetId: null,
      createdAt: new Date().toISOString(),
    };
  });

  const updated = {
    ...current,
    ...patch,
    ...(traits ? { immutableTraits: traits } : {}),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  await putEntity(deps.doc, deps.config.tableName, deps.config.campaignId, updated);
  return { status: 200, body: updated };
}

export async function getVisualCoverage(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const [entries, entities] = await Promise.all([
    listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId),
    listEntities(deps.doc, deps.config.tableName, deps.config.campaignId),
  ]);

  const linked = new Set(entities.map((e) => e.wikiEntryId).filter((id): id is string => !!id));
  const bySection = new Map<string, { section: string; total: number; covered: number }>();
  for (const entry of entries) {
    const row = bySection.get(entry.section) ?? { section: entry.section, total: 0, covered: 0 };
    row.total += 1;
    if (linked.has(entry.entryId)) row.covered += 1;
    bySection.set(entry.section, row);
  }

  return {
    status: 200,
    body: {
      totalEntries: entries.length,
      coveredEntries: entries.filter((e) => linked.has(e.entryId)).length,
      sections: [...bySection.values()],
      unlinkedEntities: entities
        .filter((e) => !e.wikiEntryId)
        .map((e) => ({ id: e.id, canonicalName: e.canonicalName })),
    },
  };
}

export async function updateStyleBible(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const current = await getActiveStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!current) return { status: 404, body: { code: "NOT_FOUND", message: "Bíblia visual não definida." } };

  const patch = parseUpdateStyleBibleBody(req.body);

  const next = {
    ...current,
    ...patch,
    version: current.version + 1,
    status: "ACTIVE" as const,
    createdAt: new Date().toISOString(),
  };

  // Publish before archiving. getActiveStyleBible takes the highest-versioned
  // ACTIVE record, so a crash between these two writes leaves a harmless stale
  // ACTIVE row that is never the max. The reverse order would leave the campaign
  // with zero ACTIVE bibles, which does not self-heal: the retry 404s, and image
  // generation silently falls back to a hardcoded version 1 that points at an
  // unrelated archived record.
  await putStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId, next);
  await putStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId, {
    ...current,
    status: "ARCHIVED",
  });
  return { status: 200, body: next };
}


import { parseEnhancePromptBody } from "../validation/visualSchemas";
import { orchestratePrompt } from "../visual/orchestrator";
import { resolveCanonReferences } from "../visual/canonReferences";

const ENHANCE_LIMIT = 30;
const ENHANCE_WINDOW_SECONDS = 3600;

/**
 * Builds the prompt without generating an image, so the author can read and
 * edit exactly what the image model will receive. Rate limited separately and
 * more generously than generation: this costs one cheap text call, and
 * reviewing before spending is the behaviour we want to encourage.
 */
export async function enhancePrompt(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const ip = req.sourceIp || "unknown";
  if (!isAdminRequest(deps.config, req)) {
    const n = await hitRateLimit(deps.doc, deps.config.tableName, `visual-enhance#${ip}`, ENHANCE_WINDOW_SECONDS);
    if (n > ENHANCE_LIMIT) {
      throw new HttpError(429, "RATE_LIMITED", "Limite de preparações de prompt por hora atingido.");
    }
  }

  const { requestText, entityId, assetType } = parseEnhancePromptBody(req.body);
  const entity = entityId ? await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, entityId) : null;
  const styleBible = await getActiveStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!styleBible) {
    return { status: 404, body: { code: "NOT_FOUND", message: "Bíblia visual não definida." } };
  }
  const wikiEntries = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);

  // The emblem only attaches at generation time, but the prompt must say so
  // during review — otherwise the author reads a prompt that differs from the
  // one that produces their image.
  const [entities, assets] = await Promise.all([
    listEntities(deps.doc, deps.config.tableName, deps.config.campaignId),
    listAssets(deps.doc, deps.config.tableName, deps.config.campaignId),
  ]);
  const emblems = resolveCanonReferences({ requestText, entity, wikiEntries, entities, assets });
  const hasEmblemReference = emblems.length > 0;
  const emblemDescription = emblems[0]?.extractedVisualDescription ?? "";

  const result = await orchestratePrompt({
    requestText, entity, styleBible, wikiEntries, chat: deps.chat, assetType, hasEmblemReference, emblemDescription,
  });
  return { status: 200, body: result };
}
