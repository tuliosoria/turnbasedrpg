import { describe, it, expect } from "vitest";
import {
  styleBibleSk, styleBiblePrefix, entitySk, entityPrefix,
  assetSk, assetPrefix, generationSk, generationPrefix, padVersion,
} from "./keys";

describe("visual keys", () => {
  it("pads style bible version to 4 digits", () => {
    expect(padVersion(1)).toBe("0001");
    expect(styleBibleSk(2)).toBe("VSTYLE#0002");
    expect(styleBiblePrefix()).toBe("VSTYLE#");
  });
  it("builds entity/asset/generation SKs and prefixes", () => {
    expect(entitySk("alic")).toBe("VENTITY#alic");
    expect(entityPrefix()).toBe("VENTITY#");
    expect(assetSk("a1")).toBe("VASSET#a1");
    expect(assetPrefix()).toBe("VASSET#");
    expect(generationSk("g1")).toBe("VGEN#g1");
    expect(generationPrefix()).toBe("VGEN#");
  });
});
