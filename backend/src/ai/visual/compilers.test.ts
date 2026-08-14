import { describe, it, expect } from "vitest";
import { compileVisualContext } from "./contextCompiler";
import { selectReferences } from "./referenceSelector";
import { compilePrompt, decideOperation, VISUAL_SYSTEM_PROMPT } from "./promptCompiler";
import { buildStyleBibleV1 } from "../../visual/seed";
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

  // Este teste dizia "nunca injeta Ravenloft", e não era verdade: o compilador
  // não filtra nada, e a Bíblia Visual em produção trazia a palavra — os
  // prompts gravados provam. Ele passava porque a fixture não a continha.
  //
  // O compilador repassar o estilo sem editar é o desenho pretendido: mudar a
  // aparência de Valdren é edição da Bíblia, nunca mudança de código. Então o
  // que se garante aqui é o repasse, e o nome do cenário fica fora da Bíblia.
  it("repassa o estilo da Bíblia sem editar, inclusive o que não deveria estar lá", () => {
    const contaminated = { ...bible, renderingStyle: "gótico medieval, Ravenloft" };
    const pkg = compileVisualContext({ styleBible: contaminated, entity: null, canonicalCanon: "", userRequest: "uma fortaleza" });

    expect(compilePrompt(pkg)).toContain("gótico medieval, Ravenloft");
  });

  it("não traz nome de cenário no estilo padrão de uma campanha nova", () => {
    const seeded = buildStyleBibleV1("winter-dead", new Date().toISOString());
    expect(seeded.renderingStyle).not.toMatch(/ravenloft/i);
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

describe("selectReferences priority and budget", () => {
  const a = (id: string) => asset({ id, referenceRoles: [] });

  it("attaches House heraldry after the subject's own identity", () => {
    const chosen = selectReferences({
      styleAsset: a("style"), entityAssets: [a("face")], symbolAssets: [a("emblem")], continuityAsset: null,
    });
    expect(chosen.map((c) => [c.asset.id, c.role])).toEqual([
      ["style", "STYLE"], ["face", "IDENTITY"], ["emblem", "SYMBOL"],
    ]);
  });

  it("never drops the subject's face in favour of a banner", () => {
    // The limit truncates from the end, so identity must precede symbols.
    const chosen = selectReferences({
      styleAsset: a("style"), entityAssets: [a("face")],
      symbolAssets: [a("e1"), a("e2"), a("e3")], continuityAsset: null, limit: 3,
    });
    expect(chosen.map((c) => c.asset.id)).toEqual(["style", "face", "e1"]);
  });

  it("does not attach the same asset twice", () => {
    const dup = a("same");
    const chosen = selectReferences({
      styleAsset: dup, entityAssets: [dup], symbolAssets: [dup], continuityAsset: dup,
    });
    expect(chosen).toHaveLength(1);
  });
});

describe("emblem reference instruction", () => {
  it("tells the model the attached image is the exact arms", () => {
    // Without this the blazon reads as a description to reinterpret, and the
    // arms get redrawn in a new style on every generation.
    const pkg = compileVisualContext({
      styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x", hasEmblemReference: true,
    });
    const prompt = compilePrompt(pkg);
    expect(prompt).toMatch(/BRASÃO CANÔNICO — REGRA ABSOLUTA/);
    expect(prompt).toMatch(/COPIE esse brasão EXATAMENTE/);
  });

  it("scopes the emblem reference to heraldry, not to scene style", () => {
    const pkg = compileVisualContext({
      styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x", hasEmblemReference: true,
    });
    expect(compilePrompt(pkg)).toMatch(/APENAS de heráldica/);
  });

  it("says nothing about an emblem when none is attached", () => {
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x" });
    expect(compilePrompt(pkg)).not.toMatch(/BRASÃO CANÔNICO/);
  });
});

describe("framing by asset type", () => {
  const pkgFor = (assetType: string) =>
    compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "a capital", assetType });

  it("asks for a wide view of the whole place on ESTABLISHING", () => {
    // A capital requested as SCENE came back as a close-up of a forge, because
    // "cena" invites a moment rather than a place.
    const prompt = compilePrompt(pkgFor("ESTABLISHING"));
    expect(prompt).toMatch(/LUGAR A RETRATAR/);
    expect(prompt).toMatch(/Plano geral amplo/);
    expect(prompt).toMatch(/Nenhuma figura em primeiro plano pode dominar/);
  });

  it("asks for a narrative moment on SCENE", () => {
    const prompt = compilePrompt(pkgFor("SCENE"));
    expect(prompt).toMatch(/CENA A ILUSTRAR/);
    expect(prompt).toMatch(/um momento acontecendo/);
  });

  it("asks for bust framing on PORTRAIT", () => {
    expect(compilePrompt(pkgFor("PORTRAIT"))).toMatch(/do busto aos ombros/);
  });

  it("falls back to scene framing for an unknown type", () => {
    expect(compilePrompt(pkgFor("NONSENSE"))).toMatch(/um momento acontecendo/);
  });
});

describe("emblem rule strength", () => {
  const pkg = () =>
    compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x", hasEmblemReference: true });

  it("states the emblem rule before the scene, where prompt weight is highest", () => {
    const prompt = compilePrompt(pkg());
    expect(prompt.indexOf("BRASÃO CANÔNICO")).toBeLessThan(prompt.indexOf("CENA A ILUSTRAR"));
  });

  it("demands copying rather than drawing", () => {
    const prompt = compilePrompt(pkg());
    expect(prompt).toMatch(/COPIE esse brasão EXATAMENTE/);
    expect(prompt).toMatch(/não o redesenhe, não o reinterprete/i);
    expect(prompt).toMatch(/citação, não inspiração/);
  });

  it("treats colour as exact, which is what actually failed", () => {
    // The horse reproduced correctly; the star came back gold twice and then
    // the field desaturated. Asserted by intent rather than by phrasing, so
    // improving the wording does not break the test.
    expect(compilePrompt(pkg())).toMatch(/CORES são exatas/);
  });
});

describe("emblem colours are stated, not implied", () => {
  const pkg = (emblemDescription = "") =>
    compileVisualContext({
      styleBible: bible, entity: null, canonicalCanon: "", userRequest: "x",
      hasEmblemReference: true, emblemDescription,
    });

  it("declares the House's measured colours when they are known", () => {
    // The old wording gave a hypothetical ("se a estrela é prateada"), never a
    // fact about this House. Measured against a generated banner, the field had
    // drifted from #02183a to a grey slate because nothing said which navy.
    const prompt = compilePrompt(pkg("uma estrela de oito pontas sobre um cavalo branco | CORES: campo #02183a; carga #dad4ca"));
    expect(prompt).toMatch(/#02183a/);
    expect(prompt).toMatch(/#dad4ca/);
    expect(prompt).toMatch(/não aproximações/);
  });

  it("still forbids substitution when no palette was measured", () => {
    expect(compilePrompt(pkg())).toMatch(/nenhuma substituição, nenhuma aproximação/);
  });

  it("tells the model to darken the scene rather than the emblem", () => {
    // The scene rule asks for dusk lighting and the emblem rule asks for exact
    // pigment. Without resolving that, the model dims the banner along with
    // everything else and the arms come back desaturated.
    expect(compilePrompt(pkg())).toMatch(/escureça a cena, não o brasão/);
  });
});
