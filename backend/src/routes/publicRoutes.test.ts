import { describe, it, expect, beforeEach, vi } from "vitest";
import { CASA_VARGEN_EXAMPLE } from "@ravenloft/content";
import { getCampaign, getHouseExample, createAccountAndHouse, login, getGallery, generateHouseImage } from "./publicRoutes";
import { verifyToken } from "../auth/tokens";
import { hashCode } from "../auth/codes";
import type { Config } from "../types/domain";
import * as housesDb from "../db/houses";
import * as playersDb from "../db/players";
import * as turnsDb from "../db/turns";
import * as rateLimitDb from "../db/rateLimit";

vi.mock("../db/houses", () => ({
  createAccountAndHouse: vi.fn(),
  setHouseImages: vi.fn(),
}));

vi.mock("../db/rateLimit", () => ({
  hitRateLimit: vi.fn(),
}));

vi.mock("../db/players", () => ({
  getPlayerByCodeHash: vi.fn(),
}));

vi.mock("../db/turns", () => ({
  listTurns: vi.fn(),
}));

const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: "x",
  tokenSigningSecret: "secret",
  allowedOrigin: "*",
  tokenTtlSeconds: 3600,
  openAiApiKey: "",
  openAiModel: "gpt-4o-mini",
  imagesBucket: "",
};
const deps = { doc: { send: vi.fn() } as any, config };
const req = (over = {}) => ({ method: "GET", path: "/", headers: {}, body: undefined, pathParams: {}, ...over });

const createBody = {
  displayName: "Elira",
  name: "Casa Várgen!",
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
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCampaign", () => {
  it("returns the narrative campaign summary without old content fields", async () => {
    const res = await getCampaign(deps, req());

    expect(res).toEqual({
      status: 200,
      body: {
        id: "winter-dead",
        title: "O Inverno dos Mortos",
        introduction: "Valdren é um reino de Ravenloft cercado pelas Brumas. Cada jogador lidera uma Grande Casa. Suas decisões, escritas em texto livre, criam a história do reino.",
      },
    });
  });
});

describe("getHouseExample", () => {
  it("returns the Vargen example from shared content", async () => {
    const res = await getHouseExample(deps, req());

    expect(res).toEqual({ status: 200, body: CASA_VARGEN_EXAMPLE });
  });
});

describe("createAccountAndHouse", () => {
  it("creates a house with a provisional code hash and returns a player token", async () => {
    vi.mocked(housesDb.createAccountAndHouse).mockResolvedValue({ houseId: "casa-vargen-abcd" });

    const res = await createAccountAndHouse(deps, req({ method: "POST", body: createBody }));

    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.playerCode).toMatch(/^casa-vargen-[A-Z0-9]{4}$/);
    expect(body.houseId).toBe("casa-vargen-abcd");
    expect(body.displayName).toBe("Elira");
    expect(housesDb.createAccountAndHouse).toHaveBeenCalledWith(
      deps.doc,
      "ravenloft-game",
      "winter-dead",
      expect.objectContaining({ ...createBody, codeHash: hashCode(body.playerCode) }),
    );
    const payload = verifyToken(body.playerToken, config.tokenSigningSecret) as any;
    expect(payload).toMatchObject({ type: "player", campaignId: "winter-dead", houseId: "casa-vargen-abcd", displayName: "Elira" });
  });
});

describe("login", () => {
  it("returns a token for a valid code", async () => {
    const code = "casa-vargen-4K7P";
    vi.mocked(playersDb.getPlayerByCodeHash).mockResolvedValue({ houseId: "casa-vargen-abcd", displayName: "Elira", codeHash: hashCode(code) });

    const res = await login(deps, req({ method: "POST", body: { playerCode: code } }));

    expect(res.status).toBe(200);
    expect(playersDb.getPlayerByCodeHash).toHaveBeenCalledWith(deps.doc, "ravenloft-game", hashCode(code));
    expect((res.body as any).houseId).toBe("casa-vargen-abcd");
  });

  it("rejects an unknown code with INVALID_CODE", async () => {
    vi.mocked(playersDb.getPlayerByCodeHash).mockResolvedValue(null);

    await expect(login(deps, req({ method: "POST", body: { playerCode: "nope-0000" } }))).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CODE",
    });
  });
});

describe("getGallery", () => {
  const baseTurn = { privateInfo: {}, cards: [], createdAt: "2026-01-01T00:00:00.000Z" };
  it("returns only turns with at least one image, in ascending order", async () => {
    vi.mocked(turnsDb.listTurns).mockResolvedValue([
      { ...baseTurn, turnId: 1, status: "RESOLVED", publicEvent: "Evento 1", eventImageUrl: "u1", result: { publicResult: "Res 1", houseResults: {}, attributeDeltas: {}, discoveries: [] }, resultImageUrl: "r1" } as any,
      { ...baseTurn, turnId: 2, status: "OPEN", publicEvent: "Evento 2" } as any,
      { ...baseTurn, turnId: 3, status: "OPEN", publicEvent: "Evento 3", eventImageUrl: "u3" } as any,
    ]);
    const res = await getGallery(deps, req());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      entries: [
        { turnId: 1, publicEvent: "Evento 1", eventImageUrl: "u1", publicResult: "Res 1", resultImageUrl: "r1" },
        { turnId: 3, publicEvent: "Evento 3", eventImageUrl: "u3", publicResult: "", resultImageUrl: undefined },
      ],
    });
  });
});

describe("createAccountAndHouse with images", () => {
  it("uploads each image and stores the urls", async () => {
    (housesDb.createAccountAndHouse as any).mockResolvedValue({ houseId: "casa-1" });
    const uploadHouseImage = vi.fn()
      .mockResolvedValueOnce("https://cdn/houses/casa-1/0.png")
      .mockResolvedValueOnce("https://cdn/houses/casa-1/1.png");
    const depsImg = { ...deps, imageStore: { uploadHouseImage } as any, image: vi.fn() };
    const body = { ...createBody, images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"] };
    await createAccountAndHouse(depsImg as any, req({ method: "POST", path: "/api/create-account", body }) as any);
    expect(uploadHouseImage).toHaveBeenCalledTimes(2);
    expect(housesDb.setHouseImages).toHaveBeenCalledWith(
      expect.anything(), "ravenloft-game", "winter-dead", "casa-1",
      ["https://cdn/houses/casa-1/0.png", "https://cdn/houses/casa-1/1.png"],
    );
  });

  it("skips images when imageStore is absent", async () => {
    (housesDb.createAccountAndHouse as any).mockResolvedValue({ houseId: "casa-2" });
    const body = { ...createBody, images: ["data:image/png;base64,AAA"] };
    await createAccountAndHouse(deps, req({ method: "POST", path: "/api/create-account", body }) as any);
    expect(housesDb.setHouseImages).not.toHaveBeenCalled();
  });
});

describe("generateHouseImage", () => {
  const genBody = { name: "Casa Vargen", description: "Norte.", emblem: createBody.emblem };

  it("returns IMAGE_DISABLED when no image fn", async () => {
    await expect(generateHouseImage(deps, req({ method: "POST", body: genBody }) as any))
      .rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
  });

  it("returns a data url on success", async () => {
    (rateLimitDb.hitRateLimit as any).mockResolvedValue(1);
    const image = vi.fn().mockResolvedValue(Buffer.from("img"));
    const d = { ...deps, image };
    const res = await generateHouseImage(d as any, req({ method: "POST", body: genBody, sourceIp: "1.2.3.4" }) as any);
    expect(res.status).toBe(200);
    expect((res.body as any).image).toMatch(/^data:image\/png;base64,/);
  });

  it("returns RATE_LIMITED after the limit", async () => {
    (rateLimitDb.hitRateLimit as any).mockResolvedValue(6);
    const d = { ...deps, image: vi.fn() };
    await expect(generateHouseImage(d as any, req({ method: "POST", body: genBody, sourceIp: "1.2.3.4" }) as any))
      .rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
});
