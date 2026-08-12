import type { VisualGeneration, VisualEntity, VisualAsset, VisualStyleBible, ConsistencyReport } from "@ravenloft/content";
import { compileVisualContext, type VisualContextPackage } from "../ai/visual/contextCompiler";
import { selectReferences } from "../ai/visual/referenceSelector";
import { compilePrompt, decideOperation } from "../ai/visual/promptCompiler";
import { decideAction } from "../ai/visual/evaluator";

export const MAX_RETRIES = 2;

export interface UploadResult { key: string; url: string; thumbnailKey: string | null; thumbnailUrl: string | null }

export interface WorkerDeps {
  getGeneration: (campaignId: string, id: string) => Promise<VisualGeneration | null>;
  updateGeneration: (campaignId: string, g: VisualGeneration) => Promise<void>;
  getEntity: (campaignId: string, id: string) => Promise<VisualEntity | null>;
  listEntityAssets: (campaignId: string, entityId: string) => Promise<VisualAsset[]>;
  getAsset: (campaignId: string, id: string) => Promise<VisualAsset | null>;
  getActiveStyleBible: (campaignId: string) => Promise<VisualStyleBible | null>;
  loadCanonicalCanon: (entity: VisualEntity | null, requestText: string) => Promise<string>;
  loadReferenceBuffer: (asset: VisualAsset) => Promise<Buffer>;
  generateImage: (prompt: string) => Promise<Buffer>;
  editImage: (prompt: string, references: Buffer[]) => Promise<Buffer>;
  makeThumbnail: (original: Buffer) => Promise<Buffer>;
  uploadAsset: (assetId: string, original: Buffer, thumbnail: Buffer | null) => Promise<UploadResult>;
  putAsset: (campaignId: string, asset: VisualAsset) => Promise<void>;
  evaluate: (image: Buffer, references: Buffer[], pkgPrompt: string, styleBible: VisualStyleBible) => Promise<ConsistencyReport>;
  enhanceRequest?: (pkg: VisualContextPackage) => Promise<string>;
  newId: () => string;
  now: () => string;
}

export async function runGenerationPipeline(deps: WorkerDeps, campaignId: string, generationId: string): Promise<void> {
  const gen0 = await deps.getGeneration(campaignId, generationId);
  if (!gen0) return;

  let gen: VisualGeneration = { ...gen0, status: "RUNNING" };
  await deps.updateGeneration(campaignId, gen);
  const startedMs = Date.now();

  try {
    const entity = gen.entityId ? await deps.getEntity(campaignId, gen.entityId) : null;
    const styleBible = (await deps.getActiveStyleBible(campaignId)) ?? fallbackBible(campaignId);
    const entityAssets = gen.entityId ? await deps.listEntityAssets(campaignId, gen.entityId) : [];
    const canonicalAssets = entityAssets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
    const operation = decideOperation(canonicalAssets);
    const canon = await deps.loadCanonicalCanon(entity, gen.requestText);

    const rawPkg = compileVisualContext({ styleBible, entity, canonicalCanon: canon, userRequest: gen.requestText });

    // The author writes lore prose, which describes purpose and history rather
    // than appearance ("built to delay invaders" has nothing to draw). Convert
    // it to a concrete visual brief before it reaches the image model. A text
    // call is far cheaper than the retry it saves, but enhancement must never
    // block a generation — on failure we fall back to the author's own words.
    let enhanced = "";
    if (deps.enhanceRequest) {
      try {
        enhanced = await deps.enhanceRequest(rawPkg);
      } catch {
        enhanced = "";
      }
    }

    const pkg = enhanced
      ? compileVisualContext({ styleBible, entity, canonicalCanon: canon, userRequest: enhanced })
      : rawPkg;
    const prompt = compilePrompt(pkg);

    // The style-bible reference belongs to the bible, not to the entity being drawn,
    // so it has to be fetched by id rather than looked up among the entity's assets.
    const styleRefId = styleBible.referenceAssetIds[0];
    const styleRef = styleRefId ? await deps.getAsset(campaignId, styleRefId) : null;
    const refs = selectReferences({ styleAsset: styleRef, entityAssets: canonicalAssets, continuityAsset: null });
    const refBuffers = await Promise.all(refs.map((r) => deps.loadReferenceBuffer(r.asset)));

    let image = operation === "EDIT" && refBuffers.length > 0
      ? await deps.editImage(prompt, refBuffers)
      : await deps.generateImage(prompt);

    let report = await deps.evaluate(image, refBuffers, prompt, styleBible);
    let retries = 0;
    let action = decideAction(report, pkg.isLocked);

    while ((action === "AUTO_CORRECT" || action === "CORRECTIVE_EDIT" || action === "REJECT") && retries < MAX_RETRIES) {
      retries++;
      const correction = `${prompt}\n\nCORREÇÕES OBRIGATÓRIAS: ${report.correctionInstructions.join("; ")}`;
      image = refBuffers.length > 0 ? await deps.editImage(correction, [image, ...refBuffers]) : await deps.generateImage(correction);
      report = await deps.evaluate(image, refBuffers, prompt, styleBible);
      action = decideAction(report, pkg.isLocked);
    }

    const assetId = deps.newId();
    const thumb = await deps.makeThumbnail(image);
    const up = await deps.uploadAsset(assetId, image, thumb);

    const finalStatus = action === "ACCEPT" ? "COMPLETED" : "NEEDS_REVIEW";
    const asset: VisualAsset = {
      id: assetId, campaignId, entityId: gen.entityId, assetType: gen.assetType ?? "SCENE",
      storageKey: up.key, storageUrl: up.url, thumbnailStorageKey: up.thumbnailKey, thumbnailUrl: up.thumbnailUrl,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "",
      status: "READY", canonicalLevel: "DRAFT", styleBibleVersion: styleBible.version,
      entityVersion: entity?.version ?? null, generationId: gen.id, parentAssetIds: refs.map((r) => r.asset.id),
      referenceRoles: [], cameraAngle: "", viewType: "", description: gen.requestText,
      extractedVisualDescription: "", consistencyScore: report.overallScore, consistencyReport: report, tags: [],
      createdAt: deps.now(),
    };
    await deps.putAsset(campaignId, asset);

    gen = {
      ...gen, status: finalStatus, operationType: operation, compiledPrompt: prompt, enhancedRequest: enhanced,
      inputFidelity: operation === "EDIT" ? "high" : null, styleBibleVersion: styleBible.version,
      referenceAssetIds: refs.map((r) => r.asset.id), outputAssetIds: [assetId], retryCount: retries,
      consistencyReport: report, latencyMs: Date.now() - startedMs, completedAt: deps.now(),
    };
    await deps.updateGeneration(campaignId, gen);
  } catch (e) {
    gen = { ...gen, status: "FAILED", error: (e as Error)?.message ?? "erro", latencyMs: Date.now() - startedMs, completedAt: deps.now() };
    await deps.updateGeneration(campaignId, gen);
  }
}

function fallbackBible(campaignId: string): VisualStyleBible {
  return {
    campaignId, version: 1, status: "ACTIVE", artMedium: "pintura digital cinematográfica",
    renderingStyle: "dark fantasy gótico medieval", lightingRules: "luz fria e dramática, névoa, neve",
    colorPalette: "tons frios", architectureRenderingRules: "gótico medieval em ruínas",
    characterRenderingRules: "identidade facial sempre preservada", prohibitedStyles: ["anime", "cartoon"],
    globalNegativeInstructions: ["sem texto", "sem marca dágua"], referenceAssetIds: [], createdAt: new Date().toISOString(),
  };
}
