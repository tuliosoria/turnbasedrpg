import { describe, it, expect, beforeEach, vi } from "vitest";
import type { House, Turn } from "@ravenloft/content";
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, editHouse } from "./adminRoutes";
import { hashCode } from "../auth/codes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";
import * as turnsDb from "../db/turns";
import * as housesDb from "../db/houses";
import * as submissionsDb from "../db/submissions";

vi.mock("../db/turns", () => ({
  getActiveTurn: vi.fn(),
  putTurn: vi.fn(),
  setTurnStatus: vi.fn(),
}));

vi.mock("../db/houses", () => ({
  listHouses: vi.fn(),
  updateHouseAttributes: vi.fn(),
}));

vi.mock("../db/submissions", () => ({
  listSubmissions: vi.fn(),
}));

const ADMIN_CODE = "admin-secret";
const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: hashCode(ADMIN_CODE),
  tokenSigningSecret: "secret",
  allowedOrigin: "*",
  tokenTtlSeconds: 3600,
  openAiApiKey: "",
  openAiModel: "gpt-4o-mini",
};
const deps = { doc: { send: vi.fn() } as any, config };
const adminToken = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60000 }, "secret");
const authReq = (over = {}) => ({
  method: "GET",
  path: "/",
  headers: { authorization: `Bearer ${adminToken}` },
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
  attributes: { riqueza: 1, recursos: 2, soldados: 5, controle: 2 },
  createdAt: "2026-01-01T00:00:00.000Z",
};
const draftTurn: Turn = { turnId: 1, status: "DRAFT", publicEvent: "", privateInfo: {}, cards: [], createdAt: "2026-01-02T00:00:00.000Z" };
const composedTurn: Turn = {
  ...draftTurn,
  status: "OPEN",
  publicEvent: "A neve bloqueia as estradas.",
  privateInfo: { "casa-vargen": "Rastros nas Brumas." },
  cards: [{ id: "fortificar", title: "Fortificar", constraintText: "", narrativeQuestion: "?", consequenceText: "" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(draftTurn);
  vi.mocked(housesDb.listHouses).mockResolvedValue([house]);
  vi.mocked(submissionsDb.listSubmissions).mockResolvedValue([]);
});

describe("adminLogin", () => {
  it("returns a token for the correct code", async () => {
    const res = await adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: ADMIN_CODE } });

    expect(res.status).toBe(200);
    expect((res.body as any).adminToken).toBeTruthy();
  });

  it("rejects a wrong code", async () => {
    await expect(adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: "wrong" } })).rejects.toMatchObject({ status: 401 });
  });
});

describe("getDashboard", () => {
  it("returns the active turn, houses, and submissions", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(composedTurn);
    vi.mocked(submissionsDb.listSubmissions).mockResolvedValue([{ houseId: "casa-vargen", orderText: "Ordem", cardResponses: [], submittedAt: "2026-01-03T00:00:00.000Z" }]);

    const res = await getDashboard(deps, authReq());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      turnId: 1,
      turnStatus: "OPEN",
      publicEvent: "A neve bloqueia as estradas.",
      privateInfo: { "casa-vargen": "Rastros nas Brumas." },
      cards: composedTurn.cards,
      result: null,
      houses: [house],
    });
    expect((res.body as any).submissions).toHaveLength(1);
  });

  it("rejects a request without an admin token", async () => {
    await expect(getDashboard(deps, { method: "GET", path: "/", headers: {}, pathParams: {}, body: undefined })).rejects.toMatchObject({ status: 401 });
  });
});

describe("composeTurn", () => {
  it("updates a draft turn", async () => {
    const body = { publicEvent: "Evento", privateInfo: { "casa-vargen": "Segredo" }, cards: [{ id: "c1", title: "Carta", constraintText: "", narrativeQuestion: "?", consequenceText: "" }] };

    const res = await composeTurn(deps, authReq({ method: "POST", body }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.putTurn).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", { ...draftTurn, ...body });
  });

  it("rejects when the active turn is not a draft", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "OPEN" });

    await expect(composeTurn(deps, authReq({ method: "POST", body: { publicEvent: "", privateInfo: {}, cards: [] } }))).rejects.toMatchObject({ status: 409, code: "BAD_STATUS" });
  });
});

describe("turn status actions", () => {
  it("opens a draft turn", async () => {
    const res = await openTurn(deps, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.setTurnStatus).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, "OPEN");
  });

  it("rejects opening a non-draft turn", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "OPEN" });

    await expect(openTurn(deps, authReq({ method: "POST" }))).rejects.toMatchObject({ status: 409, code: "BAD_STATUS" });
  });

  it("locks an open turn", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "OPEN" });

    const res = await lockTurn(deps, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.setTurnStatus).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, "LOCKED");
  });

  it("rejects locking a non-open turn", async () => {
    await expect(lockTurn(deps, authReq({ method: "POST" }))).rejects.toMatchObject({ status: 409, code: "BAD_STATUS" });
  });

  it("unlocks a locked turn", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "LOCKED" });

    const res = await unlockTurn(deps, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.setTurnStatus).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, "OPEN");
  });

  it("rejects unlocking a non-locked turn", async () => {
    await expect(unlockTurn(deps, authReq({ method: "POST" }))).rejects.toMatchObject({ status: 409, code: "BAD_STATUS" });
  });
});

describe("editHouse", () => {
  it("updates house attributes", async () => {
    const attributes = { riqueza: 2, recursos: 2, soldados: 4, controle: 2 };

    const res = await editHouse(deps, authReq({ method: "POST", body: { houseId: "casa-vargen", attributes } }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(housesDb.updateHouseAttributes).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "casa-vargen", attributes);
  });
});
