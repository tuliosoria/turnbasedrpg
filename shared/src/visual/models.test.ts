import { describe, it, expect } from "vitest";
import {
  CANONICAL_LEVELS, VISUAL_ENTITY_TYPES, GENERATION_STATUSES, REFERENCE_ROLES,
  isCanonicalLevel, isVisualEntityType, clampVisualText, newVisualEntity, newVisualGeneration,
  canDeleteAsset, VISUAL_TEXT_MAX,
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
