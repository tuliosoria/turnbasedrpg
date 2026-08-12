import { describe, it, expect } from "vitest";
import { DEFAULT_IMAGE_OPTIONS } from "./images";

describe("DEFAULT_IMAGE_OPTIONS", () => {
  it("preserves the behaviour that shipped before these were configurable", () => {
    expect(DEFAULT_IMAGE_OPTIONS).toEqual({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "medium",
    });
  });
});
