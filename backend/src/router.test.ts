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

vi.mock("./db/canonSubmissions", () => ({
  putCanonSubmission: vi.fn(),
  listCanonSubmissions: vi.fn(),
  getCanonSubmission: vi.fn(),
}));

vi.mock("./db/wiki", () => ({
  listCanonWikiEntries: vi.fn(),
  getWikiEntries: vi.fn(),
  putWikiEntry: vi.fn(),
  deleteWikiEntry: vi.fn(),
  listGmEntries: vi.fn(),
  putGmEntry: vi.fn(),
  deleteGmEntry: vi.fn(),
  seedWikiEntries: vi.fn(),
  seedGmEntries: vi.fn(),
}));

vi.mock("./db/rateLimit", () => ({
  hitRateLimit: vi.fn(),
}));

vi.mock("./ai/openai", () => ({
  generateJson: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("./canon/publish", () => ({
  publishCanonSubmission: vi.fn(),
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
  draftIngestToken: "",
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
    expect((res.body as any).title).toBe("Valdren");
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
    "/api/admin/turn/image/upload",
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

describe("canon routes", () => {
  it("routes every canon path", async () => {
    for (const [method, path] of [
      ["POST", "/api/player/canonico/preview"],
      ["POST", "/api/player/canonico/imagem"],
      ["POST", "/api/player/canonico"],
      ["GET", "/api/player/canonico"],
      ["GET", "/api/admin/canonico"],
      ["POST", "/api/admin/canonico/approve"],
      ["POST", "/api/admin/canonico/reject"],
    ] as const) {
      const res = await route(deps, req(method, path));
      // Sem sessão, cada rota deve responder 401 — o que importa é não ser 404
      expect(res.status).not.toBe(404);
    }
  });
});

describe("ordem das rotas de correspondência", () => {
  // "novas" é uma palavra, não uma chave de Casa. Registrada depois da rota
  // com parâmetro, ela seria engolida por ela e o contador nunca responderia —
  // devolveria a conversa com uma Casa chamada "novas", que não existe.
  it("resolve /novas com o contador, e não como chave de Casa", async () => {
    const auth = await import("./auth/playerAuth");
    vi.spyOn(auth, "requirePlayer").mockReturnValue({
      type: "player", campaignId: "winter-dead", houseId: "casa-a", displayName: "A", exp: Date.now() + 1e6,
    } as any);
    const turns = await import("./db/turns");
    vi.spyOn(turns, "getActiveTurn").mockResolvedValue({ turnId: 7, publicEvent: "" } as any);
    const msgs = await import("./db/diplomacy/messages");
    vi.spyOn(msgs, "listTurnMessages").mockResolvedValue([]);

    const res = await route(deps, req("GET", "/api/player/correspondencia/novas"));
    expect(res.status).toBe(200);
    // getThread devolveria { entries }; o contador devolve { cartas }.
    expect(res.body).toHaveProperty("cartas");
    expect(res.body).not.toHaveProperty("entries");
  });
});
