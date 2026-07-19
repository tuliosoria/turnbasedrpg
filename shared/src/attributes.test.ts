import { describe, it, expect } from "vitest";
import { validateAttributes, validateAttributeRanges } from "./attributes.js";

describe("validateAttributes", () => {
  const ok = { riqueza: 1, recursos: 2, soldados: 5, controle: 2 };
  it("accepts a valid 10-point spread", () => {
    expect(validateAttributes(ok)).toEqual({ valid: true });
  });
  it("rejects sum != 10", () => {
    expect(validateAttributes({ ...ok, controle: 3 }).valid).toBe(false);
  });
  it("rejects a value above 5", () => {
    expect(validateAttributes({ riqueza: 0, recursos: 0, soldados: 6, controle: 4 }).valid).toBe(false);
  });
  it("rejects negatives", () => {
    expect(validateAttributes({ riqueza: -1, recursos: 5, soldados: 5, controle: 1 }).valid).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(validateAttributes({ riqueza: 1.5, recursos: 2.5, soldados: 4, controle: 2 }).valid).toBe(false);
  });
});

describe("validateAttributeRanges", () => {
  it("accepts any integers within 0-5 regardless of the total", () => {
    expect(validateAttributeRanges({ riqueza: 5, recursos: 5, soldados: 5, controle: 5 })).toEqual({ valid: true });
    expect(validateAttributeRanges({ riqueza: 0, recursos: 0, soldados: 0, controle: 0 })).toEqual({ valid: true });
  });
  it("rejects a value above 5", () => {
    expect(validateAttributeRanges({ riqueza: 6, recursos: 0, soldados: 0, controle: 0 }).valid).toBe(false);
  });
  it("rejects negatives", () => {
    expect(validateAttributeRanges({ riqueza: -1, recursos: 0, soldados: 0, controle: 0 }).valid).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(validateAttributeRanges({ riqueza: 1.5, recursos: 0, soldados: 0, controle: 0 }).valid).toBe(false);
  });
});
