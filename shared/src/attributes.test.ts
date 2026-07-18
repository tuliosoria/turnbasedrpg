import { describe, it, expect } from "vitest";
import { validateAttributes } from "./attributes.js";

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
