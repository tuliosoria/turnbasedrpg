import { describe, it, expect, vi } from "vitest";
import { runGenerationPipeline, type WorkerDeps } from "./worker";
import { newVisualGeneration, type VisualAsset, type VisualGeneration, type VisualStyleBible } from "@ravenloft/content";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE", artMedium: "pintura digital",
  renderingStyle: "dark fantasy", lightingRules: "fria", colorPalette: "tons frios",
  architectureRenderingRules: "gótico", characterRenderingRules: "identidade preservada",
  prohibitedStyles: [], globalNegativeInstructions: [], referenceAssetIds: [], createdAt: "2026-01-01T00:00:00Z",
};

function baseDeps(over: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    getGeneration: vi.fn(async () => newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "castelo nevado" })),
    updateGeneration: vi.fn(async () => {}),
    getEntity: vi.fn(async () => null),
    listEntityAssets: vi.fn(async () => []),
    getAsset: vi.fn(async () => null),
    getActiveStyleBible: vi.fn(async () => bible),
    loadCanonicalCanon: vi.fn(async () => "Valdren é um reino sombrio."),
    loadReferenceBuffer: vi.fn(async () => Buffer.from("ref")),
    generateImage: vi.fn(async () => Buffer.from("generated")),
    editImage: vi.fn(async () => Buffer.from("edited")),
    makeThumbnail: vi.fn(async (b: Buffer) => b),
    uploadAsset: vi.fn(async () => ({ key: "visual/a/original.png", url: "https://x/o.png", thumbnailKey: "t", thumbnailUrl: "https://x/t.png" })),
    putAsset: vi.fn(async () => {}),
    evaluate: vi.fn(async () => ({ overallScore: 95, styleScore: 95, characterIdentityScore: 95, architectureScore: 95, paletteScore: 95, violations: [], recommendedAction: "ACCEPT" as const, correctionInstructions: [] })),
    newId: () => "a1",
    now: () => "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("runGenerationPipeline", () => {
  it("GENERATE + high score → COMPLETED with an output asset", async () => {
    const deps = baseDeps();
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.status).toBe("COMPLETED");
    expect(final.outputAssetIds).toContain("a1");
    expect(deps.generateImage).toHaveBeenCalledTimes(1);
    expect(deps.editImage).not.toHaveBeenCalled();
  });

  it("low score retries then ends NEEDS_REVIEW after exhausting retries", async () => {
    const deps = baseDeps({
      evaluate: vi.fn(async () => ({ overallScore: 50, styleScore: 50, characterIdentityScore: 50, architectureScore: 50, paletteScore: 50, violations: [], recommendedAction: "REJECT" as const, correctionInstructions: [] })),
    });
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.status).toBe("NEEDS_REVIEW");
    expect(final.retryCount).toBeGreaterThanOrEqual(1);
  });

  it("EDIT path used when entity has a canonical asset", async () => {
    const canonicalAsset = { id: "prev", campaignId: "winter-dead", entityId: "alic", assetType: "PORTRAIT" as const, storageKey: "k", storageUrl: "u", thumbnailStorageKey: null, thumbnailUrl: null, mimeType: "image/png", width: 1, height: 1, aspectRatio: "3:2", checksum: "c", status: "READY" as const, canonicalLevel: "CANONICAL" as const, styleBibleVersion: 1, entityVersion: 1, generationId: null, parentAssetIds: [], referenceRoles: ["IDENTITY" as const], cameraAngle: "", viewType: "", description: "", extractedVisualDescription: "", consistencyScore: 90, consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00Z" };
    const gen = { ...newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "Alic sorrindo" }), entityId: "alic" };
    const deps = baseDeps({
      getGeneration: vi.fn(async () => gen),
      getEntity: vi.fn(async () => ({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER" as const, canonicalName: "Alic", aliases: [], slug: "alic", publicDescription: "", immutableTraits: [{ id: "t1", text: "cicatriz no olho esquerdo", source: "AUTHORED" as const, originAssetId: null, createdAt: "" }], wikiEntryId: null, flexibleTraits: [], prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "", culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [], status: "CANONICAL" as const, canonicalAssetIds: ["prev"], supportingAssetIds: [], referenceSheetAssetId: null, mapAssetId: null, version: 1, profile: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" })),
      listEntityAssets: vi.fn(async () => [canonicalAsset]),
    });
    await runGenerationPipeline(deps, "winter-dead", "g1");
    expect(deps.editImage).toHaveBeenCalledTimes(1);
    expect(deps.generateImage).not.toHaveBeenCalled();
  });

  it("marks FAILED when generation is missing", async () => {
    const deps = baseDeps({ getGeneration: vi.fn(async () => null) });
    await runGenerationPipeline(deps, "winter-dead", "missing");
    expect(deps.putAsset).not.toHaveBeenCalled();
  });
});

function makeAsset(over: Partial<VisualAsset> & { id: string }): VisualAsset {
  return {
    campaignId: "winter-dead", entityId: null, assetType: "SCENE", storageKey: "k", storageUrl: "u",
    thumbnailStorageKey: null, thumbnailUrl: null, mimeType: "image/png", width: 1, height: 1,
    aspectRatio: "3:2", checksum: "c", status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1,
    entityVersion: null, generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "",
    viewType: "", description: "", extractedVisualDescription: "", consistencyScore: null,
    consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("style reference resolution", () => {
  it("loads the style reference by id even though it is not an entity asset", async () => {
    // The style-bible reference belongs to the bible, not to the entity being drawn,
    // so it never appears in listEntityAssets.
    const styleAsset = makeAsset({ id: "style-1", entityId: null, storageUrl: "https://x/style-1.png" });
    const otherEntityAsset = makeAsset({ id: "other", entityId: "alic", assetType: "PORTRAIT" });
    const deps = baseDeps({
      getActiveStyleBible: vi.fn(async () => ({ ...bible, referenceAssetIds: ["style-1"] })),
      getAsset: vi.fn(async (_c: string, id: string) => (id === "style-1" ? styleAsset : null)),
      listEntityAssets: vi.fn(async () => [otherEntityAsset]),
      loadReferenceBuffer: vi.fn(async (a: VisualAsset) => Buffer.from(`buf:${a.id}`)),
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(deps.getAsset).toHaveBeenCalledWith("winter-dead", "style-1");
    expect(deps.loadReferenceBuffer).toHaveBeenCalledWith(styleAsset);

    // The loaded bytes must actually reach the pipeline, not merely be fetched.
    const evalRefs = (deps.evaluate as any).mock.calls[0][1] as Buffer[];
    expect(evalRefs.map((b) => b.toString())).toContain("buf:style-1");

    const saved = (deps.putAsset as any).mock.calls[0][1];
    expect(saved.parentAssetIds).toContain("style-1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.referenceAssetIds).toContain("style-1");
  });

  it("skips the style reference when the bible declares none", async () => {
    const deps = baseDeps();
    await runGenerationPipeline(deps, "winter-dead", "g1");
    expect(deps.getAsset).not.toHaveBeenCalled();
    expect(deps.loadReferenceBuffer).not.toHaveBeenCalled();
  });
});

describe("asset type", () => {
  it("uses the assetType from the generation instead of always SCENE", async () => {
    const gen = { ...newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "retrato de Alic" }), assetType: "PORTRAIT" as const };
    const deps = baseDeps({ getGeneration: vi.fn(async () => gen) });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const saved = (deps.putAsset as any).mock.calls[0][1];
    expect(saved.assetType).toBe("PORTRAIT");
  });

  it("falls back to SCENE when the generation has no assetType", async () => {
    // Records written before assetType existed read back from DynamoDB without it.
    const { assetType: _omitted, ...legacy } = newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "castelo nevado" }) as VisualGeneration & { assetType?: unknown };
    const deps = baseDeps({ getGeneration: vi.fn(async () => legacy as VisualGeneration) });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const saved = (deps.putAsset as any).mock.calls[0][1];
    expect(saved.assetType).toBe("SCENE");
  });
});
