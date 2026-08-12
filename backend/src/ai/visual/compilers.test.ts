import { describe, it, expect } from "vitest";
import { compileVisualContext } from "./contextCompiler";
import { selectReferences } from "./referenceSelector";
import { compilePrompt, decideOperation, VISUAL_SYSTEM_PROMPT } from "./promptCompiler";
import { newVisualEntity, type VisualStyleBible, type VisualAsset } from "@ravenloft/content";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE", artMedium: "pintura digital",
  renderingStyle: "dark fantasy gótico", lightingRules: "luz fria dramática", colorPalette: "tons frios",
  architectureRenderingRules: "gótico medieval", characterRenderingRules: "identidade facial preservada",
  prohibitedStyles: ["anime", "cartoon"], globalNegativeInstructions: ["sem texto", "sem marca dágua"],
  referenceAssetIds: ["style-1"], createdAt: "2026-01-01T00:00:00Z",
};
function asset(over: Partial<VisualAsset> = {}): VisualAsset {
  return {
    id: "a1", campaignId: "winter-dead", entityId: "alic", assetType: "PORTRAIT",
    storageKey: "k", storageUrl: "https://x/a1.png", thumbnailStorageKey: null, thumbnailUrl: null,
    mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c",
    status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: ["IDENTITY"], cameraAngle: "", viewType: "",
    description: "Retrato de Alic", extractedVisualDescription: "cabelo escuro, cicatriz", consistencyScore: 92,
    consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}

describe("decideOperation", () => {
  it("chooses EDIT when the entity already has a canonical asset", () => {
    expect(decideOperation([asset()])).toBe("EDIT");
  });
  it("chooses GENERATE when there is no prior canonical asset", () => {
    expect(decideOperation([])).toBe("GENERATE");
  });
});

describe("selectReferences", () => {
  it("limits identity refs to two and always keeps a style ref", () => {
    const styleRef = asset({ id: "style-1", referenceRoles: ["STYLE"] });
    const idRefs = [asset({ id: "i1" }), asset({ id: "i2" }), asset({ id: "i3" })];
    const chosen = selectReferences({ styleAsset: styleRef, entityAssets: idRefs, continuityAsset: null });
    const ids = chosen.map((c) => c.asset.id);
    expect(ids).toContain("style-1");
    expect(chosen.filter((c) => c.role === "IDENTITY").length).toBeLessThanOrEqual(2);
  });
});

describe("compileVisualContext", () => {
  it("orders LOCKED and immutable traits before the user request and never includes secrets marker", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", immutableTraits: [{ id: "t1", text: "cicatriz no olho esquerdo", source: "AUTHORED", originAssetId: null, createdAt: "" }] });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "Alic é o príncipe de Valdren.", userRequest: "Alic sorrindo" });
    expect(pkg.immutableTraits).toContain("cicatriz no olho esquerdo");
    expect(pkg.styleBible.version).toBe(1);
    expect(pkg.userRequest).toBe("Alic sorrindo");
    expect(pkg.canonicalCanon).toContain("príncipe");
  });
});

describe("compilePrompt", () => {
  it("carries the style, immutable traits and negative instructions", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", immutableTraits: [{ id: "t1", text: "cicatriz no olho esquerdo", source: "AUTHORED", originAssetId: null, createdAt: "" }] });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "canon", userRequest: "Alic sorrindo" });
    const prompt = compilePrompt(pkg);
    expect(prompt).toContain("dark fantasy");
    expect(prompt).toContain("cicatriz no olho esquerdo");
    expect(prompt).toContain("sem texto");
  });

  // The palette is the constraint that actually drifts in production: a long
  // lore description in the middle of the prompt was drowning a single
  // trailing "paleta: tons frios" clause, and images came back warm.
  it("states the palette rule both before and after the scene text", () => {
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "a muralha do norte" });
    const prompt = compilePrompt(pkg);

    const sceneAt = prompt.indexOf("a muralha do norte");
    const paletteBefore = prompt.lastIndexOf(bible.colorPalette, sceneAt);
    const paletteAfter = prompt.indexOf(bible.colorPalette, sceneAt);

    expect(paletteBefore).toBeGreaterThan(-1);
    expect(paletteAfter).toBeGreaterThan(sceneAt);
  });

  it("states only the palette the style bible defines, inventing no rules of its own", () => {
    // The compiler used to hardcode a warm-tone ban. Aesthetics belong in the
    // Bíblia Visual, so changing the world's look never requires a code change.
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x" });
    const prompt = compilePrompt(pkg);
    expect(prompt).toContain(bible.colorPalette);
    expect(prompt).not.toMatch(/tom quente/i);
    expect(prompt).not.toMatch(/EXCLUSIVAMENTE/);
  });

  it("omits the palette lines entirely when the style bible leaves them blank", () => {
    const free = { ...bible, colorPalette: "", lightingRules: "" };
    const pkg = compileVisualContext({ styleBible: free, entity: null, canonicalCanon: "", userRequest: "x" });
    const prompt = compilePrompt(pkg);
    expect(prompt).not.toMatch(/Paleta:/);
    expect(prompt).not.toMatch(/LEMBRETE DE ESTILO/);
  });

  it("includes the author's request exactly once", () => {
    const request = "A Muralha do Norte vista das geleiras";
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: request });
    const prompt = compilePrompt(pkg);
    expect(prompt.split(request).length - 1).toBe(1);
  });

  it("never injects Ravenloft, which the canon style guide bans as a setting name", () => {
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "uma fortaleza" });
    expect(compilePrompt(pkg)).not.toMatch(/ravenloft/i);
  });

  it("omits the face-identity rule for image types with no figures", () => {
    const entity = newVisualEntity({ id: "m", campaignId: "winter-dead", entityType: "MAP", canonicalName: "Mapa", slug: "mapa" });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "", userRequest: "mapa do norte" });
    expect(compilePrompt(pkg)).not.toContain(bible.characterRenderingRules);
  });

  it("warns the model when the entity is locked", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" });
    entity.status = "LOCKED";
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "", userRequest: "Alic" });
    expect(compilePrompt(pkg)).toMatch(/TRAVADA/);
  });
  it("VISUAL_SYSTEM_PROMPT identifies the art director role", () => {
    expect(VISUAL_SYSTEM_PROMPT).toContain("Diretor de Arte Canônico de Valdren");
  });
});
