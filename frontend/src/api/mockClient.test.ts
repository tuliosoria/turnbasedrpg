import { describe, it, expect, beforeEach } from "vitest";
import { MockApiClient } from "./mockClient";
import type { CreateHouseInput } from "../types/api";

let api: MockApiClient;

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
  api = new MockApiClient();
});

describe("MockApiClient", () => {
  it("creates an account and getGame reflects the created house", async () => {
    const created = await api.createAccountAndHouse(houseInput);

    expect(created.playerCode).toMatch(/^RVN-[A-Z0-9]{4}$/);
    expect(created.houseId).toMatch(/^house-/);
    const game = await api.getGame(created.playerToken);

    expect(game.house).toMatchObject({
      houseId: created.houseId,
      name: "Casa Vargen",
      attributes: houseInput.attributes,
    });
    expect(game.turnStatus).toBe("OPEN");
    expect(game.cards).toHaveLength(2);
    expect(game.privateInformation).toContain("Casa Vargen");
  });

  it("stores and updates an editable submission", async () => {
    const { playerToken } = await api.createAccountAndHouse(houseInput);
    const game = await api.getGame(playerToken);

    await api.submitOrder(playerToken, {
      orderText: "Fortificar a ponte.",
      cardResponses: [{ cardId: game.cards[0].id, declaredSpend: { attribute: "soldados", amount: 2 }, text: "Enviar soldados." }],
    });
    await api.submitOrder(playerToken, {
      orderText: "Poupar forças.",
      cardResponses: [{ cardId: game.cards[1].id, declaredChoice: { attribute: "recursos" }, text: "Usar suprimentos." }],
    });

    const updated = await api.getGame(playerToken);
    expect(updated.submission).toMatchObject({
      houseId: updated.house.houseId,
      orderText: "Poupar forças.",
      cardResponses: [{ cardId: game.cards[1].id, declaredChoice: { attribute: "recursos" }, text: "Usar suprimentos." }],
    });
  });

  it("admin login dashboard lists the created house and submissions", async () => {
    const { playerToken, houseId } = await api.createAccountAndHouse(houseInput);
    await api.submitOrder(playerToken, { orderText: "Marchar.", cardResponses: [] });

    const { adminToken } = await api.adminLogin("admin-test");
    const dashboard = await api.getAdminDashboard(adminToken);

    expect(dashboard.houses.some((house) => house.houseId === houseId)).toBe(true);
    expect(dashboard.houses.length).toBeGreaterThan(1);
    expect(dashboard.submissions).toHaveLength(1);
    expect(dashboard.turnStatus).toBe("OPEN");
  });

  it("compose plus open updates the turn and makes it OPEN", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    await api.adminComposeTurn(adminToken, {
      publicEvent: "Uma nevasca cobre o vale.",
      privateInfo: { "seed-vargen": "Os lobos farejam perigo." },
      cards: [{
        id: "nevasca",
        title: "Resistir à Nevasca",
        constraintText: "Escolha um atributo.",
        narrativeQuestion: "Como sua casa protege o povo?",
        consequenceText: "O vale julgará sua resposta.",
        choice: { attributes: ["recursos", "controle"], amount: 1 },
      }],
    });
    await api.adminOpenTurn(adminToken);

    const dashboard = await api.getAdminDashboard(adminToken);
    expect(dashboard.turnStatus).toBe("OPEN");
    expect(dashboard.publicEvent).toBe("Uma nevasca cobre o vale.");
    expect(dashboard.cards.map((card) => card.id)).toEqual(["nevasca"]);
  });
});
