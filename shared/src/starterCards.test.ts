import { describe, it, expect } from "vitest";
import { recommendStarterCards } from "./starterCards.js";
import { getTemplate } from "./projectTemplates.js";
import type { House } from "./types.js";

function house(over: Partial<House> = {}): House {
  return {
    houseId: "h", name: "Casa", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "",
    specialty: "", weakness: "", attributes: { riqueza: 2, recursos: 2, soldados: 2, controle: 2 },
    createdAt: "",
    ...over,
  };
}

describe("recommendStarterCards", () => {
  it("returns between 5 and 8 unique, valid templates", () => {
    const cards = recommendStarterCards(house({ specialty: "Forja" }));
    expect(cards.length).toBeGreaterThanOrEqual(5);
    expect(cards.length).toBeLessThanOrEqual(8);
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of cards) expect(getTemplate(c.id)).toBeDefined();
  });

  it("themes a forge House toward military/arsenal cards", () => {
    const ids = recommendStarterCards(house({ specialty: "Forja " })).map((c) => c.id);
    expect(ids).toContain("construir-um-arsenal-regional");
  });

  it("themes a mining/navigation House toward mines and ports", () => {
    const ids = recommendStarterCards(house({ specialty: "Mineiração, Engenharia e Naavegação" })).map((c) => c.id);
    expect(ids).toContain("abrir-uma-nova-mina");
    expect(ids.some((id) => id === "fundar-um-estaleiro" || id === "expandir-o-porto")).toBe(true);
  });

  it("themes a remedies/crafts House toward a hospital", () => {
    const ids = recommendStarterCards(house({ specialty: "Remédios, montarias, cerâmica, vidro, trabalho em madeira." })).map((c) => c.id);
    expect(ids).toContain("fundar-um-hospital");
  });

  it("always includes at least one universal card", () => {
    const ids = recommendStarterCards(house({ specialty: "algo totalmente sem tema conhecido" })).map((c) => c.id);
    expect(ids).toContain("realizar-um-festival-popular");
  });

  it("falls back to attribute strengths when specialty is empty", () => {
    const ids = recommendStarterCards(house({ specialty: "", attributes: { riqueza: 1, recursos: 1, soldados: 5, controle: 1 } })).map((c) => c.id);
    expect(ids).toContain("construir-um-arsenal-regional");
  });
});
