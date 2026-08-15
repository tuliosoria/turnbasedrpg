import { describe, it, expect, beforeEach, vi } from "vitest";
import type { House, Turn } from "@ravenloft/content";
import { getGame, submitOrder } from "./playerRoutes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";
import * as housesDb from "../db/houses";
import * as turnsDb from "../db/turns";
import * as submissionsDb from "../db/submissions";

vi.mock("../db/houses", () => ({
  getHouse: vi.fn(),
}));

vi.mock("../db/turns", () => ({
  getActiveTurn: vi.fn(),
  listTurns: vi.fn(),
}));

vi.mock("../db/submissions", () => ({
  getSubmission: vi.fn(),
  putSubmission: vi.fn(),
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
  openAiImageModel: "gpt-image-1",
  openAiImageSize: "1536x1024",
  openAiImageQuality: "medium",
  openAiImageInputFidelity: "high",
  openAiSyncImageModel: "gpt-image-1",
  openAiSyncImageSize: "1536x1024",
  openAiSyncImageQuality: "medium",
  imagesBucket: "",
  visualWorkerFunctionName: "",
  draftIngestToken: "",
};
const deps = { doc: { send: vi.fn() } as any, config };
const token = (houseId = "casa-vargen") =>
  signToken({ type: "player", campaignId: "winter-dead", houseId, displayName: "Elira", exp: Date.now() + 60000 }, "secret");
const authReq = (over = {}) => ({
  method: "GET",
  path: "/",
  headers: { authorization: `Bearer ${token()}` },
  body: undefined,
  pathParams: {},
  ...over,
});

const house: House = {
  houseId: "casa-vargen",
  name: "Casa Vargen",
  motto: "O Norte lembra.",
  emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
  leaderName: "Aldric",
  heirName: "Sera",
  castleName: "Droskar",
  townsText: "Vilas do norte.",
  historyText: "Uma casa antiga.",
  specialty: "Defesa.",
  weakness: "Fome.",
  attributes: { riqueza: 2, recursos: 2, soldados: 4, controle: 2 },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const openTurn: Turn = {
  turnId: 1,
  status: "OPEN",
  publicEvent: "A neve bloqueia as estradas.",
  privateInfo: { "casa-vargen": "Os lobos viram rastros nas Brumas." },
  createdAt: "2026-01-02T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(housesDb.getHouse).mockResolvedValue(house);
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(openTurn);
  vi.mocked(turnsDb.listTurns).mockResolvedValue([openTurn]);
  vi.mocked(submissionsDb.getSubmission).mockResolvedValue(null);
});

describe("getGame", () => {
  it("returns the house, active turn, private information, and submission", async () => {
    vi.mocked(submissionsDb.getSubmission).mockResolvedValue({ houseId: "casa-vargen", orderText: "Ordem", submittedAt: "2026-01-03T00:00:00.000Z" });

    const res = await getGame(deps, authReq());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      house,
      turnId: 1,
      turnStatus: "OPEN",
      publicEvent: "A neve bloqueia as estradas.",
      privateInformation: "Os lobos viram rastros nas Brumas.",
      turnHistory: [],
    });
    expect((res.body as any).submission.orderText).toBe("Ordem");
  });

  it("hides draft turn content", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...openTurn, status: "DRAFT" });

    const res = await getGame(deps, authReq());

    expect(res.body).toMatchObject({ publicEvent: "", privateInformation: "" });
  });

  it("includes resolved turns in turnHistory", async () => {
    const resolvedTurn: Turn = {
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "O reino sobreviveu à noite.",
        houseResults: { "casa-vargen": "Vargen segurou a passagem." },
        attributeDeltas: {},
        discoveries: ["Há mortos sob o lago."],
      },
      resultImageUrl: "https://example.com/resultado.png",
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(resolvedTurn);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([resolvedTurn]);

    const res = await getGame(deps, authReq());

    expect((res.body as any).turnHistory).toEqual([
      {
        turnId: 1,
        publicResult: "O reino sobreviveu à noite.",
        privateResult: "Vargen segurou a passagem.",
        discoveries: ["Há mortos sob o lago."],
        resultImageUrl: "https://example.com/resultado.png",
        attributeChanges: [],
      },
    ]);
  });

  it("surfaces before/after attribute changes for the player's house (new snapshot)", async () => {
    const resolvedTurn: Turn = {
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "Público.",
        houseResults: { "casa-vargen": "Privado." },
        attributeDeltas: { "casa-vargen": { controle: -1 } },
        attributeChanges: {
          "casa-vargen": [{ key: "controle", before: 3, after: 2 }],
          "casa-baixa": [{ key: "riqueza", before: 1, after: 3 }],
        },
        discoveries: [],
      },
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(resolvedTurn);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([resolvedTurn]);

    const res = await getGame(deps, authReq());

    expect((res.body as any).turnHistory[0].attributeChanges).toEqual([
      { key: "controle", before: 3, after: 2, delta: -1 },
    ]);
  });

  it("shows no change on a new turn when the delta was fully absorbed by the clamp", async () => {
    const resolvedTurn: Turn = {
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "Público.",
        houseResults: { "casa-vargen": "Privado." },
        attributeDeltas: { "casa-vargen": { controle: -1 } },
        attributeChanges: {},
        discoveries: [],
      },
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(resolvedTurn);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([resolvedTurn]);

    const res = await getGame(deps, authReq());

    expect((res.body as any).turnHistory[0].attributeChanges).toEqual([]);
  });

  it("falls back to delta-only changes for old resolved turns without a snapshot", async () => {
    const resolvedTurn: Turn = {
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "Público.",
        houseResults: { "casa-vargen": "Privado." },
        attributeDeltas: { "casa-vargen": { controle: -1, soldados: 0, recursos: 2 } },
        discoveries: [],
      },
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(resolvedTurn);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([resolvedTurn]);

    const res = await getGame(deps, authReq());

    expect((res.body as any).turnHistory[0].attributeChanges).toEqual([
      { key: "controle", delta: -1 },
      { key: "recursos", delta: 2 },
    ]);
  });

  it("lists multiple resolved turns ascending and excludes non-resolved turns", async () => {
    const turn1: Turn = {
      ...openTurn,
      turnId: 1,
      status: "RESOLVED",
      result: {
        publicResult: "Turno 1 público.",
        houseResults: { "casa-vargen": "Vargen no turno 1." },
        attributeDeltas: {},
        discoveries: [],
      },
    };
    const turn2: Turn = {
      ...openTurn,
      turnId: 2,
      status: "RESOLVED",
      result: {
        publicResult: "Turno 2 público.",
        houseResults: { "casa-vargen": "Vargen no turno 2." },
        attributeDeltas: {},
        discoveries: [],
      },
    };
    const turn3Open: Turn = { ...openTurn, turnId: 3, status: "OPEN" };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(turn3Open);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([turn2, turn3Open, turn1]);

    const res = await getGame(deps, authReq());

    const history = (res.body as any).turnHistory;
    expect(history.map((h: any) => h.turnId)).toEqual([1, 2]);
    expect(history[0].privateResult).toBe("Vargen no turno 1.");
    expect(history[1].privateResult).toBe("Vargen no turno 2.");
  });
});

describe("submitOrder", () => {
  it("rejects when the turn is not OPEN", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...openTurn, status: "LOCKED" });

    await expect(submitOrder(deps, authReq({ method: "PUT", body: { orderText: "Marchar." } }))).rejects.toMatchObject({
      status: 423,
      code: "TURN_LOCKED",
    });
  });

  it("accepts a valid free-text order", async () => {
    const res = await submitOrder(deps, authReq({
      method: "PUT",
      body: { orderText: "Fortificar a passagem e erguer paliçadas." },
    }));

    expect(res.status).toBe(200);
    expect((res.body as any).submittedAt).toEqual(expect.any(String));
    expect(submissionsDb.putSubmission).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, {
      houseId: "casa-vargen",
      orderText: "Fortificar a passagem e erguer paliçadas.",
      submittedAt: expect.any(String),
    });
  });
});
