import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeImageFn, makeImageEditFn } from "./ai/images";
import { makeImageStore } from "./storage/images";
import { makeDocClient } from "./db/dynamo";
import { getGeneration, updateGeneration } from "./db/visual/generations";
import { getEntity } from "./db/visual/entities";
import { getAsset, listAssets, putAsset } from "./db/visual/assets";
import { getActiveStyleBible } from "./db/visual/styleBible";
import { runGenerationPipeline, type WorkerDeps } from "./visual/worker";
 import { runEnhancer } from "./visual/enhancerRunner";
import { buildCanonicalCanon } from "./visual/canon";
import { listCanonWikiEntries } from "./db/wiki";
import { listEntities } from "./db/visual/entities";
import { resolveCanonReferences } from "./visual/canonReferences";

const config = loadConfig();
const region = process.env.AWS_REGION;
const doc = makeDocClient(region);
const imageOpts = { model: config.openAiImageModel, size: config.openAiImageSize, quality: config.openAiImageQuality, inputFidelity: config.openAiImageInputFidelity || null };
// The Lambda itself has 900s. gpt-image-2 at high quality measured ~121s, so a
// 120s client timeout was a coin flip — observed failing at 120027ms and
// 120111ms while a sibling request completed at 121001ms. Raising quality
// without raising this budget is what broke it.
const IMAGE_TIMEOUT_MS = 600000;
const generate = makeImageFn(config.openAiApiKey, IMAGE_TIMEOUT_MS, imageOpts);
const edit = makeImageEditFn(config.openAiApiKey, IMAGE_TIMEOUT_MS, imageOpts);
const chat = makeChatFn(config.openAiApiKey, config.openAiModel);
const imageStore = makeImageStore(
  config.imagesBucket,
  `https://${config.imagesBucket}.s3.${region ?? "us-east-1"}.amazonaws.com`,
  region,
);

interface WorkerEvent { campaignId: string; generationId: string }

export async function handler(event: WorkerEvent): Promise<void> {
  const deps: WorkerDeps = {
    getGeneration: (c, id) => getGeneration(doc, config.tableName, c, id),
    updateGeneration: (c, g) => updateGeneration(doc, config.tableName, c, g),
    getEntity: (c, id) => getEntity(doc, config.tableName, c, id),
    listEntityAssets: async (c, entityId) => (await listAssets(doc, config.tableName, c)).filter((a) => a.entityId === entityId),
    getAsset: (c, id) => getAsset(doc, config.tableName, c, id),
    getActiveStyleBible: (c) => getActiveStyleBible(doc, config.tableName, c),
    loadCanonReferenceAssets: async (entity, requestText) => {
      const [wikiEntries, entities, assets] = await Promise.all([
        listCanonWikiEntries(doc, config.tableName, config.campaignId),
        listEntities(doc, config.tableName, config.campaignId),
        listAssets(doc, config.tableName, config.campaignId),
      ]);
      return resolveCanonReferences({ requestText, entity, wikiEntries, entities, assets });
    },
    loadCanonicalCanon: async (entity, requestText) =>
      buildCanonicalCanon(entity, requestText, await listCanonWikiEntries(doc, config.tableName, config.campaignId)),
    loadReferenceBuffer: async (asset) => {
      const res = await fetch(asset.storageUrl);
      return Buffer.from(await res.arrayBuffer());
    },
    generateImage: (prompt) => generate(prompt),
    editImage: (prompt, references) => edit(prompt, references),
    makeThumbnail: async (original) => {
      const { default: sharp } = await import("sharp");
      return sharp(original).resize(512).png().toBuffer();
    },
    uploadAsset: (assetId, original, thumbnail) => imageStore.uploadVisualAsset(assetId, original, thumbnail),
    putAsset: (c, asset) => putAsset(doc, config.tableName, c, asset),
    enhanceRequest: (pkg) => runEnhancer(chat, pkg),
    imageSettings: imageOpts,
    newId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    now: () => new Date().toISOString(),
  };
  await runGenerationPipeline(deps, event.campaignId, event.generationId);
}
