import { describe, it, expect } from "vitest";
import { validateContent } from "./validate-content.js";

describe("campaign content invariants", () => {
  it("passes validation with no errors", () => {
    const errors = validateContent();
    expect(errors).toEqual([]);
  });
});
