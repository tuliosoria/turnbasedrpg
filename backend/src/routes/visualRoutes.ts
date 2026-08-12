import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { newVisualGeneration, newVisualEntity, type CanonTrait } from "@ravenloft/content";
import { hitRateLimit } from "../db/rateLimit";
import { putGeneration, getGeneration } from "../db/visual/generations";
import { parseGenerateBody, parseCreateEntityBody, parseUpdateEntityBody } from "../validation/visualSchemas";

const GEN_LIMIT = 20;
const GEN_WINDOW_SECONDS = 3600;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createGeneration(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const ip = req.sourceIp || "unknown";
  const count = await hitRateLimit(deps.doc, deps.config.tableName, `visual-gen#${ip}`, GEN_WINDOW_SECONDS);
  if (count > GEN_LIMIT) throw new HttpError(429, "RATE_LIMITED", "Limite de gerações por hora atingido. Tente novamente mais tarde.");

  const { requestText, entityId } = parseGenerateBody(req.body);
  const gen = newVisualGeneration({ id: newId(), campaignId: deps.config.campaignId, requestedBy: ip, requestText });
  gen.entityId = entityId;
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

export async function canonizeAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "CANONICAL");
  return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL" } };
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
import { requireAdmin } from "../auth/adminAuth";

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
