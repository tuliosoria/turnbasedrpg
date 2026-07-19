import { describe, expect, it } from "vitest";
import type { House, Submission, Turn } from "@ravenloft/content";
import { buildChronicle, buildPrivateInfoPrompt, buildPublicEventPrompt, buildResolutionPrompt } from "./prompts";

const houses: House[] = [
  {
    houseId: "casa-vargen",
    name: "Casa Vargen",
    motto: "O Norte lembra.",
    emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
    leaderName: "Aldric",
    heirName: "Sera",
    castleName: "Droskar",
    townsText: "Vilas do norte.",
    historyText: "Uma casa antiga.",
    specialty: "Defesa das passagens.",
    weakness: "Fome constante.",
    attributes: { riqueza: 1, recursos: 2, soldados: 5, controle: 2 },
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    houseId: "casa-miruna",
    name: "Casa Miruna",
    motto: "Pela luz velada.",
    emblem: { icon: "corvo", color1: "#1e3a5f", color2: "#4c1d95" },
    leaderName: "Miruna",
    heirName: "Ileana",
    castleName: "Noctis",
    townsText: "Vilas das colinas.",
    historyText: "Uma casa de espiões.",
    specialty: "Intriga.",
    weakness: "Poucos soldados.",
    attributes: { riqueza: 3, recursos: 2, soldados: 1, controle: 4 },
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("buildPublicEventPrompt", () => {
  it("asks for a JSON public event, includes world context and house names", () => {
    const prompt = buildPublicEventPrompt(houses, { lore: "Valdren é uma ilha cercada pelas Brumas.", chronicle: "Turno 1: O gelo venceu a ponte." });

    expect(prompt.system).toContain("EVENTO PÚBLICO");
    expect(prompt.system).toContain("JSON");
    expect(prompt.system).toContain("Valdren é uma ilha cercada pelas Brumas.");
    expect(prompt.system).toContain("Turno 1: O gelo venceu a ponte.");
    expect(prompt.user).toContain("Casa Vargen");
    expect(prompt.user).toContain("Casa Miruna");
  });

  it("handles an empty roster of houses", () => {
    const prompt = buildPublicEventPrompt([]);
    expect(prompt.user).toContain("nenhuma Casa");
  });
});

describe("buildResolutionPrompt", () => {
  it("describes the constraint rule, requires JSON, and includes each submitted house name", () => {
    const turn: Turn = {
      turnId: 2,
      status: "LOCKED",
      publicEvent: "Mortos caminham sobre o lago congelado.",
      privateInfo: {},
      cards: [],
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    const submissions: Submission[] = houses.map((house) => ({
      houseId: house.houseId,
      orderText: `Ordem da ${house.name}.`,
      cardResponses: [],
      submittedAt: "2026-01-03T00:00:00.000Z",
    }));

    const prompt = buildResolutionPrompt(turn, houses, submissions);

    expect(prompt.system).toContain("RESTRIÇÕES");
    expect(prompt.system).toContain("JSON");
    expect(prompt.user).toContain("Casa Vargen");
    expect(prompt.user).toContain("Casa Miruna");
  });
});

describe("buildPrivateInfoPrompt", () => {
  it("includes the public event in the user prompt", () => {
    const prompt = buildPrivateInfoPrompt(houses, "A neve cobre os campos de Valdren.");

    expect(prompt.user).toContain("A neve cobre os campos de Valdren.");
  });

  it("injects lore and chronicle into the system prompt when provided", () => {
    const prompt = buildPrivateInfoPrompt(houses, "Evento.", {
      lore: "Valdren é uma ilha cercada pelas Brumas.",
      chronicle: "Turno 1: A ponte caiu.",
    });

    expect(prompt.system).toContain("MUNDO:");
    expect(prompt.system).toContain("Valdren é uma ilha cercada pelas Brumas.");
    expect(prompt.system).toContain("CRÔNICA (turnos recentes):");
    expect(prompt.system).toContain("Turno 1: A ponte caiu.");
  });

  it("omits context blocks when no lore or chronicle is provided", () => {
    const prompt = buildPrivateInfoPrompt(houses, "Evento.");
    expect(prompt.system).not.toContain("MUNDO:");
    expect(prompt.system).not.toContain("CRÔNICA");
  });
});

describe("buildChronicle", () => {
  function resolved(turnId: number, publicResult: string): Turn {
    return { turnId, status: "RESOLVED", publicEvent: "", privateInfo: {}, cards: [], createdAt: "2026-01-01T00:00:00.000Z", result: { publicResult, houseResults: {}, attributeDeltas: {}, discoveries: [] } };
  }

  it("keeps only resolved turns with a public result, ordered ascending", () => {
    const turns: Turn[] = [
      resolved(2, "Segundo."),
      resolved(1, "Primeiro."),
      { turnId: 3, status: "DRAFT", publicEvent: "", privateInfo: {}, cards: [], createdAt: "x" },
    ];
    expect(buildChronicle(turns)).toBe("Turno 1: Primeiro.\nTurno 2: Segundo.");
  });

  it("caps the chronicle at the most recent N turns", () => {
    const turns: Turn[] = Array.from({ length: 14 }, (_, i) => resolved(i + 1, `R${i + 1}`));
    const lines = buildChronicle(turns).split("\n");
    expect(lines).toHaveLength(10);
    expect(lines[0]).toBe("Turno 5: R5");
    expect(lines[9]).toBe("Turno 14: R14");
  });

  it("returns an empty string when there is no resolved history", () => {
    expect(buildChronicle([])).toBe("");
  });
});

describe("visual directives", () => {
  it("are never injected into text prompts", () => {
    const p1 = buildPrivateInfoPrompt(houses, "Evento.", { lore: "Lore." });
    const turn: Turn = { turnId: 1, status: "LOCKED", publicEvent: "Ev", privateInfo: {}, cards: [], createdAt: "x" };
    const p2 = buildResolutionPrompt(turn, houses, [], { lore: "Lore." });
    // The WorldContext type intentionally has no visualDirectives field.
    expect(p1.system).not.toContain("Dark Fantasy");
    expect(p2.system).not.toContain("Dark Fantasy");
  });
});
