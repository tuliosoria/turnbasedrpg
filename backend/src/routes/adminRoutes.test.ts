import { describe, it, expect, beforeEach, vi } from "vitest";
import type { House, Turn } from "@ravenloft/content";
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPublicEvent, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, resetCampaign, generateTurnImage, uploadTurnImage, deleteTurnImage, listWiki, createWikiEntry, updateWikiEntry, removeWikiEntry, seedWiki, listGm, createGmEntry, updateGmEntry, removeGmEntry, seedGm, adminApproveProject, aiStatus } from "./adminRoutes";
import { hashCode } from "../auth/codes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";
import { HttpError } from "../types/domain";
import type { ChatFn } from "../ai/openai";
import * as turnsDb from "../db/turns";
import * as housesDb from "../db/houses";
import * as projectsDb from "../db/projects";
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
  updateHouseStabilityAndAssets: vi.fn(),
}));

vi.mock("../db/projects", () => ({
  listCampaignProjects: vi.fn(async () => []),
  putProject: vi.fn(),
  putFavor: vi.fn(),
}));

vi.mock("../db/submissions", () => ({
  listSubmissions: vi.fn(),
}));

vi.mock("../db/worldBible", () => ({
  getWorldBible: vi.fn(),
  putWorldBible: vi.fn(),
}));

vi.mock("../db/wiki", () => ({
  listWikiEntries: vi.fn(),
  putWikiEntry: vi.fn(),
  deleteWikiEntry: vi.fn(),
  generateWikiId: vi.fn(() => "genid00001"),
  seedDefaultWiki: vi.fn(),
}));
import * as wikiDb from "../db/wiki";

vi.mock("../db/gm", () => ({
  listGmEntries: vi.fn(),
  putGmEntry: vi.fn(),
  deleteGmEntry: vi.fn(),
  generateGmId: vi.fn(() => "gmid000001"),
  seedDefaultGm: vi.fn(),
}));
import * as gmDb from "../db/gm";

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
  visualWorkerFunctionName: "",
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

function multipartBody(fields: Record<string, string>, file: { name: string; contentType: string; body: Buffer }, boundary = "----turn-upload-test") {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.name}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
  chunks.push(file.body);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    rawBody: Buffer.concat(chunks),
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
}

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
const draftTurn: Turn = { turnId: 1, status: "DRAFT", publicEvent: "", privateInfo: {}, createdAt: "2026-01-02T00:00:00.000Z" };
const composedTurn: Turn = {
  ...draftTurn,
  status: "OPEN",
  publicEvent: "A neve bloqueia as estradas.",
  privateInfo: { "casa-vargen": "Rastros nas Brumas." },
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
  vi.mocked(wikiDb.listWikiEntries).mockResolvedValue([]);
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
    vi.mocked(submissionsDb.listSubmissions).mockResolvedValue([{ houseId: "casa-vargen", orderText: "Ordem", submittedAt: "2026-01-03T00:00:00.000Z" }]);

    const res = await getDashboard(deps, authReq());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      turnId: 1,
      turnStatus: "OPEN",
      publicEvent: "A neve bloqueia as estradas.",
      privateInfo: { "casa-vargen": "Rastros nas Brumas." },
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
    const body = { publicEvent: "Evento", privateInfo: { "casa-vargen": "Segredo" } };

    const res = await composeTurn(deps, authReq({ method: "POST", body }));

    expect(res).toEqual({ status: 204, body: undefined });
    expect(turnsDb.putTurn).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", { ...draftTurn, ...body });
  });

  it("rejects when the active turn is not a draft", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "OPEN" });

    await expect(composeTurn(deps, authReq({ method: "POST", body: { publicEvent: "", privateInfo: {} } }))).rejects.toMatchObject({ status: 409, code: "BAD_STATUS" });
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

describe("draftPublicEvent", () => {
  it("returns a generated public event without persisting it", async () => {
    const chat = vi.fn(async () => JSON.stringify({ publicEvent: "As Brumas avançam sobre o vale ao amanhecer." }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 2, publicEvent: "" });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      { ...draftTurn, turnId: 1, status: "RESOLVED", result: { publicResult: "O gelo venceu a ponte.", houseResults: {}, attributeDeltas: {}, discoveries: [] } },
      { ...draftTurn, turnId: 2, publicEvent: "" },
    ]);

    const res = await draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 200, body: { publicEvent: "As Brumas avançam sobre o vale ao amanhecer." } });
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("Resultado público: O gelo venceu a ponte."), expect.any(String), true, undefined);
    expect(turnsDb.putTurn).not.toHaveBeenCalled();
  });

  it("rejects a generated public event that leaks recent private context verbatim", async () => {
    const leakedPrivateInfo = "Batedores viram luzes azuis na ponte.";
    const chat = vi.fn(async () => JSON.stringify({ publicEvent: `Ao amanhecer, ${leakedPrivateInfo}` }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 2, publicEvent: "" });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      {
        ...draftTurn,
        turnId: 1,
        status: "RESOLVED",
        privateInfo: { "casa-vargen": leakedPrivateInfo },
        result: { publicResult: "A ponte brilhou.", houseResults: {}, attributeDeltas: {}, discoveries: [] },
      },
      { ...draftTurn, turnId: 2, publicEvent: "" },
    ]);

    await expect(draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 502,
      code: "AI_LEAKED_PRIVATE_CONTEXT",
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(turnsDb.putTurn).not.toHaveBeenCalled();
  });

  it("rejects a generated public event that leaks a truncated private context prefix", async () => {
    const longPrivateInfo = "A sentinela viu a coroa enterrada sob o gelo antigo ".repeat(80);
    const exposedPrefix = longPrivateInfo.slice(0, 240).trim();
    const chat = vi.fn(async () => JSON.stringify({ publicEvent: `Nas tavernas, dizem: ${exposedPrefix}` }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 2, publicEvent: "" });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      {
        ...draftTurn,
        turnId: 1,
        status: "RESOLVED",
        privateInfo: { "casa-vargen": longPrivateInfo },
        result: { publicResult: "A ponte brilhou.", houseResults: {}, attributeDeltas: {}, discoveries: [] },
      },
      { ...draftTurn, turnId: 2, publicEvent: "" },
    ]);

    await expect(draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 502,
      code: "AI_LEAKED_PRIVATE_CONTEXT",
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(turnsDb.putTurn).not.toHaveBeenCalled();
  });

  it("passes world lore, player Houses, Wiki and the last 5 resolved turns with submissions into the prompt", async () => {
    const chat = vi.fn<ChatFn>(async (_system: string, _user: string, _jsonMode: boolean) =>
      JSON.stringify({ publicEvent: "Sinos tocam ao sul de Solythar." }),
    );
    vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue({
      lore: "Valdren é uma ilha cercada pelas Brumas.",
      visualDirectives: "Dark fantasy",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(wikiDb.listWikiEntries).mockResolvedValue([
      {
        entryId: "w1",
        section: "casas",
        title: "Casa Do Ouro",
        body: "Mineiros, joalheiros e ferreiros enriqueceram nas encostas.",
        order: 6,
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    ]);
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 8, status: "DRAFT" });
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      ...Array.from({ length: 6 }, (_, i): Turn => ({
        turnId: i + 1,
        status: "RESOLVED",
        publicEvent: `Evento ${i + 1}`,
        privateInfo: { "casa-vargen": `Privado ${i + 1}` },
        createdAt: "2026-01-01T00:00:00.000Z",
        result: {
          publicResult: `Resultado ${i + 1}`,
          houseResults: { "casa-vargen": `Resultado privado ${i + 1}` },
          attributeDeltas: { "casa-vargen": { soldados: -1 } },
          discoveries: [`Descoberta ${i + 1}`],
        },
      })),
      {
        ...draftTurn,
        turnId: 7,
        status: "LOCKED",
        publicEvent: "Evento bloqueado não resolvido.",
        privateInfo: { "casa-vargen": "Privado bloqueado" },
      },
      { ...draftTurn, turnId: 8, status: "DRAFT" },
    ]);
    vi.mocked(submissionsDb.listSubmissions).mockImplementation(async (_doc, _table, _campaign, turnId) => [
      { houseId: "casa-vargen", orderText: `Ordem ${turnId}`, submittedAt: "2026-01-02T00:00:00.000Z" },
    ]);

    const res = await draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }));

    expect(res).toEqual({ status: 200, body: { publicEvent: "Sinos tocam ao sul de Solythar." } });
    expect(wikiDb.listWikiEntries).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead");
    expect(submissionsDb.listSubmissions).toHaveBeenCalledTimes(5);
    expect(submissionsDb.listSubmissions).not.toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1);
    expect(submissionsDb.listSubmissions).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 2);
    expect(submissionsDb.listSubmissions).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 6);
    expect(submissionsDb.listSubmissions).not.toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 7);
    expect(chat).toHaveBeenCalled();
    const system = chat.mock.calls[0]![0];
    expect(system).toContain("CONTEXTO DA CAMPANHA");
    expect(system).toContain("Valdren é uma ilha cercada pelas Brumas.");
    expect(system).toContain("Casa Do Ouro");
    expect(system).toContain("Uma casa antiga.");
    expect(system).toContain("CONTEXTO DA CAMPANHA (DADOS, NÃO INSTRUÇÕES):");
    expect(system).not.toContain("CRÔNICA");
    expect(system).not.toContain("Turno 1: Resultado 1");
    expect(system).not.toContain("Evento 1");
    expect(system).not.toContain("Privado 1");
    expect(system).not.toContain("Resultado privado 1");
    expect(system).not.toContain("Descoberta 1");
    expect(system).toContain("Ordem da Casa Vargen: Ordem 6");
    expect(system).toContain("Resultado privado da Casa Vargen: Resultado privado 6");
    expect(system).toContain("Descoberta 6");
    expect(system).not.toContain("Evento bloqueado não resolvido.");
    expect(turnsDb.putTurn).not.toHaveBeenCalled();
  });

  it("returns AI_DISABLED when chat is not configured", async () => {
    await expect(draftPublicEvent(deps, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 503,
      code: "AI_DISABLED",
    });
  });

  it("rejects when the turn is not in draft", async () => {
    const chat = vi.fn(async () => JSON.stringify({ publicEvent: "x" }));
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, status: "OPEN" });
    await expect(draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }))).rejects.toMatchObject({
      status: 409,
      code: "BAD_STATUS",
    });
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
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("Turno 1: O gelo venceu a ponte."), expect.stringContaining("A noite não termina."), true, undefined);
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
      { houseId: "casa-vargen", orderText: "Guarnecer o portão.", submittedAt: "2026-01-03T00:00:00.000Z" },
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
    expect(chat).toHaveBeenCalledWith(expect.stringContaining("JSON"), expect.stringContaining("Guarnecer o portão."), true, undefined);
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
  it("composes the prompt from the world directives and scene, uploads it and saves the url", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue({ lore: "", visualDirectives: "ESTILO: dark fantasy gótico.", updatedAt: "x" });
    const image = vi.fn().mockResolvedValue(Buffer.from("png-bytes"));
    const imageStore = { uploadTurnImage: vi.fn().mockResolvedValue("https://bucket/turns/004/event.png?v=1"), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    const res = await generateTurnImage(
      { ...deps, image, imageStore },
      authReq({ method: "POST", body: { kind: "event", sceneDescription: "Ponte coberta de neve." } }),
    );
    const promptArg = image.mock.calls[0][0] as string;
    expect(promptArg).toContain("ESTILO: dark fantasy gótico.");
    expect(promptArg).toContain("Ponte coberta de neve.");
    expect(imageStore.uploadTurnImage).toHaveBeenCalledWith("event", 4, expect.any(Buffer));
    expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "event", "https://bucket/turns/004/event.png?v=1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageUrl: "https://bucket/turns/004/event.png?v=1" });
  });

  it("falls back to the turn text when no scene description is given", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const image = vi.fn().mockResolvedValue(Buffer.from("png-bytes"));
    const imageStore = { uploadTurnImage: vi.fn().mockResolvedValue("https://bucket/turns/004/event.png?v=1"), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    await generateTurnImage(
      { ...deps, image, imageStore },
      authReq({ method: "POST", body: { kind: "event" } }),
    );
    const promptArg = image.mock.calls[0][0] as string;
    expect(promptArg).toContain("A neve bloqueia as estradas.");
  });

  it("returns IMAGE_DISABLED when generation is not configured", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    await expect(
      generateTurnImage(deps, authReq({ method: "POST", body: { kind: "event" } })),
    ).rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
  });

  it("rejects an unknown image kind", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const image = vi.fn();
    const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    await expect(
      generateTurnImage({ ...deps, image, imageStore }, authReq({ method: "POST", body: { kind: "banner" } })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("uploads a manual event image and saves its url", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const imageStore = {
      uploadTurnImage: vi.fn().mockResolvedValue("https://bucket/turns/004/event.jpg?v=1"),
      uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn(),
    };
    const res = await uploadTurnImage(
      { ...deps, imageStore },
      authReq({
        method: "POST",
        body: undefined,
        ...multipartBody({ kind: "event" }, { name: "ponte.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg-bytes") }),
      }),
    );

    expect(imageStore.uploadTurnImage).toHaveBeenCalledWith("event", 4, Buffer.from("jpeg-bytes"), "image/jpeg");
    expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "event", "https://bucket/turns/004/event.jpg?v=1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageUrl: "https://bucket/turns/004/event.jpg?v=1" });
  });

  it("rejects manual upload when image storage is not configured", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    await expect(
      uploadTurnImage(
        deps,
        authReq({
          method: "POST",
          body: undefined,
          ...multipartBody({ kind: "event" }, { name: "ponte.png", contentType: "image/png", body: Buffer.from("png") }),
        }),
      ),
    ).rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
  });

  it("rejects unsupported manual upload file types", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    await expect(
      uploadTurnImage(
        { ...deps, imageStore },
        authReq({
          method: "POST",
          body: undefined,
          ...multipartBody({ kind: "event" }, { name: "ponte.gif", contentType: "image/gif", body: Buffer.from("gif") }),
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
  });

  it("rejects oversized manual upload images", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    await expect(
      uploadTurnImage(
        { ...deps, imageStore },
        authReq({
          method: "POST",
          body: undefined,
          ...multipartBody({ kind: "result" }, { name: "grande.webp", contentType: "image/webp", body: Buffer.alloc(10 * 1024 * 1024 + 1) }),
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
  });

  it("requires admin for manual upload", async () => {
    const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn() };
    await expect(
      uploadTurnImage(
        { ...deps, imageStore },
        authReq({
          method: "POST",
          body: undefined,
          ...multipartBody({ kind: "event" }, { name: "ponte.png", contentType: "image/png", body: Buffer.from("png") }),
          headers: { "content-type": "multipart/form-data; boundary=----turn-upload-test" },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("clears an image url on delete", async () => {
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
    const res = await deleteTurnImage(deps, authReq({ method: "POST", body: { kind: "result" } }));
    expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "result", "");
    expect(res.status).toBe(204);
  });

  it("requires admin", async () => {
    await expect(
      generateTurnImage(deps, authReq({ method: "POST", headers: {}, body: { kind: "event" } })),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("adminRoutes wiki", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists wiki entries", async () => {
    vi.mocked(wikiDb.listWikiEntries).mockResolvedValue([
      { entryId: "a", section: "casas", title: "Casa X", body: "b", order: 0, updatedAt: "t" },
    ]);
    const res = await listWiki(deps, authReq({ path: "/api/admin/wiki" }));
    expect(res.status).toBe(200);
    expect((res.body as any).entries).toHaveLength(1);
  });

  it("creates a wiki entry with a generated id and updatedAt", async () => {
    const res = await createWikiEntry(
      deps,
      authReq({ method: "POST", body: { section: "casas", title: "Casa Vargen", body: "lobos", order: 2 } }),
    );
    expect(res.status).toBe(200);
    const entry = (res.body as any).entry;
    expect(entry.entryId).toBe("genid00001");
    expect(entry.section).toBe("casas");
    expect(entry.order).toBe(2);
    expect(entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(wikiDb.putWikiEntry).toHaveBeenCalled();
  });

  it("rejects an unknown section", async () => {
    await expect(
      createWikiEntry(deps, authReq({ method: "POST", body: { section: "invalida", title: "X" } })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates a wiki entry preserving its id", async () => {
    const res = await updateWikiEntry(
      deps,
      authReq({ method: "POST", body: { entryId: "abc", section: "brumas", title: "As Brumas", body: "névoa", order: 1 } }),
    );
    expect(res.status).toBe(200);
    expect((res.body as any).entry.entryId).toBe("abc");
    expect(wikiDb.putWikiEntry).toHaveBeenCalled();
  });

  it("deletes a wiki entry", async () => {
    const res = await removeWikiEntry(deps, authReq({ method: "POST", body: { entryId: "abc" } }));
    expect(res.status).toBe(204);
    expect(wikiDb.deleteWikiEntry).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "abc");
  });

  it("requires admin to create", async () => {
    await expect(
      createWikiEntry(deps, authReq({ method: "POST", headers: {}, body: { section: "casas", title: "X" } })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("seeds the default cosmology", async () => {
    vi.mocked(wikiDb.seedDefaultWiki).mockResolvedValue({ seeded: 18 });
    const res = await seedWiki(deps, authReq({ method: "POST" }));
    expect(res.status).toBe(200);
    expect((res.body as any).seeded).toBe(18);
    expect(wikiDb.seedDefaultWiki).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead");
  });

  it("requires admin to seed", async () => {
    await expect(seedWiki(deps, authReq({ method: "POST", headers: {} }))).rejects.toMatchObject({ status: 401 });
  });
});

describe("GM bible routes", () => {
  it("lists GM entries for admin", async () => {
    vi.mocked(gmDb.listGmEntries).mockResolvedValue([]);
    const res = await listGm(deps, authReq());
    expect(res.status).toBe(200);
    expect((res.body as any).entries).toEqual([]);
    expect(gmDb.listGmEntries).toHaveBeenCalled();
  });

  it("creates a GM entry with a generated id", async () => {
    const res = await createGmEntry(
      deps,
      authReq({ method: "POST", body: { section: "a-verdade", title: "A verdade", body: "Othmar", order: 0 } }),
    );
    expect(res.status).toBe(200);
    expect((res.body as any).entry.entryId).toBe("gmid000001");
    expect(gmDb.putGmEntry).toHaveBeenCalled();
  });

  it("rejects an unknown GM section", async () => {
    await expect(
      createGmEntry(deps, authReq({ method: "POST", body: { section: "invalida", title: "X" } })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates a GM entry preserving its id", async () => {
    const res = await updateGmEntry(
      deps,
      authReq({ method: "POST", body: { entryId: "abc", section: "ancoras", title: "Coroa", body: "x", order: 1 } }),
    );
    expect(res.status).toBe(200);
    expect((res.body as any).entry.entryId).toBe("abc");
    expect(gmDb.putGmEntry).toHaveBeenCalled();
  });

  it("deletes a GM entry", async () => {
    const res = await removeGmEntry(deps, authReq({ method: "POST", body: { entryId: "abc" } }));
    expect(res.status).toBe(204);
    expect(gmDb.deleteGmEntry).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", "abc");
  });

  it("seeds the default GM lore", async () => {
    vi.mocked(gmDb.seedDefaultGm).mockResolvedValue({ seeded: 20 });
    const res = await seedGm(deps, authReq({ method: "POST" }));
    expect(res.status).toBe(200);
    expect((res.body as any).seeded).toBe(20);
    expect(gmDb.seedDefaultGm).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead");
  });

  it("requires admin for every GM route", async () => {
    await expect(listGm(deps, authReq({ headers: {} }))).rejects.toMatchObject({ status: 401 });
    await expect(seedGm(deps, authReq({ method: "POST", headers: {} }))).rejects.toMatchObject({ status: 401 });
    await expect(
      createGmEntry(deps, authReq({ method: "POST", headers: {}, body: { section: "a-verdade", title: "X" } })),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("adminApproveProject", () => {
  it("rejects approving a project the house cannot afford", async () => {
    const poorHouse = { ...house, attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 0 }, stability: 0 };
    vi.mocked(housesDb.getHouse).mockResolvedValue(poorHouse);
    vi.mocked(projectsDb.listCampaignProjects).mockResolvedValue([
      { id: "p1", houseId: "casa-vargen", status: "PENDING_GM", costs: [{ type: "WEALTH", amount: 2, timing: "ON_START" }] } as any,
    ]);
    await expect(
      adminApproveProject(deps, authReq({ method: "POST", body: { projectId: "p1" } })),
    ).rejects.toMatchObject({ status: 409 });
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("rejects approving a project that is not pending", async () => {
    vi.mocked(projectsDb.listCampaignProjects).mockResolvedValue([
      { id: "p1", houseId: "casa-vargen", status: "ACTIVE", costs: [] } as any,
    ]);
    await expect(
      adminApproveProject(deps, authReq({ method: "POST", body: { projectId: "p1" } })),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("aiStatus", () => {
  it("reports NOT_CONFIGURED when no chat is available", async () => {
    const res = await aiStatus({ ...deps }, authReq());
    expect(res.status).toBe(200);
    expect((res.body as any).status).toBe("NOT_CONFIGURED");
    expect((res.body as any).configured).toBe(false);
    expect((res.body as any).model).toBe("gpt-4o-mini");
  });

  it("reports OK when the ping succeeds", async () => {
    const chat: ChatFn = vi.fn(async () => "pong");
    const res = await aiStatus({ ...deps, chat }, authReq());
    expect((res.body as any).status).toBe("OK");
    expect((res.body as any).configured).toBe(true);
    expect(chat).toHaveBeenCalled();
  });

  it("reports DOWN with the mapped code when the ping fails", async () => {
    const chat: ChatFn = vi.fn(async () => { throw new HttpError(503, "AI_QUOTA", "cota excedida"); });
    const res = await aiStatus({ ...deps, chat }, authReq());
    expect((res.body as any).status).toBe("DOWN");
    expect((res.body as any).code).toBe("AI_QUOTA");
    expect((res.body as any).message).toMatch(/cota/i);
  });

  it("requires admin auth", async () => {
    await expect(aiStatus({ ...deps }, { ...authReq(), headers: {} })).rejects.toBeTruthy();
  });
});
