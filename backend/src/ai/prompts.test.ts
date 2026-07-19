import { describe, expect, it } from "vitest";
import type { House, Submission, Turn } from "@ravenloft/content";
import { buildPrivateInfoPrompt, buildResolutionPrompt } from "./prompts";

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
    const prompt = buildPrivateInfoPrompt(houses, "A neve cobre os campos de Valdren.", "Os sinos tocaram ao norte.");

    expect(prompt.user).toContain("A neve cobre os campos de Valdren.");
  });
});
