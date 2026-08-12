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

    // The loaded bytes must actually reach the image model, not merely be
    // fetched. editImage is the consumer whenever references exist.
    const editCalls = (deps.editImage as any).mock.calls;
    const genCalls = (deps.generateImage as any).mock.calls;
    const sentRefs = (editCalls[0]?.[1] ?? genCalls[0]?.[1] ?? []) as Buffer[];
    expect(sentRefs.map((b) => b.toString())).toContain("buf:style-1");

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

describe("prompt enhancement", () => {
  it("sends the enhanced brief to the image model instead of the raw lore prose", async () => {
    const prompts: string[] = [];
    const deps = baseDeps({
      enhanceRequest: async () => "Muralha maciça de pedra escura sobre a geleira, contrafortes espessos.",
      generateImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
      editImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(prompts[0]).toContain("Muralha maciça de pedra escura");
  });

  it("records the brief on the generation so the author can see the interpretation", async () => {
    const saved: any[] = [];
    const deps = baseDeps({
      enhanceRequest: async () => "Uma fortaleza de pedra negra.",
      updateGeneration: async (_c: string, g: any) => { saved.push(g); },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(saved[saved.length - 1].enhancedRequest).toBe("Uma fortaleza de pedra negra.");
  });

  it("falls back to the author's own words when enhancement fails", async () => {
    // Enhancement is an optimisation, never a gate: a text-model outage must
    // not stop the author generating an image.
    const prompts: string[] = [];
    const deps = baseDeps({
      enhanceRequest: async () => { throw new Error("openai down"); },
      generateImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
      editImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toBeTruthy();
  });

  it("falls back when the enhancer returns nothing usable", async () => {
    const prompts: string[] = [];
    const deps = baseDeps({
      enhanceRequest: async () => "",
      generateImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
      editImage: async (p: string) => { prompts.push(p); return Buffer.from("img"); },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(prompts[0]).toBeTruthy();
  });
});

describe("approved prompt", () => {
  it("sends the author-approved prompt verbatim instead of recompiling it", async () => {
    // What the author read in the Estudio must be what produced the image.
    const approved = "DIREÇÃO DE ARTE: ...\n\nCENA A ILUSTRAR: uma muralha aprovada pelo autor";
    const gen = { ...newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "texto original" }), compiledPrompt: approved };
    const deps = baseDeps({ getGeneration: vi.fn(async () => gen) });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const sent = (deps.generateImage as any).mock.calls[0][0] as string;
    expect(sent).toContain("uma muralha aprovada pelo autor");
    expect(sent).not.toContain("texto original");
  });

  it("re-applies the style guardrail so an edit cannot drop the palette", async () => {
    const approved = "CENA: uma muralha ao pôr do sol dourado";
    const gen = { ...newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "x" }), compiledPrompt: approved };
    const deps = baseDeps({ getGeneration: vi.fn(async () => gen) });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const sent = (deps.generateImage as any).mock.calls[0][0] as string;
    expect(sent).toContain("tons frios");
    expect(sent).not.toMatch(/tom quente/i);
  });

  it("generates exactly one image — no evaluator, no retries", async () => {
    const deps = baseDeps();
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const calls = (deps.generateImage as any).mock.calls.length + (deps.editImage as any).mock.calls.length;
    expect(calls).toBe(1);
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.retryCount).toBe(0);
    expect(final.consistencyReport).toBeNull();
  });
});

describe("image model provenance", () => {
  it("records the model, size and quality actually configured, not a hardcoded default", async () => {
    // newVisualGeneration stamps "gpt-image-1" at creation time. If the deploy
    // is configured for a different model, that stamp would be a lie and an
    // asset could not be traced back to what produced it.
    const deps = baseDeps({
      imageSettings: { model: "gpt-image-1-mini", size: "1024x1024", quality: "low" },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.model).toBe("gpt-image-1-mini");
    expect(final.size).toBe("1024x1024");
    expect(final.quality).toBe("low");
  });

  it("leaves the generation's own values alone when nothing is configured", async () => {
    const deps = baseDeps();
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.model).toBe("gpt-image-1");
  });
});

describe("failure diagnostics", () => {
  it("records the configured model on failure, not the creation-time placeholder", async () => {
    // A failed generation kept "gpt-image-1" from newVisualGeneration, so
    // timeouts on a different model were attributed to the wrong one.
    const deps = baseDeps({
      imageSettings: { model: "gpt-image-2", size: "1536x1024", quality: "high" },
      generateImage: vi.fn(async () => { throw new Error("Falha ao contatar a IA. Tente novamente."); }),
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.status).toBe("FAILED");
    expect(final.model).toBe("gpt-image-2");
    expect(final.quality).toBe("high");
    expect(final.error).toMatch(/Falha ao contatar a IA/);
  });
});
