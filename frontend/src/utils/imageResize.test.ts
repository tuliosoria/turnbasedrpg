import { describe, it, expect } from "vitest";
import { computeTargetSize } from "./imageResize";

describe("computeTargetSize", () => {
  it("leaves small images unchanged", () => {
    expect(computeTargetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it("scales down by the long edge, preserving aspect ratio", () => {
    expect(computeTargetSize(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });
  it("handles portrait", () => {
    expect(computeTargetSize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 });
  });
});
