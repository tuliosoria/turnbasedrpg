import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonPreview, canonUploadImage, canonSubmit, canonListMine, adminCanonList, adminCanonApprove, adminCanonReject } from "./canonRoutes";
import { makeImageStoreFake } from "./testHelpers";
import { signToken } from "../auth/tokens";
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import * as canonDb from "../db/canonSubmissions";
import { getCanonSubmission } from "../db/canonSubmissions";
import * as rateLimitDb from "../db/rateLimit";
import * as wikiDb from "../db/wiki";
import { publishCanonSubmission } from "../canon/publish";

vi.mock("../db/wiki", () => ({ listCanonWikiEntries: vi.fn(async () => []) }));
vi.mock("../db/canonSubmissions", () => ({
  putCanonSubmission: vi.fn(async (_d, _t, _c, s) => s),
  listCanonSubmissions: vi.fn(async () => []),
  getCanonSubmission: vi.fn(),
}));
vi.mock("../db/rateLimit", () => ({ hitRateLimit: vi.fn(async () => 1) }));
vi.mock("../canon/publish", () => ({ publishCanonSubmission: vi.fn(async (_d, s) => ({ ...s, status: "APPROVED" })) }));

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

  it("keeps the proposal with a null review when the review call fails", async () => {
    chat
      .mockResolvedValueOnce(JSON.stringify(proposal))
      .mockRejectedValueOnce(new Error("modelo indisponível"));
    const res = await canonPreview(deps(), playerReq({ body: { rawText: "Quero criar Sera." } }));
    expect(res.status).toBe(200);
    expect((res.body as { proposal: { title: string } }).proposal.title).toBe("Sera de Vargen");
    expect((res.body as { review: unknown }).review).toBeNull();
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
  it("feeds the canon-filtered wiki query into the AI prompt", async () => {
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

  it("persiste o parecer da IA (com ids em conflito) para o Mestre resolver", async () => {
    const review = {
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o nome do líder já registrado." }],
      conflictingEntryIds: ["w1"],
    };
    const res = await canonSubmit(deps(), playerReq({ body: { rawText: "Troque o nome do líder.", proposal, review } }));
    expect(res.status).toBe(200);
    const saved = vi.mocked(canonDb.putCanonSubmission).mock.calls[0][3];
    expect(saved.status).toBe("PENDING_GM");
    expect(saved.review).toEqual(review);
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

  it("rejects an image not produced by this server's upload endpoint", async () => {
    const depsWithImages = { doc: {} as never, config, imageStore: makeImageStoreFake() } as never;
    await expect(
      canonSubmit(
        depsWithImages,
        playerReq({ body: { rawText: "Quero criar Sera.", rawImageUrl: "https://evil.example/canon/x/original.png", rawImageKey: "canon/x/original.png", proposal } }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
  });

  it("accepts an image url/key pair under this server's base url", async () => {
    vi.mocked(canonDb.listCanonSubmissions).mockResolvedValue([] as never);
    const depsWithImages = { doc: {} as never, config, imageStore: makeImageStoreFake() } as never;
    const res = await canonSubmit(
      depsWithImages,
      playerReq({ body: { rawText: "Quero criar Sera.", rawImageUrl: "https://cdn.example/canon/x/original.png?v=1", rawImageKey: "canon/x/original.png", proposal } }),
    );
    expect(res.status).toBe(200);
    const saved = vi.mocked(canonDb.putCanonSubmission).mock.calls[0][3];
    expect(saved.rawImageUrl).toBe("https://cdn.example/canon/x/original.png?v=1");
    expect(saved.rawImageKey).toBe("canon/x/original.png");
  });
});

describe("canonListMine", () => {
  it("lists only this house's submissions", async () => {
    const mine = [{ id: "s1", houseId: "vargen", status: "PENDING_GM" }];
    vi.mocked(canonDb.listCanonSubmissions).mockResolvedValue(mine as never);
    const res = await canonListMine(deps(), playerReq({ method: "GET" }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mine);
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
      { doc: {} as never, config, imageStore: makeImageStoreFake({ uploadCanonImage }) } as never,
      playerReq({ headers: { ...playerReq().headers, "content-type": `multipart/form-data; boundary=${boundary}` }, rawBody: raw } as never),
    );
    expect(res.body).toEqual({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" });
  });
});

function adminReq(over: Partial<HandlerRequest> = {}): HandlerRequest {
  const token = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60_000 }, "segredo");
  return { ...playerReq(over), headers: { authorization: `Bearer ${token}`, ...(over.headers ?? {}) } } as HandlerRequest;
}

const pending = {
  id: "sub1",
  campaignId: "winter-dead",
  houseId: "vargen",
  authorName: "Casa Vargen",
  rawText: "Quero criar Sera.",
  rawImageUrl: null,
  rawImageKey: null,
  proposal,
  review: null,
  status: "PENDING_GM",
  gmNote: "",
  wikiEntryId: null,
  visualEntityId: null,
  visualAssetId: null,
  resolvedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("admin canon routes", () => {
  it("lists every submission in the campaign", async () => {
    await adminCanonList(deps(), adminReq({ method: "GET" }));
    expect(vi.mocked(canonDb.listCanonSubmissions).mock.calls[0][3]).toBeUndefined();
  });

  it("rejects a non-admin caller", async () => {
    await expect(adminCanonList(deps(), playerReq({ method: "GET" }))).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("approves using the GM's edited proposal", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(pending as never);
    const edited = { ...proposal, title: "Sera, a Batedora" };
    const res = await adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1", proposal: edited } }));
    expect(res.status).toBe(200);
    const passed = vi.mocked(publishCanonSubmission).mock.calls[0][1];
    expect(passed.proposal.title).toBe("Sera, a Batedora");
  });

  it("refuses to approve a submission that is not pending", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue({ ...pending, status: "APPROVED" } as never);
    await expect(
      adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1" } })),
    ).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("404s on an unknown submission", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(null);
    await expect(
      adminCanonApprove(deps(), adminReq({ body: { submissionId: "nope" } })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects with a note and publishes nothing", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(pending as never);
    const res = await adminCanonReject(deps(), adminReq({ body: { submissionId: "sub1", note: "Conflita com o cerco." } }));
    expect((res.body as { status: string; gmNote: string }).status).toBe("REJECTED");
    expect((res.body as { gmNote: string }).gmNote).toBe("Conflita com o cerco.");
    expect((res.body as { resolvedAt: string | null }).resolvedAt).not.toBeNull();
    expect(publishCanonSubmission).not.toHaveBeenCalled();
  });

  it("emite aviso ao retomar publicação parcial", async () => {
    const partial = { ...pending, wikiEntryId: "w1", visualEntityId: "ve1" };
    vi.mocked(getCanonSubmission).mockResolvedValue(partial as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1" } }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("sub1"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("wikiEntryId=w1"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("visualEntityId=ve1"));
    warnSpy.mockRestore();
  });

  it("não emite aviso em aprovação inédita", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(pending as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1" } }));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
