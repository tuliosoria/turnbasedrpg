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

  it("uma falha da IA não relança — o turno já está gravado", async () => {
    const chat: ChatFn = vi.fn(async () => { throw new Error("modelo caiu"); });
    vi.mocked(worldUpdate.updateNpcWorld).mockRejectedValue(new Error("npc caiu"));
    await expect(runResolutionAftermath({ doc: { send: vi.fn() } as never, config, chat }, pedido)).resolves.toBeUndefined();
  });
});
