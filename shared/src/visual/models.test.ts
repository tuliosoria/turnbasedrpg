import { describe, it, expect } from "vitest";
import {
  CANONICAL_LEVELS, VISUAL_ENTITY_TYPES, GENERATION_STATUSES, REFERENCE_ROLES,
  isCanonicalLevel, isVisualEntityType, clampVisualText, newVisualEntity, newVisualGeneration,
  canDeleteAsset, VISUAL_TEXT_MAX, coerceCanonTraits, newCanonTrait,
  type CanonTrait,
} from "./models.js";

describe("visual enums", () => {
  it("exposes the four canonical levels in order", () => {
    expect(CANONICAL_LEVELS).toEqual(["DRAFT", "CANDIDATE", "CANONICAL", "LOCKED"]);
  });
  it("includes MAP and CHARACTER entity types", () => {
    expect(VISUAL_ENTITY_TYPES).toContain("MAP");
    expect(VISUAL_ENTITY_TYPES).toContain("CHARACTER");
  });
  it("guards canonical level and entity type", () => {
    expect(isCanonicalLevel("LOCKED")).toBe(true);
    expect(isCanonicalLevel("nope")).toBe(false);
    expect(isVisualEntityType("CITY")).toBe(true);
    expect(isVisualEntityType("x")).toBe(false);
  });
});

describe("clampVisualText", () => {
  it("trims and caps to VISUAL_TEXT_MAX", () => {
    const long = "a".repeat(VISUAL_TEXT_MAX + 50);
    expect(clampVisualText("  hi  ")).toBe("hi");
    expect(clampVisualText(long).length).toBe(VISUAL_TEXT_MAX);
    expect(clampVisualText(undefined)).toBe("");
  });
});

describe("factories", () => {
  it("newVisualEntity fills defaults and DRAFT status", () => {
    const e = newVisualEntity({ id: "e1", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" });
    expect(e.status).toBe("DRAFT");
    expect(e.version).toBe(1);
    expect(e.immutableTraits).toEqual([]);
    expect(e.canonicalAssetIds).toEqual([]);
  });
  it("newVisualGeneration starts PENDING with GENERATE default", () => {
    const g = newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "castelo" });
    expect(g.status).toBe("PENDING");
    expect(g.operationType).toBe("GENERATE");
    expect(g.retryCount).toBe(0);
  });
});

describe("canDeleteAsset", () => {
  it("blocks LOCKED, allows others", () => {
    expect(canDeleteAsset("LOCKED")).toBe(false);
    expect(canDeleteAsset("CANONICAL")).toBe(true);
    expect(canDeleteAsset("DRAFT")).toBe(true);
  });
});

describe("reference roles", () => {
  it("includes identity and architecture roles", () => {
    expect(REFERENCE_ROLES).toContain("IDENTITY");
    expect(REFERENCE_ROLES).toContain("ARCHITECTURE");
  });
});

describe("generation statuses", () => {
  it("covers the full lifecycle", () => {
    expect(GENERATION_STATUSES).toEqual(["PENDING", "RUNNING", "NEEDS_REVIEW", "COMPLETED", "FAILED"]);
  });
});

describe("coerceCanonTraits", () => {
  it("passes CanonTrait objects through unchanged", () => {
    const trait: CanonTrait = {
      id: "t1",
      text: "O mar em Krythos é verde-escuro.",
      source: "DISCOVERED",
      originAssetId: "a1",
      createdAt: "2026-08-11T00:00:00.000Z",
    };
    expect(coerceCanonTraits([trait])).toEqual([trait]);
  });

  it("upgrades legacy string traits to AUTHORED CanonTraits", () => {
    const out = coerceCanonTraits(["cidade escavada na montanha"]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("cidade escavada na montanha");
    expect(out[0].source).toBe("AUTHORED");
    expect(out[0].originAssetId).toBeNull();
    expect(out[0].id).toBeTruthy();
  });

  it("returns an empty array for non-array input", () => {
    expect(coerceCanonTraits(undefined)).toEqual([]);
    expect(coerceCanonTraits(null)).toEqual([]);
    expect(coerceCanonTraits("nope")).toEqual([]);
  });

  it("drops entries that are neither strings nor trait-shaped", () => {
    expect(coerceCanonTraits([42, {}, { text: "" }])).toEqual([]);
  });

  it("preserves an explicit id", () => {
    const out = coerceCanonTraits([{ id: "t-keep", text: "muralhas negras" }]);
    expect(out[0].id).toBe("t-keep");
  });

  it("does not reuse an id already claimed by an earlier element", () => {
    const out = coerceCanonTraits([
      { id: "legacy-1", text: "escadaria em espiral" },
      "a legacy string",
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("legacy-1");
    expect(new Set(out.map((t) => t.id)).size).toBe(2);
  });

  it("does not reuse an id claimed by a later element", () => {
    const out = coerceCanonTraits([
      { text: "A" },
      { id: "legacy-0", text: "B" },
      { text: "C" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[1].id).toBe("legacy-0");
    expect(new Set(out.map((t) => t.id)).size).toBe(3);
  });

  it("keeps ids unique when the stored data repeats one", () => {
    const out = coerceCanonTraits([
      { id: "dup", text: "A" },
      { id: "dup", text: "B" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("dup");
    expect(new Set(out.map((t) => t.id)).size).toBe(2);
  });
});

describe("newCanonTrait", () => {
  it("defaults to AUTHORED with no origin asset", () => {
    const t = newCanonTrait({ id: "t9", text: "muralhas de pedra vulcânica" });
    expect(t.source).toBe("AUTHORED");
    expect(t.originAssetId).toBeNull();
    expect(t.createdAt).toBeTruthy();
  });

  it("records the origin asset for a discovered trait", () => {
    const t = newCanonTrait({
      id: "t10",
      text: "O mar é verde-escuro.",
      source: "DISCOVERED",
      originAssetId: "asset-42",
    });
    expect(t.source).toBe("DISCOVERED");
    expect(t.originAssetId).toBe("asset-42");
  });

  it("trims and clamps the trait text", () => {
    const t = newCanonTrait({ id: "t11", text: `  ${"x".repeat(3000)}  ` });
    expect(t.text.length).toBe(2000);
  });
});

describe("newVisualEntity", () => {
  it("starts with no wiki link and no traits", () => {
    const e = newVisualEntity({
      id: "e1",
      campaignId: "winter-dead",
      entityType: "CITY",
      canonicalName: "Khar-Durak",
      slug: "khar-durak",
    });
    expect(e.wikiEntryId).toBeNull();
    expect(e.immutableTraits).toEqual([]);
  });

  it("still accepts the legacy string[] trait shape", () => {
    const e = newVisualEntity({
      id: "e2",
      campaignId: "winter-dead",
      entityType: "CITY",
      canonicalName: "Khar-Durak",
      slug: "khar-durak",
      immutableTraits: ["cidade escavada na montanha"],
    });
    expect(e.immutableTraits[0].text).toBe("cidade escavada na montanha");
    expect(e.immutableTraits[0].source).toBe("AUTHORED");
  });

  it("rejects non-trait input at compile time", () => {
    const e = newVisualEntity({
      id: "e3",
      campaignId: "winter-dead",
      entityType: "CITY",
      canonicalName: "Khar-Durak",
      slug: "khar-durak",
      // @ts-expect-error immutableTraits must be CanonTrait[] or legacy string[]
      immutableTraits: 42,
    });
    expect(e.immutableTraits).toEqual([]);
  });
});
