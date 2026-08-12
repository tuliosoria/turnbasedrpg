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
  it("produces a 16-section prompt string containing style and immutable constraints", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", immutableTraits: [{ id: "t1", text: "cicatriz no olho esquerdo", source: "AUTHORED", originAssetId: null, createdAt: "" }] });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "canon", userRequest: "Alic sorrindo" });
    const prompt = compilePrompt(pkg);
    expect(prompt).toContain("dark fantasy");
    expect(prompt).toContain("cicatriz no olho esquerdo");
    expect(prompt).toContain("sem texto");
    expect((prompt.match(/^\d+\./gm) ?? []).length).toBeGreaterThanOrEqual(16);
  });
  it("VISUAL_SYSTEM_PROMPT identifies the art director role", () => {
    expect(VISUAL_SYSTEM_PROMPT).toContain("Diretor de Arte Canônico de Valdren");
  });
});
