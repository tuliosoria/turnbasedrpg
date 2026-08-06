import { describe, it, expect } from "vitest";
import { parseGenerateBody } from "./visualSchemas";
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
