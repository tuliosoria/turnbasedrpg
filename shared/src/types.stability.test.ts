import { describe, it, expect } from "vitest";
import { STABILITY_DEFAULT, STABILITY_MIN, STABILITY_MAX, houseStability } from "./types.js";
import type { House } from "./types.js";

const base: House = {
  houseId: "h1", name: "Casa", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "",
  specialty: "", weakness: "", attributes: { riqueza: 2, recursos: 2, soldados: 3, controle: 3 },
  createdAt: "2026-01-01T00:00:00Z",
};

describe("stability", () => {
  it("exposes constants", () => {
    expect(STABILITY_DEFAULT).toBe(3);
    expect(STABILITY_MIN).toBe(0);
    expect(STABILITY_MAX).toBe(5);
  });
  it("defaults when field is absent", () => {
    expect(houseStability(base)).toBe(3);
  });
  it("returns stored value when present", () => {
    expect(houseStability({ ...base, stability: 5 })).toBe(5);
  });
});
