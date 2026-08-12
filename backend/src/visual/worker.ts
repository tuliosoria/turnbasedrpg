import type { VisualGeneration, VisualEntity, VisualAsset, VisualStyleBible } from "@ravenloft/content";
import { compileVisualContext, type VisualContextPackage } from "../ai/visual/contextCompiler";
import { selectReferences } from "../ai/visual/referenceSelector";
import { compilePrompt } from "../ai/visual/promptCompiler";
import { applyStyleGuardrail } from "./orchestrator";

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
  enhanceRequest?: (pkg: VisualContextPackage) => Promise<string>;
  /** What the image call is actually configured with, recorded on the
   *  generation so an asset can be traced back to the model that made it. */
  imageSettings?: { model: string; size: string; quality: string };
  /** Emblem images of the Houses the request resolves to. */
  loadCanonReferenceAssets?: (entity: VisualEntity | null, requestText: string) => Promise<VisualAsset[]>;
  newId: () => string;
  now: () => string;
}

export async function runGenerationPipeline(deps: WorkerDeps, campaignId: string, generationId: string): Promise<void> {
  const gen0 = await deps.getGeneration(campaignId, generationId);
  if (!gen0) return;

  let gen: VisualGeneration = { ...gen0, status: "RUNNING" };
  await deps.updateGeneration(campaignId, gen);
  const startedMs = Date.now();
  let enhancedBrief = "";

  try {
    const entity = gen.entityId ? await deps.getEntity(campaignId, gen.entityId) : null;
    const styleBible = (await deps.getActiveStyleBible(campaignId)) ?? fallbackBible(campaignId);
    const entityAssets = gen.entityId ? await deps.listEntityAssets(campaignId, gen.entityId) : [];
    const canonicalAssets = entityAssets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
    const canon = await deps.loadCanonicalCanon(entity, gen.requestText);

    const symbolAssets = deps.loadCanonReferenceAssets
      ? await deps.loadCanonReferenceAssets(entity, gen.requestText)
      : [];

    // The author reviewed and approved this prompt in the Estudio, so it is
    // sent as written. Recompiling here would mean the text they read was not
    // the text that produced the image. Only the style guardrail is re-applied,
    // so an edit cannot silently drop the campaign's palette and lighting.
    let prompt: string;
    if (gen.compiledPrompt.trim()) {
      prompt = applyStyleGuardrail(gen.compiledPrompt, styleBible);
    } else {
      const rawPkg = compileVisualContext({ styleBible, entity, canonicalCanon: canon, userRequest: gen.requestText, hasEmblemReference: symbolAssets.length > 0 });
      let enhanced = "";
      if (deps.enhanceRequest) {
        try {
          enhanced = await deps.enhanceRequest(rawPkg);
        } catch {
          enhanced = "";
        }
      }
      const pkg = enhanced
        ? compileVisualContext({ styleBible, entity, canonicalCanon: canon, userRequest: enhanced, hasEmblemReference: symbolAssets.length > 0 })
        : rawPkg;
      prompt = compilePrompt(pkg);
      enhancedBrief = enhanced;
    }

    const styleRefId = styleBible.referenceAssetIds[0];
    const styleRef = styleRefId ? await deps.getAsset(campaignId, styleRefId) : null;
    const refs = selectReferences({ styleAsset: styleRef, entityAssets: canonicalAssets, symbolAssets, continuityAsset: null });
    const refBuffers = await Promise.all(refs.map((r) => deps.loadReferenceBuffer(r.asset)));

    // One image, once. The previous consistency evaluator judged the result
    // from prompt text without ever receiving the image, so it invented
    // violations and spent up to two extra generations correcting faults that
    // were not there. Review now happens before generation, where it is free.
    // Any reference at all means the edit path: that is how a reference image
    // is applied. Gating on the old GENERATE/EDIT decision meant a brand-new
    // concept discarded the
    // style reference it had just loaded, so the global style was enforced by
    // wording alone precisely when there was no entity canon to lean on.
    const usedReferences = refBuffers.length > 0;
    const image = usedReferences
      ? await deps.editImage(prompt, refBuffers)
      : await deps.generateImage(prompt);

    const assetId = deps.newId();
    const thumb = await deps.makeThumbnail(image);
    const up = await deps.uploadAsset(assetId, image, thumb);

    const asset: VisualAsset = {
      id: assetId, campaignId, entityId: gen.entityId, assetType: gen.assetType ?? "SCENE",
      storageKey: up.key, storageUrl: up.url, thumbnailStorageKey: up.thumbnailKey, thumbnailUrl: up.thumbnailUrl,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "",
      status: "READY", canonicalLevel: "DRAFT", styleBibleVersion: styleBible.version,
      entityVersion: entity?.version ?? null, generationId: gen.id, parentAssetIds: refs.map((r) => r.asset.id),
      referenceRoles: [], cameraAngle: "", viewType: "", description: gen.requestText,
      extractedVisualDescription: "", consistencyScore: null, consistencyReport: null, tags: [],
      createdAt: deps.now(),
    };
    await deps.putAsset(campaignId, asset);

    gen = {
      ...gen, status: "COMPLETED",
      model: deps.imageSettings?.model ?? gen.model,
      size: deps.imageSettings?.size ?? gen.size,
      quality: deps.imageSettings?.quality ?? gen.quality,
      operationType: usedReferences ? "EDIT" : "GENERATE", compiledPrompt: prompt, enhancedRequest: enhancedBrief,
      inputFidelity: usedReferences ? "high" : null, styleBibleVersion: styleBible.version,
      referenceAssetIds: refs.map((r) => r.asset.id), outputAssetIds: [assetId], retryCount: 0,
      consistencyReport: null, latencyMs: Date.now() - startedMs, completedAt: deps.now(),
    };
    await deps.updateGeneration(campaignId, gen);
  } catch (e) {
    // Record what was actually configured even on failure. Without this the
    // record keeps the placeholder stamped at creation time, so a failing
    // generation reports the wrong model and misdirects diagnosis.
    gen = {
      ...gen,
      status: "FAILED",
      model: deps.imageSettings?.model ?? gen.model,
      size: deps.imageSettings?.size ?? gen.size,
      quality: deps.imageSettings?.quality ?? gen.quality,
      error: (e as Error)?.message ?? "erro",
      latencyMs: Date.now() - startedMs,
      completedAt: deps.now(),
    };
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
