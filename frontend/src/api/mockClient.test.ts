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
    expect(game.privateInformation).toContain("Casa Vargen");
  });

  it("stores and updates an editable submission", async () => {
    const { playerToken } = await api.createAccountAndHouse(houseInput);

    await api.submitOrder(playerToken, {
      orderText: "Fortificar a ponte.",
    });
    await api.submitOrder(playerToken, {
      orderText: "Poupar forças.",
    });

    const updated = await api.getGame(playerToken);
    expect(updated.submission).toMatchObject({
      houseId: updated.house.houseId,
      orderText: "Poupar forças.",
    });
  });

  it("admin login dashboard lists the created house and submissions", async () => {
    const { playerToken, houseId } = await api.createAccountAndHouse(houseInput);
    await api.submitOrder(playerToken, { orderText: "Marchar." });

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
    });
    await api.adminOpenTurn(adminToken);

    const dashboard = await api.getAdminDashboard(adminToken);
    expect(dashboard.turnStatus).toBe("OPEN");
    expect(dashboard.publicEvent).toBe("Uma nevasca cobre o vale.");
  });

  it("rejects admin turn actions from invalid statuses", async () => {
    const { adminToken } = await api.adminLogin("admin-test");

    await expect(api.adminComposeTurn(adminToken, {
      publicEvent: "Não pode.",
      privateInfo: {},
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

  it("uploads a mock turn image and exposes it in gallery", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    await api.adminLockTurn(adminToken);
    const uploaded = await api.adminUploadTurnImage(adminToken, "result", new File(["webp"], "resultado.webp", { type: "image/webp" }));
    await api.adminApplyResolution(adminToken, {
      publicResult: "O vale sobrevive.",
      houseResults: {},
      attributeDeltas: {},
      discoveries: [],
    });

    expect(uploaded.imageUrl).toMatch(/https:\/\/mock\.images\/turns\/1\/result\.webp\?v=\d+/);
    const gallery = await api.getGallery();
    expect(gallery[0].resultImageUrl).toBe(uploaded.imageUrl);
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

  it("keeps draft and locked result images out of the public gallery", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    await api.adminResetCampaign(adminToken);
    const draftImage = await api.adminUploadTurnImage(adminToken, "event", new File(["png"], "evento.png", { type: "image/png" }));
    expect(await api.getGallery()).toEqual([]);

    await api.adminComposeTurn(adminToken, {
      publicEvent: "Evento aberto.",
      privateInfo: {},
    });
    await api.adminOpenTurn(adminToken);
    const openGallery = await api.getGallery();
    expect(openGallery.some((entry) => entry.eventImageUrl === draftImage.imageUrl)).toBe(true);

    await api.adminLockTurn(adminToken);
    const lockedResult = await api.adminUploadTurnImage(adminToken, "result", new File(["png"], "resultado.png", { type: "image/png" }));
    expect((await api.getGallery()).some((entry) => entry.resultImageUrl === lockedResult.imageUrl)).toBe(false);
  });

  it("creates, lists, updates and deletes wiki entries", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    const created = await api.adminCreateWikiEntry(adminToken, {
      section: "casas",
      title: "Casa Vargen",
      body: "Os lobos do norte.",
      order: 1,
      imageUrls: ["/houses/vargen.jpg"],
    });
    expect(created.entryId).toBeTruthy();
    expect(created.imageUrl).toBe("/houses/vargen.jpg");

    const publicList = await api.getWiki();
    expect(publicList).toHaveLength(1);
    expect(publicList[0].title).toBe("Casa Vargen");
    expect(publicList[0].imageUrl).toBe("/houses/vargen.jpg");

    await api.adminUpdateWikiEntry(adminToken, created.entryId, {
      section: "casas",
      title: "Casa Vargen (caída)",
      body: "A muralha ruiu.",
      order: 1,
      imageUrls: ["/houses/vargen-fallen.jpg"],
    });
    expect((await api.getWiki())[0].title).toBe("Casa Vargen (caída)");
    expect((await api.getWiki())[0].imageUrl).toBe("/houses/vargen-fallen.jpg");

    await api.adminDeleteWikiEntry(adminToken, created.entryId);
    expect(await api.getWiki()).toHaveLength(0);
  });

  it("seeds the default cosmology only when empty", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    const first = await api.adminSeedWiki(adminToken);
    expect(first.seeded).toBeGreaterThan(0);
    expect((await api.getWiki()).length).toBe(first.seeded);
    expect((await api.getWiki()).find((entry) => entry.title === "Casa Euralune — Os Senhores do Céu")?.imageUrl).toBe("/houses/euralune.jpg");

    const second = await api.adminSeedWiki(adminToken);
    expect(second.seeded).toBe(0);
    expect((await api.getWiki()).length).toBe(first.seeded);
  });

  it("accumulates resolved turns in getGame turnHistory", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse(houseInput);
    const { adminToken } = await client.adminLogin("admin-test");

    // Starter turn (turnId 1) is already OPEN — lock and resolve it.
    await client.adminLockTurn(adminToken);
    await client.adminApplyResolution(adminToken, {
      publicResult: "Resultado público 1",
      houseResults: { [account.houseId]: "Privado casa turno 1" },
      attributeDeltas: {},
      discoveries: [],
    });

    const view = await client.getGame(account.playerToken);
    expect(view.turnHistory).toHaveLength(1);
    expect(view.turnHistory[0]).toMatchObject({
      turnId: 1,
      publicResult: "Resultado público 1",
      privateResult: "Privado casa turno 1",
    });
  });

  it("manages GM bible entries privately and seeds only when empty", async () => {
    const { adminToken } = await api.adminLogin("admin-test");
    const created = await api.adminCreateGmEntry(adminToken, {
      section: "a-verdade",
      title: "A verdade sobre Othmar",
      body: "O rei apagado.",
      order: 1,
    });
    expect(created.entryId).toBeTruthy();
    expect(await api.adminListGm(adminToken)).toHaveLength(1);

    await api.adminDeleteGmEntry(adminToken, created.entryId);
    expect(await api.adminListGm(adminToken)).toHaveLength(0);

    const first = await api.adminSeedGm(adminToken);
    expect(first.seeded).toBeGreaterThan(0);
    expect((await api.adminListGm(adminToken)).length).toBe(first.seeded);

    const second = await api.adminSeedGm(adminToken);
    expect(second.seeded).toBe(0);
  });
});

describe("visual canon methods", () => {
  it("creates an entity and returns it from the list", async () => {
    const client = new MockApiClient();
    const created = await client.createVisualEntity("admin-token", {
      canonicalName: "Ordem do Sino",
      entityType: "HOUSE",
    });
    expect(created.canonicalName).toBe("Ordem do Sino");
    const all = await client.listVisualEntities();
    expect(all.map((e) => e.canonicalName)).toContain("Ordem do Sino");
  });

  it("updates an entity's immutable traits", async () => {
    const client = new MockApiClient();
    const created = await client.createVisualEntity("admin-token", {
      canonicalName: "Khar-Durak",
      entityType: "CITY",
    });
    const updated = await client.updateVisualEntity("admin-token", created.id, {
      immutableTraits: [
        { id: "t1", text: "escavada na montanha", source: "AUTHORED", originAssetId: null, createdAt: "" },
      ],
    });
    expect(updated.immutableTraits[0].text).toBe("escavada na montanha");
  });

  it("links an entity to a wiki entry", async () => {
    const client = new MockApiClient();
    const created = await client.createVisualEntity("admin-token", {
      canonicalName: "Mapa Oficial",
      entityType: "MAP",
    });
    expect(created.wikiEntryId).toBeNull();
    const linked = await client.updateVisualEntity("admin-token", created.id, { wikiEntryId: "w1" });
    expect(linked.wikiEntryId).toBe("w1");
  });

  it("reports coverage totals", async () => {
    const client = new MockApiClient();
    const coverage = await client.getVisualCoverage();
    expect(typeof coverage.totalEntries).toBe("number");
    expect(typeof coverage.coveredEntries).toBe("number");
    expect(Array.isArray(coverage.sections)).toBe(true);
    expect(Array.isArray(coverage.unlinkedEntities)).toBe(true);
  });
});

describe("mock canon submissions", () => {
  it("previews, submits, lists and approves", async () => {
    const client = new MockApiClient();
    const { playerToken } = await client.createAccountAndHouse(houseInput);
    const { adminToken } = await client.adminLogin("admin-test");

    const preview = await client.playerCanonPreview(playerToken, "Quero criar Sera, batedora de Vargen.");
    expect(preview.proposal.title.length).toBeGreaterThan(0);
    expect(preview.review?.verdict).toBe("OK");

    const submitted = await client.playerCanonSubmit(playerToken, {
      rawText: "Quero criar Sera, batedora de Vargen.",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: preview.proposal,
      review: preview.review,
    });
    expect(submitted.status).toBe("PENDING_GM");

    expect((await client.playerCanonList(playerToken)).map((s) => s.id)).toContain(submitted.id);
    expect((await client.adminCanonList(adminToken)).map((s) => s.id)).toContain(submitted.id);

    const approved = await client.adminCanonApprove(adminToken, { submissionId: submitted.id, proposal: preview.proposal });
    expect(approved.status).toBe("APPROVED");
    expect(approved.wikiEntryId).not.toBeNull();

    const wiki = await client.getWiki();
    expect(wiki.some((e) => e.title === preview.proposal.title)).toBe(true);
  });

  it("duas aprovações geram wikiEntryIds distintos", async () => {
    const client = new MockApiClient();
    const { playerToken } = await client.createAccountAndHouse(houseInput);
    const { adminToken } = await client.adminLogin("admin-test");

    const preview1 = await client.playerCanonPreview(playerToken, "Primeira entrada canônica.");
    const sub1 = await client.playerCanonSubmit(playerToken, {
      rawText: "Primeira entrada canônica.", rawImageUrl: null, rawImageKey: null, proposal: preview1.proposal, review: preview1.review,
    });

    const preview2 = await client.playerCanonPreview(playerToken, "Segunda entrada canônica.");
    const sub2 = await client.playerCanonSubmit(playerToken, {
      rawText: "Segunda entrada canônica.", rawImageUrl: null, rawImageKey: null, proposal: preview2.proposal, review: preview2.review,
    });

    const approved1 = await client.adminCanonApprove(adminToken, { submissionId: sub1.id });
    const approved2 = await client.adminCanonApprove(adminToken, { submissionId: sub2.id });

    expect(approved1.wikiEntryId).not.toBeNull();
    expect(approved2.wikiEntryId).not.toBeNull();
    expect(approved1.wikiEntryId).not.toBe(approved2.wikiEntryId);
  });

  it("rejeita com nota", async () => {
    const client = new MockApiClient();
    const { playerToken } = await client.createAccountAndHouse(houseInput);
    const { adminToken } = await client.adminLogin("admin-test");
    const preview = await client.playerCanonPreview(playerToken, "Uma torre nova.");
    const submitted = await client.playerCanonSubmit(playerToken, {
      rawText: "Uma torre nova.", rawImageUrl: null, rawImageKey: null, proposal: preview.proposal, review: preview.review,
    });
    const rejected = await client.adminCanonReject(adminToken, { submissionId: submitted.id, note: "Conflita." });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.gmNote).toBe("Conflita.");
  });
});

