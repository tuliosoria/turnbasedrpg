import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonPreview, canonUploadImage, canonSubmit, canonListMine } from "./canonRoutes";
import { signToken } from "../auth/tokens";
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";

vi.mock("../db/wiki", () => ({ listCanonWikiEntries: vi.fn(async () => []) }));
vi.mock("../db/canonSubmissions", () => ({
  putCanonSubmission: vi.fn(async (_d, _t, _c, s) => s),
  listCanonSubmissions: vi.fn(async () => []),
}));
vi.mock("../db/rateLimit", () => ({ hitRateLimit: vi.fn(async () => 1) }));

import * as canonDb from "../db/canonSubmissions";
import * as rateLimitDb from "../db/rateLimit";
import * as wikiDb from "../db/wiki";

const config = {
  campaignId: "winter-dead",
  tableName: "ravenloft-game",
  tokenSigningSecret: "segredo",
  tokenTtlSeconds: 3600,
} as unknown as Config;

function playerReq(over: Partial<HandlerRequest> = {}): HandlerRequest {
  const token = signToken(
    { type: "player", campaignId: "winter-dead", houseId: "vargen", displayName: "Casa Vargen", exp: Date.now() + 60_000 },
    "segredo",
  );
  return {
    method: "POST",
    path: "/api/player/canonico",
    headers: { authorization: `Bearer ${token}` },
    query: {},
    pathParams: {},
    body: {},
    ...over,
  } as HandlerRequest;
}

const proposal = {
  title: "Sera de Vargen",
  section: "casas",
  body: "Batedora das fronteiras.",
  summary: "Batedora.",
  entityType: "CHARACTER",
  canonicalName: "Sera de Vargen",
  immutableTraits: [],
  houseId: "vargen",
};

const chat = vi.fn();
const deps = () => ({ doc: {} as never, config, chat }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimitDb.hitRateLimit).mockResolvedValue(1);
});

describe("canonPreview", () => {
  it("returns a proposal and a review", async () => {
    chat
      .mockResolvedValueOnce(JSON.stringify(proposal))
      .mockResolvedValueOnce(JSON.stringify({ verdict: "OK", flags: [], conflictingEntryIds: [] }));
    const res = await canonPreview(deps(), playerReq({ body: { rawText: "Quero criar Sera." } }));
    expect(res.status).toBe(200);
    expect((res.body as { proposal: { title: string } }).proposal.title).toBe("Sera de Vargen");
    expect((res.body as { review: { verdict: string } }).review.verdict).toBe("OK");
  });

  it("refuses when the AI is not configured", async () => {
    await expect(
      canonPreview({ doc: {} as never, config } as never, playerReq({ body: { rawText: "x" } })),
    ).rejects.toMatchObject({ code: "AI_DISABLED" });
  });

  it("refuses past the hourly quota", async () => {
    vi.mocked(rateLimitDb.hitRateLimit).mockResolvedValue(11);
    await expect(canonPreview(deps(), playerReq({ body: { rawText: "x" } }))).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  // Blindagem contra vazamento: o prompt da IA voltada ao jogador só pode ser
  // alimentado pela lista canônica e pública (listCanonWikiEntries), nunca pela
  // lista bruta que carregaria regras de mesa ou segredos do Mestre.
  it("only feeds canon-eligible public wiki entries into the AI prompt", async () => {
    vi.mocked(wikiDb.listCanonWikiEntries).mockResolvedValue([
      { entryId: "w1", section: "casas", title: "Casa Vargen", body: "História pública." },
    ] as never);
    chat
      .mockResolvedValueOnce(JSON.stringify(proposal))
      .mockResolvedValueOnce(JSON.stringify({ verdict: "OK", flags: [], conflictingEntryIds: [] }));

    await canonPreview(deps(), playerReq({ body: { rawText: "Quero criar Sera." } }));

    expect(vi.mocked(wikiDb.listCanonWikiEntries)).toHaveBeenCalledTimes(1);
    const prompts = chat.mock.calls.map((c) => `${c[0]} ${c[1]}`).join("\n");
    expect(prompts).toContain("Casa Vargen");
    expect(prompts).not.toContain("campanha-dnd");
  });
});

describe("canonSubmit", () => {
  it("stores a pending submission owned by the player's house", async () => {
    const res = await canonSubmit(deps(), playerReq({ body: { rawText: "Quero criar Sera.", proposal } }));
    expect(res.status).toBe(200);
    const saved = vi.mocked(canonDb.putCanonSubmission).mock.calls[0][3];
    expect(saved.houseId).toBe("vargen");
    expect(saved.authorName).toBe("Casa Vargen");
    expect(saved.status).toBe("PENDING_GM");
  });

  it("refuses more than five pending submissions", async () => {
    vi.mocked(canonDb.listCanonSubmissions).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, status: "PENDING_GM" })) as never,
    );
    await expect(canonSubmit(deps(), playerReq({ body: { rawText: "x", proposal } }))).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      canonSubmit(deps(), { ...playerReq(), headers: {} } as HandlerRequest),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe("canonListMine", () => {
  it("lists only this house's submissions", async () => {
    await canonListMine(deps(), playerReq({ method: "GET" }));
    expect(vi.mocked(canonDb.listCanonSubmissions).mock.calls[0][3]).toBe("vargen");
  });
});

describe("canonUploadImage", () => {
  it("refuses when the image store is not configured", async () => {
    await expect(canonUploadImage(deps(), playerReq())).rejects.toMatchObject({ code: "IMAGE_DISABLED" });
  });

  it("uploads and returns url and key", async () => {
    const uploadCanonImage = vi.fn(async () => ({ key: "canon/x/original.png", url: "https://cdn/x.png" }));
    const boundary = "----x";
    const raw = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      Buffer.from([1, 2, 3]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await canonUploadImage(
      { doc: {} as never, config, imageStore: { uploadCanonImage } } as never,
      playerReq({ headers: { ...playerReq().headers, "content-type": `multipart/form-data; boundary=${boundary}` }, rawBody: raw } as never),
    );
    expect(res.body).toEqual({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" });
  });
});
