import { describe, expect, it } from "vitest";
import type { House, Submission, Turn, WikiEntry } from "@ravenloft/content";
import { buildChronicle, buildImagePrompt, buildHouseImagePrompt, buildPrivateInfoPrompt, buildPublicEventPrompt, buildResolutionPrompt, buildPublicEventContext } from "./prompts";

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

describe("buildImagePrompt", () => {
  const eventTurn: Turn = {
    turnId: 3,
    status: "OPEN",
    publicEvent: "Os mortos cruzam a Ponte de Harrow.",
    privateInfo: {},
    createdAt: "2026-01-02T00:00:00.000Z",
  };
  const resultTurn: Turn = {
    ...eventTurn,
    status: "RESOLVED",
    result: { publicResult: "A ponte cai no gelo.", houseResults: {}, attributeDeltas: {}, discoveries: [] },
  };

  it("uses the provided directives and the scene description", () => {
    const prompt = buildImagePrompt("ESTILO: dark fantasy.", "event", eventTurn, "Ponte coberta de neve.");
    expect(prompt).toContain("ESTILO: dark fantasy.");
    expect(prompt).toContain("Ponte coberta de neve.");
  });

  it("falls back to the event text when no scene is given", () => {
    const prompt = buildImagePrompt("ESTILO.", "event", eventTurn);
    expect(prompt).toContain("Os mortos cruzam a Ponte de Harrow.");
  });

  it("falls back to the result text for result images", () => {
    const prompt = buildImagePrompt("ESTILO.", "result", resultTurn);
    expect(prompt).toContain("A ponte cai no gelo.");
  });

  it("uses the default directives when none are stored", () => {
    const prompt = buildImagePrompt("", "event", eventTurn, "cena");
    expect(prompt).toContain("Dark Fantasy");
  });
});

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

  it("builds a rich continuity packet for public event drafting", () => {
    const wiki: WikiEntry[] = [
      {
        entryId: "w1",
        section: "casas",
        title: "Casa Do Ouro",
        body: "Mineiros, joalheiros e ferreiros ergueram vilas nas encostas.",
        order: 6,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    ];
    const turns: Turn[] = [
      {
        turnId: 1,
        status: "RESOLVED",
        publicEvent: "A neve fechou a estrada do norte.",
        privateInfo: { "casa-vargen": "Batedores viram luzes azuis na ponte." },
        createdAt: "2026-01-01T00:00:00.000Z",
        result: {
          publicResult: "A ponte caiu antes do amanhecer.",
          houseResults: { "casa-vargen": "A guarda retornou com baixas." },
          attributeDeltas: { "casa-vargen": { soldados: -1 } },
          discoveries: ["Há túneis sob a estrada velha."],
        },
      },
    ];
    const submissionsByTurn = new Map<number, Submission[]>([
      [1, [{ houseId: "casa-vargen", orderText: "Enviar patrulhas discretas.", submittedAt: "2026-01-02T00:00:00.000Z" }]],
    ]);

    const context = buildPublicEventContext({
      lore: "Valdren está cercada pelas Brumas.",
      houses,
      wiki,
      turns,
      submissionsByTurn,
    });

    expect(context).toContain("ENREDO");
    expect(context).toContain("Valdren está cercada pelas Brumas.");
    expect(context).toContain("CASAS EM JOGO");
    expect(context).toContain("Casa Vargen");
    expect(context).toContain("Líder: Aldric");
    expect(context).toContain("História: Uma casa antiga.");
    expect(context).toContain("WIKI PÚBLICA");
    expect(context).toContain("Casa Do Ouro");
    expect(context).toContain("ÚLTIMOS 5 TURNOS");
    expect(context).toContain("Evento público: A neve fechou a estrada do norte.");
    expect(context).toContain("Informação privada para Casa Vargen: Batedores viram luzes azuis na ponte.");
    expect(context).toContain("Ordem da Casa Vargen: Enviar patrulhas discretas.");
    expect(context).toContain("Resultado privado da Casa Vargen: A guarda retornou com baixas.");
    expect(context).toContain("Mudanças de atributos: Casa Vargen: soldados -1");
    expect(context).toContain("Descobertas: Há túneis sob a estrada velha.");
    expect(context).toContain("REGRA DE SIGILO");
    expect(context).toContain("não revele diretamente");
  });

  it("does not mutate the input turn or wiki ordering", () => {
    const wiki: WikiEntry[] = [
      {
        entryId: "w-z",
        section: "zonas",
        title: "Bosque Velado",
        body: "Árvores sussurram nomes antigos.",
        order: 2,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
      {
        entryId: "w-a",
        section: "anais",
        title: "Primeira Neve",
        body: "O inverno chegou cedo.",
        order: 1,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    ];
    const turns: Turn[] = [
      { turnId: 3, status: "RESOLVED", publicEvent: "Terceiro evento.", privateInfo: {}, createdAt: "2026-01-03T00:00:00.000Z" },
      { turnId: 1, status: "RESOLVED", publicEvent: "Primeiro evento.", privateInfo: {}, createdAt: "2026-01-01T00:00:00.000Z" },
      { turnId: 2, status: "RESOLVED", publicEvent: "Segundo evento.", privateInfo: {}, createdAt: "2026-01-02T00:00:00.000Z" },
    ];

    buildPublicEventContext({
      lore: "Valdren está cercada pelas Brumas.",
      houses,
      wiki,
      turns,
      submissionsByTurn: new Map(),
    });

    expect(turns.map((turn) => turn.turnId)).toEqual([3, 1, 2]);
    expect(wiki.map((entry) => entry.entryId)).toEqual(["w-z", "w-a"]);
  });
});

describe("buildResolutionPrompt", () => {
  it("describes the constraint rule, requires JSON, and includes each submitted house name", () => {
    const turn: Turn = {
      turnId: 2,
      status: "LOCKED",
      publicEvent: "Mortos caminham sobre o lago congelado.",
      privateInfo: {},
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    const submissions: Submission[] = houses.map((house) => ({
      houseId: house.houseId,
      orderText: `Ordem da ${house.name}.`,
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
    return { turnId, status: "RESOLVED", publicEvent: "", privateInfo: {}, createdAt: "2026-01-01T00:00:00.000Z", result: { publicResult, houseResults: {}, attributeDeltas: {}, discoveries: [] } };
  }

  it("keeps only resolved turns with a public result, ordered ascending", () => {
    const turns: Turn[] = [
      resolved(2, "Segundo."),
      resolved(1, "Primeiro."),
      { turnId: 3, status: "DRAFT", publicEvent: "", privateInfo: {}, createdAt: "x" },
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
    const turn: Turn = { turnId: 1, status: "LOCKED", publicEvent: "Ev", privateInfo: {}, createdAt: "x" };
    const p2 = buildResolutionPrompt(turn, houses, [], { lore: "Lore." });
    // The WorldContext type intentionally has no visualDirectives field.
    expect(p1.system).not.toContain("Dark Fantasy");
    expect(p2.system).not.toContain("Dark Fantasy");
  });
});

describe("buildHouseImagePrompt", () => {
  const emblem = { icon: "lobo" as const, color1: "#3f3f46", color2: "#1e3a5f" };
  it("includes the house name, emblem icon and description", () => {
    const prompt = buildHouseImagePrompt("Casa Vargen", "Guardiões do norte gelado.", emblem);
    expect(prompt).toContain("Casa Vargen");
    expect(prompt.toLowerCase()).toContain("lobo");
    expect(prompt).toContain("Guardiões do norte gelado.");
  });
  it("works without a description", () => {
    const prompt = buildHouseImagePrompt("Casa Sem Texto", "", emblem);
    expect(prompt).toContain("Casa Sem Texto");
  });
});
