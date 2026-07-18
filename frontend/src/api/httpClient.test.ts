import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpApiClient } from "./httpClient";
import { ApiError } from "../types/api";

const BASE = "https://api.example.com";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("HttpApiClient", () => {
  it("GETs the campaign and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "winter-dead", title: "T" }));
    const client = new HttpApiClient(BASE);
    const result = await client.getCampaign();
    expect(result).toMatchObject({ id: "winter-dead" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/campaign");
    expect(init.method).toBe("GET");
  });

  it("strips a trailing slash from the base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await new HttpApiClient("https://api.example.com/").getHouses();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/houses");
  });

  it("POSTs claim-house with a JSON body and content-type header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { playerCode: "vargen-4K7P" }));
    await new HttpApiClient(BASE).claimHouse("vargen", "Elira");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/claim-house");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ houseId: "vargen", displayName: "Elira" });
  });

  it("sends the player token as a Bearer header on getGame", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { houseId: "vargen" }));
    await new HttpApiClient(BASE).getGame("tok-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/player/game");
    expect(init.headers["Authorization"]).toBe("Bearer tok-123");
  });

  it("PUTs a choice to the turn path with a Bearer token and cardId body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { cardId: "vargen-defend-bridge", chosenAt: "t" }));
    const res = await new HttpApiClient(BASE).submitChoice("tok", 1, "vargen-defend-bridge");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/turns/1/choice");
    expect(init.method).toBe("PUT");
    expect(init.headers["Authorization"]).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ cardId: "vargen-defend-bridge" });
    expect(res).toEqual({ cardId: "vargen-defend-bridge", chosenAt: "t" });
  });

  it("returns undefined (void) for a 204 lockTurn", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await new HttpApiClient(BASE).lockTurn("admin-tok");
    expect(res).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer admin-tok");
  });

  it("maps an error body to ApiError with its code and message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: "HOUSE_TAKEN", message: "Casa tomada." }));
    await expect(new HttpApiClient(BASE).claimHouse("vargen", "Elira")).rejects.toMatchObject({
      name: "ApiError",
      code: "HOUSE_TAKEN",
      message: "Casa tomada.",
    });
  });

  it("throws ApiError NETWORK when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await new HttpApiClient(BASE).getCampaign().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK");
  });
});
