import { describe, it, expect } from "vitest";
import { newVisualEntity, type VisualStyleBible } from "@ravenloft/content";
import { compileVisualContext } from "./contextCompiler";
import { ENHANCER_SYSTEM_PROMPT, buildEnhancerUser, parseEnhancedBrief, ENHANCED_BRIEF_MAX } from "./promptEnhancer";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE",
  artMedium: "pintura digital cinematográfica",
  renderingStyle: "dark fantasy gótico medieval",
  lightingRules: "tons frios, névoa",
  colorPalette: "tons frios e sombrios",
  architectureRenderingRules: "gótica medieval",
  characterRenderingRules: "identidade facial preservada",
  prohibitedStyles: ["anime"],
  globalNegativeInstructions: ["sem texto"],
  referenceAssetIds: [], createdAt: "",
};

describe("ENHANCER_SYSTEM_PROMPT", () => {
  it("tells the model to describe appearance rather than purpose", () => {
    expect(ENHANCER_SYSTEM_PROMPT).toMatch(/apenas o que se VÊ/);
  });

  it("forbids restating style rules, which are applied separately", () => {
    // Duplicating palette/lighting here would double their token weight and
    // let the enhancer drift from the style bible's actual wording.
    expect(ENHANCER_SYSTEM_PROMPT).toMatch(/Não repita regras de estilo, paleta ou iluminação/);
  });
});

describe("buildEnhancerUser", () => {
  it("passes the immutable traits so the brief cannot contradict canon", () => {
    const entity = newVisualEntity({
      id: "kd", campaignId: "winter-dead", entityType: "CITY",
      canonicalName: "Khar-Durak", slug: "khar-durak",
      immutableTraits: [{ id: "t1", text: "escavada no interior de uma montanha à beira-mar", source: "AUTHORED", originAssetId: null, createdAt: "" }],
    });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "", userRequest: "a cidade ao amanhecer" });
    const user = buildEnhancerUser(pkg);

    expect(user).toContain("escavada no interior de uma montanha à beira-mar");
    expect(user).toContain("Khar-Durak");
    expect(user).toContain("a cidade ao amanhecer");
  });

  it("works with no entity selected", () => {
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "", userRequest: "uma muralha nas geleiras" });
    expect(buildEnhancerUser(pkg)).toContain("uma muralha nas geleiras");
  });

  it("includes the location canon when present", () => {
    const pkg = compileVisualContext({ styleBible: bible, entity: null, canonicalCanon: "As Marcas do Norte são florestas escuras.", userRequest: "x" });
    expect(buildEnhancerUser(pkg)).toContain("Marcas do Norte");
  });
});

describe("parseEnhancedBrief", () => {
  it("returns the brief unchanged when the model behaves", () => {
    expect(parseEnhancedBrief("Uma muralha maciça de pedra escura sobre a geleira.")).toBe(
      "Uma muralha maciça de pedra escura sobre a geleira.",
    );
  });

  it("strips a label the model added despite being told not to", () => {
    expect(parseEnhancedBrief("Descrição visual: Uma muralha maciça.")).toBe("Uma muralha maciça.");
  });

  it("strips surrounding quotes", () => {
    expect(parseEnhancedBrief('"Uma muralha maciça."')).toBe("Uma muralha maciça.");
  });

  it("clamps an overlong brief", () => {
    expect(parseEnhancedBrief("x".repeat(5000)).length).toBe(ENHANCED_BRIEF_MAX);
  });

  it("returns empty string for empty or missing output, so the caller can fall back", () => {
    expect(parseEnhancedBrief("")).toBe("");
    expect(parseEnhancedBrief("   ")).toBe("");
    expect(parseEnhancedBrief(undefined as unknown as string)).toBe("");
  });
});
