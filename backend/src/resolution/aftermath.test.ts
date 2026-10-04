import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatFn } from "../ai/openai";
import type { Config } from "../types/domain";
import { runResolutionAftermath } from "./aftermath";
import * as processTurn from "../projects/processTurn";
import * as worldUpdate from "../ai/npc/worldUpdate";
import * as worldFacts from "../db/worldFacts";
import * as housesDb from "../db/houses";
import * as projectsDb from "../db/projects";
import * as wikiDb from "../db/wiki";
import * as messagesDb from "../db/diplomacy/messages";
import * as npcDb from "../db/npcDynamic";
import * as energiaDb from "../db/energia";

vi.mock("../projects/processTurn", () => ({
  processProjectsForTurn: vi.fn(async () => {}),
}));

vi.mock("../ai/npc/worldUpdate", () => ({
  updateNpcWorld: vi.fn(async () => ({ candidates: 0, changed: 0, vazias: 0 })),
}));

vi.mock("../db/worldFacts", () => ({
  listWorldFacts: vi.fn(async () => []),
  putWorldFact: vi.fn(),
  deleteWorldFactsOfTurn: vi.fn(async () => []),
}));

vi.mock("../db/houses", () => ({
  getHouse: vi.fn(async () => null),
  listHouses: vi.fn(async () => []),
  updateHouseAttributes: vi.fn(),
  updateHouseStabilityAndAssets: vi.fn(),
}));

vi.mock("../db/projects", () => ({
  listCampaignProjects: vi.fn(async () => []),
  putProject: vi.fn(),
  putFavor: vi.fn(),
}));

vi.mock("../db/wiki", () => ({
  listWikiEntries: vi.fn(async () => []),
}));

vi.mock("../db/diplomacy/messages", () => ({
  listAllMessages: vi.fn(async () => []),
}));

vi.mock("../db/npcDynamic", () => ({
  getNpcDynamic: vi.fn(),
  putNpcDynamic: vi.fn(),
  listNpcDynamics: vi.fn(async () => []),
}));

vi.mock("../db/energia", () => ({
  getAlocacaoEnergia: vi.fn(async () => null),
}));

const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: "x",
  tokenSigningSecret: "secret",
  allowedOrigin: "*",
  tokenTtlSeconds: 3600,
  openAiApiKey: "",
  openAiModel: "gpt-4o-mini",
  openAiDiplomacyModel: "gpt-4o-mini",
  openAiImageModel: "gpt-image-1",
  openAiImageSize: "1536x1024",
  openAiImageQuality: "medium",
  openAiImageInputFidelity: "high",
  openAiSyncImageModel: "gpt-image-1",
  openAiSyncImageSize: "1536x1024",
  openAiSyncImageQuality: "medium",
  imagesBucket: "",
  visualWorkerFunctionName: "",
  replyWorkerFunctionName: "",
  outreachWorkerFunctionName: "",
  resolutionWorkerFunctionName: "",
  draftIngestToken: "",
};

const pedido = {
  turnId: 7,
  publicEvent: "A neve bloqueia as estradas.",
  privateInfo: { "casa-vargen": "Rastros nas Brumas." },
  publicResult: "Khazdrun mandou cem. Cem homens e um comboio de suprimentos, sob o martelo de Khar-Durak.",
  houseResults: {},
  discoveries: [] as string[],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(projectsDb.listCampaignProjects).mockResolvedValue([]);
  vi.mocked(housesDb.listHouses).mockResolvedValue([]);
  vi.mocked(wikiDb.listWikiEntries).mockResolvedValue([]);
  vi.mocked(messagesDb.listAllMessages).mockResolvedValue([]);
  vi.mocked(npcDb.listNpcDynamics).mockResolvedValue([]);
  vi.mocked(energiaDb.getAlocacaoEnergia).mockResolvedValue(null);
  vi.mocked(worldUpdate.updateNpcWorld).mockResolvedValue({ candidates: 0, changed: 0, vazias: 0 });
});

describe("runResolutionAftermath", () => {
  it("sempre avança as cartas, mesmo sem modelo", async () => {
    await runResolutionAftermath({ doc: { send: vi.fn() } as never, config }, pedido);
    expect(processTurn.processProjectsForTurn).toHaveBeenCalledWith(expect.anything(), "winter-dead", 7);
    expect(worldUpdate.updateNpcWorld).not.toHaveBeenCalled();
  });

  it("com chat, extrai fatos e dispara o Relationship Engine", async () => {
    const chat: ChatFn = vi.fn(async () => JSON.stringify({
      fatos: [{ kind: "MILITAR", partes: ["casa-khazdrun"], resumo: "Khazdrun enviou cem homens.", citacao: "Cem homens e um comboio de suprimentos" }],
    }));
    await runResolutionAftermath({ doc: { send: vi.fn() } as never, config, chat }, pedido);
    expect(chat).toHaveBeenCalled();
    expect(worldFacts.deleteWorldFactsOfTurn).toHaveBeenCalledWith(expect.anything(), "ravenloft-game", "winter-dead", 7);
    expect(worldFacts.putWorldFact).toHaveBeenCalled();
    expect(worldUpdate.updateNpcWorld).toHaveBeenCalledWith(
      expect.objectContaining({ chat }),
      expect.objectContaining({
        turnId: 7,
        publicEvent: "A neve bloqueia as estradas.",
        privateInfo: { "casa-vargen": "Rastros nas Brumas." },
      }),
    );
  });

  it("resultado e info privada de Casa de jogador acham a sede pelo nome curto", async () => {
    vi.mocked(housesDb.listHouses).mockResolvedValue([
      { houseId: "solarion-k0hc", name: "Solarion" },
      { houseId: "khazdrun-wxey", name: "Khazdrun" },
      { houseId: "do-ouro-g0gg", name: "Do Ouro" },
    ] as never);
    const chat: ChatFn = vi.fn(async () => JSON.stringify({ fatos: [] }));
    const solarion = "A forja de Solarion acendeu e só a Casa viu o brilho.";
    const khazdrun = "Khazdrun contou o ouro da montanha em silêncio absoluto.";
    const ouro = "Do Ouro fechou o cais antes do sino do meio-dia.";
    await runResolutionAftermath({ doc: { send: vi.fn() } as never, config, chat }, {
      ...pedido,
      houseResults: {
        "solarion-k0hc": solarion,
        "khazdrun-wxey": khazdrun,
        "do-ouro-g0gg": ouro,
      },
      privateInfo: {
        "solarion-k0hc": "Segredo de Solarion.",
        "khazdrun-wxey": "Segredo de Khazdrun.",
        "do-ouro-g0gg": "Segredo do Ouro.",
      },
    });

    const prompts = (chat as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[1]));
    expect(prompts.some((p) => p.includes(solarion))).toBe(true);
    expect(prompts.some((p) => p.includes(khazdrun))).toBe(true);
    expect(prompts.some((p) => p.includes(ouro))).toBe(true);

    const depsNpc = vi.mocked(worldUpdate.updateNpcWorld).mock.calls[0][0];
    expect(depsNpc.houseKeyOf("solarion-k0hc")).toBe("casa-solarion");
    expect(depsNpc.houseKeyOf("khazdrun-wxey")).toBe("casa-khazdrun");
    expect(depsNpc.houseKeyOf("do-ouro-g0gg")).toBe("casa-do-ouro");
  });

  it("carta à Coroa entra na fila como afiliação:id", async () => {
    vi.mocked(messagesDb.listAllMessages).mockResolvedValue([
      { turnNumber: 7, toHouseKey: "casa-valerius", toCharacterId: "alic-valerius" },
      { turnNumber: 6, toHouseKey: "casa-rimerberg", toCharacterId: "capitao-orven-geada" },
      { turnNumber: 4, toHouseKey: "casa-valerius", toCharacterId: "alic-valerius" },
      { turnNumber: 7, toHouseKey: "casa-solarion", toCharacterId: null },
    ] as never);
    const chat: ChatFn = vi.fn(async () => JSON.stringify({ fatos: [] }));
    await runResolutionAftermath({ doc: { send: vi.fn() } as never, config, chat }, pedido);

    const depsNpc = vi.mocked(worldUpdate.updateNpcWorld).mock.calls[0][0];
    const chaves = await depsNpc.recentlyContacted!();
    expect(chaves.has("coroa:alic-valerius")).toBe(true);
    expect(chaves.has("casa-valerius:alic-valerius")).toBe(false);
    expect(chaves.has("casa-rimerberg:capitao-orven-geada")).toBe(true);
    expect([...chaves].some((k) => k.endsWith(":null") || k.includes("casa-solarion"))).toBe(false);
  });

  it("uma falha da IA não relança — o turno já está gravado", async () => {
    const chat: ChatFn = vi.fn(async () => { throw new Error("modelo caiu"); });
    vi.mocked(worldUpdate.updateNpcWorld).mockRejectedValue(new Error("npc caiu"));
    await expect(runResolutionAftermath({ doc: { send: vi.fn() } as never, config, chat }, pedido)).resolves.toBeUndefined();
  });
});
