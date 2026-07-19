import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpApiClient } from "./httpClient";
import { ApiError, type CreateHouseInput } from "../types/api";

const BASE = "https://api.example.com";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

const houseInput: CreateHouseInput = {
  displayName: "Elira",
  name: "Casa Vargen",
  motto: "O Norte lembra.",
  emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
  leaderName: "Aldric",
  heirName: "Sera",
  castleName: "Droskar",
  townsText: "Vilas do norte.",
  historyText: "Uma casa antiga.",
  specialty: "Defesa",
  weakness: "Pouca comida",
  attributes: { riqueza: 1, recursos: 2, soldados: 5, controle: 2 },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("HttpApiClient", () => {
  it("GETs campaign and house example from public endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "winter-dead", title: "T", introduction: "I" }))
      .mockResolvedValueOnce(jsonResponse(200, houseInput));
    const client = new HttpApiClient(`${BASE}/`);

    await expect(client.getCampaign()).resolves.toMatchObject({ id: "winter-dead" });
    await expect(client.getHouseExample()).resolves.toMatchObject({ name: "Casa Vargen" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/campaign");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.com/api/house-example");
  });

  it("POSTs create-account and player login with JSON bodies", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { playerCode: "RVN-1234", playerToken: "tok", houseId: "house-1", displayName: "Elira" }))
      .mockResolvedValueOnce(jsonResponse(200, { playerToken: "tok", houseId: "house-1", displayName: "Elira" }));

    await new HttpApiClient(BASE).createAccountAndHouse(houseInput);
    await new HttpApiClient(BASE).login("RVN-1234");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/create-account");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(houseInput);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.com/api/player/login");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ playerCode: "RVN-1234" });
  });

  it("uses Bearer auth for player game and order submission", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { house: {}, turnId: 1, cards: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { submittedAt: "2026-01-01T00:00:00.000Z" }));

    await new HttpApiClient(BASE).getGame("player-token");
    await new HttpApiClient(BASE).submitOrder("player-token", { orderText: "Avançar.", cardResponses: [] });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/player/game");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer player-token");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.com/api/player/order");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer player-token");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ orderText: "Avançar.", cardResponses: [] });
  });

  it("maps admin endpoints to the deployed API contract", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { adminToken: "admin-token", privateInfo: {}, nextTurnId: 2 })),
    );
    const client = new HttpApiClient(BASE);

    await client.adminLogin("secret");
    await client.getAdminDashboard("admin-token");
    await client.adminComposeTurn("admin-token", { publicEvent: "Neve.", privateInfo: {}, cards: [] });
    await client.adminOpenTurn("admin-token");
    await client.adminLockTurn("admin-token");
    await client.adminUnlockTurn("admin-token");
    await client.adminDraftPrivateInfo("admin-token");
    await client.adminDraftResolution("admin-token");
    await client.adminApplyResolution("admin-token", { publicResult: "Fim.", houseResults: {}, attributeDeltas: {}, discoveries: [] });
    await client.adminDeleteHouse("admin-token", "house-1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${BASE}/api/admin/login`,
      `${BASE}/api/admin/dashboard`,
      `${BASE}/api/admin/turn/compose`,
      `${BASE}/api/admin/turn/open`,
      `${BASE}/api/admin/turn/lock`,
      `${BASE}/api/admin/turn/unlock`,
      `${BASE}/api/admin/turn/draft-private`,
      `${BASE}/api/admin/turn/draft-resolution`,
      `${BASE}/api/admin/turn/apply`,
      `${BASE}/api/admin/house/delete`,
    ]);
    expect(JSON.parse(fetchMock.mock.calls[9][1].body)).toEqual({
      houseId: "house-1",
    });
  });

  it("unwraps privateInfo from admin draft private response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { privateInfo: { "house-1": "Segredo." } }));
    await expect(new HttpApiClient(BASE).adminDraftPrivateInfo("admin-token")).resolves.toEqual({
      "house-1": "Segredo.",
    });
  });

  it("maps known and unknown error bodies to ApiError codes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { code: "INVALID_SPEND", message: "Gasto inválido." }));
    await expect(new HttpApiClient(BASE).submitOrder("tok", { orderText: "", cardResponses: [] })).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_SPEND",
      message: "Gasto inválido.",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { code: "STRANGE", message: "Falhou." }));
    await expect(new HttpApiClient(BASE).getCampaign()).rejects.toMatchObject({
      code: "INTERNAL",
      message: "Falhou.",
    });
  });

  it("throws ApiError NETWORK when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await new HttpApiClient(BASE).getCampaign().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK");
  });
});
