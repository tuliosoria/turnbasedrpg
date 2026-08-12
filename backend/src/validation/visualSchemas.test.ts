import { describe, it, expect } from "vitest";
import { parseGenerateBody, parseCreateEntityBody, parseUpdateEntityBody } from "./visualSchemas";
import { HttpError } from "../types/domain";

describe("parseGenerateBody", () => {
  it("accepts a minimal request", () => {
    const r = parseGenerateBody({ requestText: "Um castelo nevado sob a névoa" });
    expect(r.requestText).toContain("castelo");
    expect(r.entityId).toBeNull();
  });
  it("accepts an optional entityId", () => {
    const r = parseGenerateBody({ requestText: "Alic sorrindo", entityId: "alic" });
    expect(r.entityId).toBe("alic");
  });
  it("rejects an empty requestText", () => {
    expect(() => parseGenerateBody({ requestText: "" })).toThrow(HttpError);
  });
  it("rejects a non-object body", () => {
    expect(() => parseGenerateBody(null)).toThrow(HttpError);
  });
});

describe("parseCreateEntityBody", () => {
  it("accepts a minimal valid body", () => {
    const out = parseCreateEntityBody({ canonicalName: "Ordem do Sino", entityType: "HOUSE" });
    expect(out.canonicalName).toBe("Ordem do Sino");
    expect(out.entityType).toBe("HOUSE");
    expect(out.slug).toBe("ordem-do-sino");
    expect(out.wikiEntryId).toBeNull();
  });

  it("slugifies accented names", () => {
    const out = parseCreateEntityBody({ canonicalName: "Mandíbula de Osso", entityType: "CREATURE" });
    expect(out.slug).toBe("mandibula-de-osso");
  });

  it("keeps an explicit wikiEntryId", () => {
    const out = parseCreateEntityBody({ canonicalName: "X", entityType: "CITY", wikiEntryId: "w1" });
    expect(out.wikiEntryId).toBe("w1");
  });

  it("rejects a missing name", () => {
    expect(() => parseCreateEntityBody({ entityType: "CITY" })).toThrow();
  });

  it("rejects an unknown entity type", () => {
    expect(() => parseCreateEntityBody({ canonicalName: "X", entityType: "DRAGON" })).toThrow();
  });
});

describe("parseUpdateEntityBody", () => {
  it("returns only the provided fields", () => {
    const out = parseUpdateEntityBody({ publicDescription: "uma ordem funerária" });
    expect(out.publicDescription).toBe("uma ordem funerária");
    expect(out.immutableTraits).toBeUndefined();
  });

  it("normalises immutable traits into CanonTrait shape", () => {
    const out = parseUpdateEntityBody({ immutableTraits: [{ text: "sinos de bronze escuro" }] });
    expect(out.immutableTraits).toEqual([
      expect.objectContaining({ text: "sinos de bronze escuro", source: "AUTHORED" }),
    ]);
  });

  it("preserves DISCOVERED provenance on an existing trait", () => {
    const out = parseUpdateEntityBody({
      immutableTraits: [
        { id: "t1", text: "mar verde-escuro", source: "DISCOVERED", originAssetId: "a1", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    expect(out.immutableTraits?.[0]).toMatchObject({
      id: "t1", source: "DISCOVERED", originAssetId: "a1",
    });
  });

  it("rejects a status outside the canon levels", () => {
    expect(() => parseUpdateEntityBody({ status: "SUPER_CANON" })).toThrow();
  });

  it("rejects a body that is not an object", () => {
    expect(() => parseUpdateEntityBody("nope")).toThrow();
  });
});
