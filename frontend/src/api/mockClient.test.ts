import { describe, it, expect, beforeEach } from "vitest";
import { MockApiClient } from "./mockClient";
import { ApiError } from "../types/api";

let api: MockApiClient;
beforeEach(() => { api = new MockApiClient(); });

describe("MockApiClient", () => {
  it("lists six available houses initially", async () => {
    const houses = await api.getHouses();
    expect(houses).toHaveLength(6);
    expect(houses.every((h) => h.available)).toBe(true);
  });

  it("claims a free house and marks it unavailable", async () => {
    const res = await api.claimHouse("vargen", "Elira");
    expect(res.houseId).toBe("vargen");
    expect(res.playerCode).toMatch(/^vargen-[A-Z0-9]{4}$/);
    const houses = await api.getHouses();
    expect(houses.find((h) => h.id === "vargen")!.available).toBe(false);
  });

  it("rejects claiming an already-taken house", async () => {
    await api.claimHouse("vargen", "Elira");
    await expect(api.claimHouse("vargen", "Other")).rejects.toMatchObject({
      code: "HOUSE_TAKEN",
    });
  });

  it("logs in with a valid code and rejects an invalid one", async () => {
    const { playerCode } = await api.claimHouse("vargen", "Elira");
    const login = await api.login(playerCode);
    expect(login.houseId).toBe("vargen");
    await expect(api.login("nope-0000")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("returns only the player's own private content with three cards", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    expect(game.houseId).toBe("vargen");
    expect(game.cards).toHaveLength(3);
    expect(game.privateIntroduction.length).toBeGreaterThan(0);
    expect(game.turnStatus).toBe("OPEN");
  });

  it("saves and replaces a choice while the turn is open", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    const first = await api.submitChoice(playerToken, 1, game.cards[0].id);
    expect(first.cardId).toBe(game.cards[0].id);
    const second = await api.submitChoice(playerToken, 1, game.cards[1].id);
    expect(second.cardId).toBe(game.cards[1].id);
    expect((await api.getGame(playerToken)).currentChoice!.cardId).toBe(game.cards[1].id);
  });

  it("rejects a card that does not belong to the house", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    await expect(api.submitChoice(playerToken, 1, "auremont-send-caravans")).rejects.toMatchObject({
      code: "INVALID_CARD",
    });
  });

  it("blocks choosing when the turn is locked", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    const { adminToken } = await api.adminLogin("admin-test");
    await api.lockTurn(adminToken);
    await expect(api.submitChoice(playerToken, 1, game.cards[0].id)).rejects.toMatchObject({
      code: "TURN_LOCKED",
    });
  });

  it("admin dashboard reflects claims and choices", async () => {
    const { playerToken } = await api.claimHouse("vargen", "Elira");
    const game = await api.getGame(playerToken);
    await api.submitChoice(playerToken, 1, game.cards[0].id);
    const { adminToken } = await api.adminLogin("admin-test");
    const dash = await api.getAdminDashboard(adminToken);
    const vargen = dash.rows.find((r) => r.houseId === "vargen")!;
    expect(vargen.claimed).toBe(true);
    expect(vargen.cardId).toBe(game.cards[0].id);
    expect(dash.rows).toHaveLength(6);
  });
});
