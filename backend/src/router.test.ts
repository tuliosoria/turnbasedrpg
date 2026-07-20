import { describe, it, expect, beforeEach, vi } from "vitest";
import { route } from "./router";
import type { Config } from "./types/domain";
import * as housesDb from "./db/houses";

vi.mock("./db/houses", () => ({
  createAccountAndHouse: vi.fn(),
  getHouse: vi.fn(),
  listHouses: vi.fn(),
  updateHouseAttributes: vi.fn(),
}));

vi.mock("./db/players", () => ({
  getPlayerByCodeHash: vi.fn(),
}));

vi.mock("./db/turns", () => ({
  getActiveTurn: vi.fn(),
  listTurns: vi.fn(),
  putTurn: vi.fn(),
  setTurnStatus: vi.fn(),
  saveTurnResult: vi.fn(),
  createNextTurnDraft: vi.fn(),
}));

vi.mock("./db/submissions", () => ({
  getSubmission: vi.fn(),
  putSubmission: vi.fn(),
  listSubmissions: vi.fn(),
}));

const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: "x",
  tokenSigningSecret: "secret",
  allowedOrigin: "http://localhost:5173",
  tokenTtlSeconds: 3600,
  openAiApiKey: "",
  openAiModel: "gpt-4o-mini",
  imagesBucket: "",
};
const deps = { doc: { send: vi.fn() } as any, config };
const req = (method: string, path: string, over = {}) => ({ method, path, headers: {}, body: undefined, pathParams: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route", () => {
  it("dispatches GET /api/campaign", async () => {
    const res = await route(deps, req("GET", "/api/campaign"));

    expect(res.status).toBe(200);
    expect((res.body as any).title).toBe("O Inverno dos Mortos");
  });

  it("dispatches GET /api/house-example", async () => {
    const res = await route(deps, req("GET", "/api/house-example"));

    expect(res.status).toBe(200);
    expect((res.body as any).name).toMatch(/Vargen/);
  });

  it("dispatches PUT /api/player/order to the player handler", async () => {
    const res = await route(deps, req("PUT", "/api/player/order", { body: { orderText: "Ordem" } }));

    expect(res.status).toBe(401);
    expect((res.body as any).code).toBe("SESSION_EXPIRED");
  });

  it.each([
    "/api/admin/turn/draft-private",
    "/api/admin/turn/draft-resolution",
    "/api/admin/turn/apply",
  ])("dispatches POST %s to an admin handler", async (path) => {
    const res = await route(deps, req("POST", path));

    expect(res.status).toBe(401);
    expect((res.body as any).code).toBe("SESSION_EXPIRED");
  });

  it("returns 404 for removed routes", async () => {
    const res = await route(deps, req("GET", "/api/houses"));

    expect(res.status).toBe(404);
  });

  it("maps HttpError to its status without leaking internals", async () => {
    vi.mocked(housesDb.createAccountAndHouse).mockResolvedValue({ houseId: "x" });

    const res = await route(deps, req("POST", "/api/create-account", { body: { displayName: "Elira" } }));

    expect(res.status).toBe(400);
    expect((res.body as any).code).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/stack|DynamoDB/i);
  });
});
