import { describe, it, expect } from "vitest";
import { buildProjectCardPrompt, parseProjectCardProposal, enforceGmTriggers } from "./projectPrompts";
import { HttpError } from "../types/domain";
import type { House } from "@ravenloft/content";

const house: House = {
  houseId: "casa-a", name: "Casa A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "Lorde", heirName: "", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
  attributes: { riqueza: 3, recursos: 2, soldados: 3, controle: 3 }, createdAt: "", stability: 3,
};

const validJson = JSON.stringify({
  title: "Muralha da Capital", description: "Constrói uma muralha.", publicDescription: "Obras na capital.",
  category: "INFRASTRUCTURE", durationTurns: 4,
  costs: [{ type: "RESOURCES", amount: 2, timing: "ON_START" }],
  requirements: [], risks: ["Custo elevado"], complications: [],
  completionEffects: { attributeChanges: [], favors: [], assets: ["Muralha"], qualitativeEffects: ["+1 defesa"], unlocks: [] },
  targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
  aiBalanceStatus: "BALANCED", aiBalanceExplanation: "Custo coerente com 4 turnos.",
});

describe("projectPrompts", () => {
  it("builds a prompt with system + user containing the request", () => {
    const { system, user } = buildProjectCardPrompt(house, "Canon público", { request: "Quero uma muralha" });
    expect(system).toContain("Valdren");
    expect(user).toContain("Quero uma muralha");
    expect(user).toContain("Casa A");
  });

  it("parses valid AI JSON", () => {
    const p = parseProjectCardProposal(validJson);
    expect(p.title).toBe("Muralha da Capital");
    expect(p.category).toBe("INFRASTRUCTURE");
    expect(p.durationTurns).toBe(4);
  });

  it("throws AI_PARSE on invalid JSON", () => {
    expect(() => parseProjectCardProposal("not json")).toThrow(HttpError);
  });

  it("throws AI_PARSE on bad category", () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), category: "BANANA" });
    expect(() => parseProjectCardProposal(bad)).toThrow(HttpError);
  });

  it("normalizes Portuguese category names to the English enum", () => {
    const pt = JSON.stringify({ ...JSON.parse(validJson), category: "Infraestrutura" });
    expect(parseProjectCardProposal(pt).category).toBe("INFRASTRUCTURE");
    const upper = JSON.stringify({ ...JSON.parse(validJson), category: "INFRAESTRUTURA" });
    expect(parseProjectCardProposal(upper).category).toBe("INFRASTRUCTURE");
    const esp = JSON.stringify({ ...JSON.parse(validJson), category: "Espionagem" });
    expect(parseProjectCardProposal(esp).category).toBe("INTELLIGENCE");
  });

  it("normalizes Portuguese cost types and attributes", () => {
    const j = JSON.stringify({
      ...JSON.parse(validJson),
      costs: [{ type: "Riqueza", amount: 2, timing: "ON_START" }, { type: "Recursos", amount: 1, timing: "ON_START" }],
      completionEffects: { attributeChanges: [{ attribute: "Controle", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    });
    const p = parseProjectCardProposal(j);
    expect(p.costs.map((c) => c.type)).toEqual(["WEALTH", "RESOURCES"]);
    expect(p.completionEffects.attributeChanges[0].attribute).toBe("controle");
  });

  it("drops unknown cost types instead of failing", () => {
    const j = JSON.stringify({ ...JSON.parse(validJson), costs: [{ type: "Ouro", amount: 2, timing: "ON_START" }] });
    expect(parseProjectCardProposal(j).costs).toEqual([]);
  });

  it("enforceGmTriggers forces GM approval for >1 permanent attribute gain", () => {
    const p = parseProjectCardProposal(JSON.stringify({
      ...JSON.parse(validJson),
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    }));
    expect(enforceGmTriggers(p).requiresGmApproval).toBe(true);
  });

  it("enforceGmTriggers forces GM approval for duration > 6", () => {
    const p = parseProjectCardProposal(JSON.stringify({ ...JSON.parse(validJson), durationTurns: 7 }));
    expect(enforceGmTriggers(p).requiresGmApproval).toBe(true);
  });
});

describe("buildEnhanceCardPrompt", () => {
  it("preserves the player's title and body and instructs minimal changes", async () => {
    const { buildEnhanceCardPrompt } = await import("./projectPrompts");
    const { system, user } = buildEnhanceCardPrompt(house, "Canon público", {
      title: "A Rede dos Portos",
      body: "Quero criar uma rede secreta entre os portos do sul.",
    });
    expect(system.toLowerCase()).toContain("preserv");
    expect(system.toLowerCase()).toMatch(/gram|clareza/);
    expect(user).toContain("A Rede dos Portos");
    expect(user).toContain("rede secreta entre os portos do sul");
    expect(user).toContain("Casa A");
  });
});

describe("buildProjectCanon", () => {
  const entries = [
    { section: "visao-geral", title: "Valdren", body: "Valdren é um reino-ilha cercado pelas Brumas." },
    { section: "crise-atual", title: "O Inverno dos Mortos", body: "Um inverno sobrenatural ameaça as Casas." },
    { section: "censo", title: "Censo 1", body: "X".repeat(40000) },
    { section: "casas", title: "Casa Ulgar", body: "Os Ulgar são guerreiros errantes." },
  ];

  it("includes the mechanics summary and essential world sections", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon(entries);
    expect(canon.toLowerCase()).toContain("projeto");
    expect(canon).toContain("Valdren é um reino-ilha");
    expect(canon).toContain("O Inverno dos Mortos");
  });

  it("caps total size and drops bulky non-essential sections", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon(entries);
    expect(canon.length).toBeLessThan(20000);
    expect(canon).not.toContain("X".repeat(1000));
  });

  it("works with no wiki entries by still providing the mechanics canon", async () => {
    const { buildProjectCanon } = await import("./projectPrompts");
    const canon = buildProjectCanon([]);
    expect(canon.toLowerCase()).toContain("projeto");
  });
});
