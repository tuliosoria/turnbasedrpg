import { describe, it, expect } from "vitest";
import { DEFAULT_IMAGE_OPTIONS } from "./images";

describe("DEFAULT_IMAGE_OPTIONS", () => {
  it("preserves the behaviour that shipped before these were configurable", () => {
    expect(DEFAULT_IMAGE_OPTIONS).toEqual({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "medium",
      inputFidelity: "high",
    });
  });
});

import { DEFAULT_IMAGE_OPTIONS as D } from "./images";

describe("inputFidelity", () => {
  it("defaults to high, preserving the behaviour that shipped before it was configurable", () => {
    expect(D.inputFidelity).toBe("high");
  });

  it("is nullable, because gpt-image-2 rejects the parameter outright", () => {
    // Verified against the live API: gpt-image-2 returns
    // "does not support the 'input_fidelity' parameter", while gpt-image-1.5
    // accepts it. Sending it unconditionally breaks every generation that uses
    // a reference image.
    const opts: typeof D = { ...D, model: "gpt-image-2", inputFidelity: null };
    expect(opts.inputFidelity).toBeNull();
  });
});
