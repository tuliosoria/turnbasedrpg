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
  imagesBucket: "",
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
  cards: [
    {
      id: "fortificar",
      title: "Fortificar a passagem",
      constraintText: "Gaste riqueza.",
      narrativeQuestion: "Como a Casa resiste?",
      consequenceText: "A passagem pode resistir.",
      spend: { attribute: "riqueza", max: 5 },
      choice: { attributes: ["soldados", "controle"], amount: 1 },
    },
  ],
  createdAt: "2026-01-02T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(housesDb.getHouse).mockResolvedValue(house);
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(openTurn);
  vi.mocked(submissionsDb.getSubmission).mockResolvedValue(null);
});

describe("getGame", () => {
  it("returns the house, active turn, private information, cards, and submission", async () => {
    vi.mocked(submissionsDb.getSubmission).mockResolvedValue({ houseId: "casa-vargen", orderText: "Ordem", cardResponses: [], submittedAt: "2026-01-03T00:00:00.000Z" });

    const res = await getGame(deps, authReq());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      house,
      turnId: 1,
      turnStatus: "OPEN",
      publicEvent: "A neve bloqueia as estradas.",
      privateInformation: "Os lobos viram rastros nas Brumas.",
      cards: openTurn.cards,
      previousResult: null,
    });
    expect((res.body as any).submission.orderText).toBe("Ordem");
  });

  it("hides draft turn content", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...openTurn, status: "DRAFT" });

    const res = await getGame(deps, authReq());

    expect(res.body).toMatchObject({ publicEvent: "", privateInformation: "", cards: [] });
  });

  it("includes the previous result when the active turn is resolved", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "O reino sobreviveu à noite.",
        houseResults: { "casa-vargen": "Vargen segurou a passagem." },
        attributeDeltas: {},
        discoveries: ["Há mortos sob o lago."],
      },
    });

    const res = await getGame(deps, authReq());

    expect((res.body as any).previousResult).toEqual({
      publicResult: "O reino sobreviveu à noite.",
      privateResult: "Vargen segurou a passagem.",
      discoveries: ["Há mortos sob o lago."],
    });
  });
});

describe("submitOrder", () => {
  it("rejects when the turn is not OPEN", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...openTurn, status: "LOCKED" });

    await expect(submitOrder(deps, authReq({ method: "PUT", body: { orderText: "Marchar.", cardResponses: [] } }))).rejects.toMatchObject({
      status: 423,
      code: "TURN_LOCKED",
    });
  });

  it("rejects declared spend over the house attribute", async () => {
    await expect(submitOrder(deps, authReq({
      method: "PUT",
      body: { orderText: "Comprar madeira.", cardResponses: [{ cardId: "fortificar", text: "Pagamos.", declaredSpend: { attribute: "riqueza", amount: 3 } }] },
    }))).rejects.toMatchObject({ status: 400, code: "INVALID_SPEND" });
  });

  it("rejects a non-numeric declared spend", async () => {
    await expect(submitOrder(deps, authReq({
      method: "PUT",
      body: { orderText: "Comprar madeira.", cardResponses: [{ cardId: "fortificar", text: "Pagamos.", declaredSpend: { attribute: "riqueza", amount: "muito" } }] },
    }))).rejects.toMatchObject({ status: 400, code: "INVALID_SPEND" });
  });

  it("accepts a valid order", async () => {
    const res = await submitOrder(deps, authReq({
      method: "PUT",
      body: { orderText: "Fortificar a passagem.", cardResponses: [{ cardId: "fortificar", text: "Erguemos paliçadas.", declaredSpend: { attribute: "riqueza", amount: 2 }, declaredChoice: { attribute: "soldados" } }] },
    }));

    expect(res.status).toBe(200);
    expect((res.body as any).submittedAt).toEqual(expect.any(String));
    expect(submissionsDb.putSubmission).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, {
      houseId: "casa-vargen",
      orderText: "Fortificar a passagem.",
      cardResponses: [{ cardId: "fortificar", text: "Erguemos paliçadas.", declaredSpend: { attribute: "riqueza", amount: 2 }, declaredChoice: { attribute: "soldados" } }],
      submittedAt: expect.any(String),
    });
  });
});
