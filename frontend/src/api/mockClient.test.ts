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
    await api.adminLockTurn(adminToken);
    await api.adminApplyResolution(adminToken, {
      publicResult: "A noite termina.",
      houseResults: {},
      attributeDeltas: {},
      discoveries: [],
    });
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

  it("rejects admin turn actions from invalid statuses", async () => {
    const { adminToken } = await api.adminLogin("admin-test");

    await expect(api.adminComposeTurn(adminToken, {
      publicEvent: "Não pode.",
      privateInfo: {},
      cards: [],
    })).rejects.toMatchObject({ code: "BAD_STATUS" });
    await expect(api.adminOpenTurn(adminToken)).rejects.toMatchObject({ code: "BAD_STATUS" });
    await expect(api.adminUnlockTurn(adminToken)).rejects.toMatchObject({ code: "BAD_STATUS" });
    await expect(api.adminDraftPrivateInfo(adminToken)).rejects.toMatchObject({ code: "BAD_STATUS" });
    await expect(api.adminDraftResolution(adminToken)).rejects.toMatchObject({ code: "BAD_STATUS" });
    await expect(api.adminApplyResolution(adminToken, {
      publicResult: "Não pode.",
      houseResults: {},
      attributeDeltas: {},
      discoveries: [],
    })).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("rejects invalid attributes like the backend", async () => {
    await expect(api.createAccountAndHouse({
      ...houseInput,
      attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 },
    })).rejects.toMatchObject({ code: "INVALID_ATTRIBUTES" });
  });

  it("admin can create, update and delete houses", async () => {
    const { adminToken } = await api.adminLogin("admin-test");

    const created = await api.adminCreateHouse(adminToken, {
      ...houseInput,
      attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 },
    });
    expect(created.houseId).toBeTruthy();
    expect(created.playerCode).toBeTruthy();

    await api.adminUpdateHouse(adminToken, {
      houseId: created.houseId,
      name: "Casa Editada",
      motto: houseInput.motto,
      emblem: houseInput.emblem,
      leaderName: houseInput.leaderName,
      heirName: houseInput.heirName,
      castleName: houseInput.castleName,
      townsText: houseInput.townsText,
      historyText: houseInput.historyText,
      specialty: houseInput.specialty,
      weakness: houseInput.weakness,
      attributes: { riqueza: 0, recursos: 0, soldados: 1, controle: 0 },
    });

    const result = await api.adminDeleteHouse(adminToken, created.houseId);
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    await expect(api.login(created.playerCode)).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("generates, exposes and deletes turn images, feeding the gallery", async () => {
    const { adminToken } = await api.adminLogin("admin-test");

    const generated = await api.adminGenerateTurnImage(adminToken, "event", "prompt do evento");
    expect(generated.imageUrl).toContain("event");

    const dashboard = await api.getAdminDashboard(adminToken);
    expect(dashboard.eventImageUrl).toBe(generated.imageUrl);

    const gallery = await api.getGallery();
    expect(gallery.some((entry) => entry.eventImageUrl === generated.imageUrl)).toBe(true);

    await api.adminDeleteTurnImage(adminToken, "event");
    const afterDelete = await api.getAdminDashboard(adminToken);
    expect(afterDelete.eventImageUrl).toBeUndefined();
  });

  it("archives resolved turn images into the gallery after applying resolution", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    await api.adminLockTurn(adminToken);
    const resultImage = await api.adminGenerateTurnImage(adminToken, "result", "prompt do resultado");
    await api.adminApplyResolution(adminToken, {
      publicResult: "O vale sobrevive.",
      houseResults: {},
      attributeDeltas: {},
      discoveries: [],
    });

    const gallery = await api.getGallery();
    expect(gallery.some((entry) => entry.resultImageUrl === resultImage.imageUrl)).toBe(true);
  });

  it("creates, lists, updates and deletes wiki entries", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    const created = await api.adminCreateWikiEntry(adminToken, {
      section: "casas",
      title: "Casa Vargen",
      body: "Os lobos do norte.",
      order: 1,
    });
    expect(created.entryId).toBeTruthy();

    const publicList = await api.getWiki();
    expect(publicList).toHaveLength(1);
    expect(publicList[0].title).toBe("Casa Vargen");

    await api.adminUpdateWikiEntry(adminToken, created.entryId, {
      section: "casas",
      title: "Casa Vargen (caída)",
      body: "A muralha ruiu.",
      order: 1,
    });
    expect((await api.getWiki())[0].title).toBe("Casa Vargen (caída)");

    await api.adminDeleteWikiEntry(adminToken, created.entryId);
    expect(await api.getWiki()).toHaveLength(0);
  });
});
