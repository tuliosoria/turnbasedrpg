import { describe, it, expect, beforeEach, vi } from "vitest";
import type { House, Turn } from "@ravenloft/content";
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, resetCampaign, generateTurnImage, deleteTurnImage } from "./adminRoutes";
import { hashCode } from "../auth/codes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";
import * as turnsDb from "../db/turns";
import * as housesDb from "../db/houses";
import * as submissionsDb from "../db/submissions";
import * as worldBibleDb from "../db/worldBible";

vi.mock("../db/campaignReset", () => ({
  resetCampaign: vi.fn(),
}));
import * as campaignResetDb from "../db/campaignReset";

vi.mock("../db/turns", () => ({
  getActiveTurn: vi.fn(),
  listTurns: vi.fn(),
  putTurn: vi.fn(),
  setTurnStatus: vi.fn(),
  saveTurnResult: vi.fn(),
  createNextTurnDraft: vi.fn(),
  setTurnImage: vi.fn(),
}));

vi.mock("../db/houses", () => ({
  createAccountAndHouse: vi.fn(),
  getHouse: vi.fn(),
  listHouses: vi.fn(),
  updateHouseAttributes: vi.fn(),
  updateHouseFull: vi.fn(),
  deleteHouseCascade: vi.fn(),
}));

vi.mock("../db/submissions", () => ({
  listSubmissions: vi.fn(),
}));

vi.mock("../db/worldBible", () => ({
  getWorldBible: vi.fn(),
  putWorldBible: vi.fn(),
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
  imagesBucket: "",
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
  vi.mocked(turnsDb.listTurns).mockResolvedValue([draftTurn]);
  vi.mocked(turnsDb.createNextTurnDraft).mockResolvedValue({ ...draftTurn, turnId: 2 });
  vi.mocked(housesDb.getHouse).mockResolvedValue(house);
  vi.mocked(housesDb.listHouses).mockResolvedValue([house]);
  vi.mocked(submissionsDb.listSubmissions).mockResolvedValue([]);
  vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue(null);
  vi.mocked(worldBibleDb.putWorldBible).mockResolvedValue({ lore: "", visualDirectives: "", updatedAt: "2026-01-01T00:00:00.000Z" });
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
  it("opens a draft turn that has a composed public event", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, publicEvent: "A neve bloqueia as estradas." });

    const res = await openTurn(deps, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.setTurnStatus).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1, "OPEN");
  });

  it("rejects opening a draft turn with an empty public event", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, publicEvent: "   " });

    await expect(openTurn(deps, authReq({ method: "POST" }))).rejects.toMatchObject({ status: 409, code: "EMPTY_EVENT" });
    expect(turnsDb.setTurnStatus).not.toHaveBeenCalled();
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

describe("house CRUD", () => {
  const houseBody = {
    displayName: "Jogador",
    name: "Casa Nova", motto: "Lema",
    emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
    leaderName: "L", heirName: "H", castleName: "C",
    townsText: "T", historyText: "Hi", specialty: "S", weakness: "W",
    attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 },
  };

  it("createHouse creates the house and returns a generated player code", async () => {
    vi.mocked(housesDb.createAccountAndHouse).mockResolvedValue({ houseId: "casa-nova-ab12" });

    const res = await createHouse(deps, authReq({ method: "POST", body: houseBody }));

    expect(res.status).toBe(200);
    expect((res.body as { houseId: string }).houseId).toBe("casa-nova-ab12");
    expect((res.body as { playerCode: string }).playerCode).toMatch(/^casa-nova-[A-Z0-9]{4}$/);
    expect(housesDb.createAccountAndHouse).toHaveBeenCalledTimes(1);
  });

  it("createHouse requires an admin token", async () => {
    await expect(createHouse(deps, authReq({ method: "POST", headers: {}, body: houseBody }))).rejects.toMatchObject({ status: 401 });
  });

  it("createHouse rejects out-of-range attributes", async () => {
    await expect(
      createHouse(deps, authReq({ method: "POST", body: { ...houseBody, attributes: { riqueza: 6, recursos: 0, soldados: 0, controle: 0 } } })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updateHouse updates all fields and returns 204", async () => {
    const { displayName, ...fields } = houseBody;
    void displayName;
    const res = await updateHouse(deps, authReq({ method: "POST", body: { houseId: "casa-vargen", ...fields } }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(housesDb.updateHouseFull).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "casa-vargen", expect.objectContaining({ name: "Casa Nova" }));
  });

  it("updateHouse requires an admin token", async () => {
    await expect(updateHouse(deps, authReq({ method: "POST", headers: {}, body: {} }))).rejects.toMatchObject({ status: 401 });
  });

  it("deleteHouse deletes and returns the deleted count", async () => {
    vi.mocked(housesDb.deleteHouseCascade).mockResolvedValue({ deleted: 3 });

    const res = await deleteHouse(deps, authReq({ method: "POST", body: { houseId: "casa-vargen" } }));

    expect(res).toEqual({ status: 200, body: { deleted: 3 } });
    expect(housesDb.deleteHouseCascade).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "casa-vargen");
  });

  it("deleteHouse requires an admin token", async () => {
    await expect(deleteHouse(deps, authReq({ method: "POST", headers: {}, body: { houseId: "x" } }))).rejects.toMatchObject({ status: 401 });
  });
});

describe("resetCampaign", () => {
  it("wipes the campaign and returns the deleted count", async () => {
    (campaignResetDb.resetCampaign as ReturnType<typeof vi.fn>).mockResolvedValue({ deleted: 5 });

    const res = await resetCampaign(deps, authReq({ method: "POST", body: undefined }));

    expect(res).toEqual({ status: 200, body: { deleted: 5 } });
    expect(campaignResetDb.resetCampaign).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead");
  });

  it("requires an admin token", async () => {
    await expect(resetCampaign(deps, authReq({ method: "POST", headers: {}, body: undefined }))).rejects.toMatchObject({ status: 401 });
  });
});

describe("draftPrivateInfo", () => {
  it("returns generated private info without persisting it", async () => {
    const chat = vi.fn(async () => JSON.stringify({ "casa-vargen": "Corvos pousam sobre Droskar." }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 2, publicEvent: "A noite não termina." });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      { ...draftTurn, turnId: 1, status: "RESOLVED", result: { publicResult: "O gelo venceu a ponte.", houseResults: {}, attributeDeltas: {}, discoveries: [] } },
      { ...draftTurn, turnId: 2, publicEvent: "A noite não termina." },
    ]);

    const res = await draftPrivateInfo({ ...deps, chat }, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 200, body: { privateInfo: { "casa-vargen": "Corvos pousam sobre Droskar." } } });
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("Turno 1: O gelo venceu a ponte."), expect.stringContaining("A noite não termina."), true);
    expect(turnsDb.putTurn).not.toHaveBeenCalled();
  });

  it("returns AI_DISABLED when chat is not configured", async () => {
    await expect(draftPrivateInfo(deps, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 503,
      code: "AI_DISABLED",
    });
  });
});

describe("draftResolution", () => {
  it("returns a parsed AI resolution draft for a locked turn", async () => {
    const chat = vi.fn(async () => JSON.stringify({
      publicResult: "As muralhas resistem.",
      houseResults: { "casa-vargen": "A guarda segura o portão." },
      attributeDeltas: { "casa-vargen": { soldados: -1 } },
      discoveries: ["A neve sussurra nomes."],
    }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, status: "LOCKED" });
    vi.mocked(submissionsDb.listSubmissions).mockResolvedValue([
      { houseId: "casa-vargen", orderText: "Guarnecer o portão.", cardResponses: [], submittedAt: "2026-01-03T00:00:00.000Z" },
    ]);

    const res = await draftResolution({ ...deps, chat }, authReq({ method: "POST" }));

    expect(res).toEqual({
      status: 200,
      body: {
        publicResult: "As muralhas resistem.",
        houseResults: { "casa-vargen": "A guarda segura o portão." },
        attributeDeltas: { "casa-vargen": { soldados: -1 } },
        discoveries: ["A neve sussurra nomes."],
      },
    });
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("JSON"), expect.stringContaining("Guarnecer o portão."), true);
  });

  it("requires a locked turn", async () => {
    const chat = vi.fn(async () => "{}");

    await expect(draftResolution({ ...deps, chat }, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 409,
      code: "BAD_STATUS",
    });
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("applyResolution", () => {
  it("clamps attribute deltas and advances to the next draft turn", async () => {
    const lowHouse: House = {
      ...house,
      houseId: "casa-baixa",
      attributes: { riqueza: 0, recursos: 1, soldados: 2, controle: 0 },
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 2, status: "LOCKED" });
    vi.mocked(housesDb.getHouse).mockImplementation(async (_doc, _tableName, _campaignId, houseId) => (houseId === "casa-baixa" ? lowHouse : house));
    vi.mocked(turnsDb.createNextTurnDraft).mockResolvedValue({ ...draftTurn, turnId: 3 });
    const body = {
      publicResult: "O cerco termina em silêncio.",
      houseResults: { "casa-vargen": "A Casa Vargen preserva a muralha." },
      attributeDeltas: {
        "casa-vargen": { soldados: 1, recursos: -2 },
        "casa-baixa": { riqueza: -2, controle: 1 },
      },
      discoveries: ["Um sino toca sob a neve."],
    };

    const res = await applyResolution(deps, authReq({ method: "POST", body }));

    expect(res).toEqual({ status: 200, body: { nextTurnId: 3 } });
    expect(housesDb.updateHouseAttributes).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "casa-vargen", {
      riqueza: 1,
      recursos: 0,
      soldados: 5,
      controle: 2,
    });
    expect(housesDb.updateHouseAttributes).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "casa-baixa", {
      riqueza: 0,
      recursos: 1,
      soldados: 2,
      controle: 1,
    });
    expect(turnsDb.saveTurnResult).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 2, body);
    expect(turnsDb.createNextTurnDraft).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 3);
  });
});

describe("world bible routes", () => {
  it("getWorldBible returns empty defaults when the item is missing", async () => {
    vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue(null);
    const res = await getWorldBible(deps, authReq());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lore: "", visualDirectives: "", updatedAt: "" });
  });

  it("getWorldBible returns the stored World Bible", async () => {
    vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue({ lore: "Valdren", visualDirectives: "Dark fantasy", updatedAt: "2026-05-05T00:00:00.000Z" });
    const res = await getWorldBible(deps, authReq());
    expect(res.body).toEqual({ lore: "Valdren", visualDirectives: "Dark fantasy", updatedAt: "2026-05-05T00:00:00.000Z" });
  });

  it("getWorldBible requires an admin token", async () => {
    await expect(getWorldBible(deps, authReq({ headers: {} }))).rejects.toMatchObject({ status: 401 });
  });

  it("putWorldBible validates and saves", async () => {
    const res = await putWorldBible(deps, authReq({ method: "PUT", body: { lore: "Nova lore", visualDirectives: "Novas diretrizes" } }));
    expect(res.status).toBe(204);
    expect(worldBibleDb.putWorldBible).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", { lore: "Nova lore", visualDirectives: "Novas diretrizes" });
  });

  it("putWorldBible requires an admin token", async () => {
    await expect(putWorldBible(deps, authReq({ method: "PUT", headers: {}, body: {} }))).rejects.toMatchObject({ status: 401 });
  });
});

describe("draftResolution world context", () => {
  it("passes lore and chronicle from resolved history into the prompt", async () => {
    const chat = vi.fn().mockResolvedValue('{"publicResult":"ok","houseResults":{},"attributeDeltas":{},"discoveries":[]}');
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 3, status: "LOCKED" });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      { ...draftTurn, turnId: 1, status: "RESOLVED", result: { publicResult: "A ponte caiu.", houseResults: {}, attributeDeltas: {}, discoveries: [] } },
      { ...composedTurn, turnId: 3, status: "LOCKED" },
    ]);
    vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue({ lore: "Valdren cercada pelas Brumas.", visualDirectives: "Dark fantasy", updatedAt: "x" });
    await draftResolution({ ...deps, chat }, authReq({ method: "POST" }));
    const system = chat.mock.calls[0][0] as string;
    expect(system).toContain("Valdren cercada pelas Brumas.");
    expect(system).toContain("Turno 1: A ponte caiu.");
    expect(system).not.toContain("Dark fantasy");
  });
});

describe("turn images", () => {
  it("generates an image, uploads it and saves the url on the turn", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const image = vi.fn().mockResolvedValue(Buffer.from("png-bytes"));
    const imageStore = { uploadTurnImage: vi.fn().mockResolvedValue("https://bucket/turns/004/event.png?v=1") };
    const res = await generateTurnImage(
      { ...deps, image, imageStore },
      authReq({ method: "POST", body: { kind: "event", prompt: "Dark fantasy bridge in snow." } }),
    );
    expect(image).toHaveBeenCalledWith("Dark fantasy bridge in snow.");
    expect(imageStore.uploadTurnImage).toHaveBeenCalledWith("event", 4, expect.any(Buffer));
    expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "event", "https://bucket/turns/004/event.png?v=1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageUrl: "https://bucket/turns/004/event.png?v=1" });
  });

  it("returns IMAGE_DISABLED when generation is not configured", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    await expect(
      generateTurnImage(deps, authReq({ method: "POST", body: { kind: "event", prompt: "x" } })),
    ).rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
  });

  it("rejects an unknown image kind", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const image = vi.fn();
    const imageStore = { uploadTurnImage: vi.fn() };
    await expect(
      generateTurnImage({ ...deps, image, imageStore }, authReq({ method: "POST", body: { kind: "banner", prompt: "x" } })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("clears an image url on delete", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const res = await deleteTurnImage(deps, authReq({ method: "POST", body: { kind: "result" } }));
    expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "result", "");
    expect(res.status).toBe(204);
  });

  it("requires admin", async () => {
    await expect(
      generateTurnImage(deps, authReq({ method: "POST", headers: {}, body: { kind: "event", prompt: "x" } })),
    ).rejects.toMatchObject({ status: 401 });
  });
});
