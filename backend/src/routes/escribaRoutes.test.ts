import { describe, it, expect, beforeEach, vi } from "vitest";
import { escribaPreview, escribaPublicar } from "./escribaRoutes";
import { signToken } from "../auth/tokens";
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import { escreverCanone, ErroDeEscrita } from "../canon/escriba";

vi.mock("../db/wiki", () => ({ listCanonWikiEntries: vi.fn(async () => []) }));
vi.mock("../canon/escriba", async () => {
  const real = await vi.importActual<typeof import("../canon/escriba")>("../canon/escriba");
  return {
    ...real,
    escreverCanone: vi.fn(async () => ({ wikiEntryId: "wiki01", visualEntityId: "ent01" })),
  };
});

const config = {
  campaignId: "winter-dead",
  tableName: "ravenloft-game",
  tokenSigningSecret: "segredo",
  tokenTtlSeconds: 3600,
} as unknown as Config;

function req(over: Partial<HandlerRequest> = {}, tipo: "admin" | "player" = "admin"): HandlerRequest {
  const token =
    tipo === "admin"
      ? signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60_000 }, "segredo")
      : signToken(
          { type: "player", campaignId: "winter-dead", houseId: "vargen", displayName: "Casa Vargen", exp: Date.now() + 60_000 },
          "segredo",
        );
  return {
    method: "POST",
    path: "/api/admin/escriba",
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
  houseId: "Vargen",
};

const chat = vi.fn();
const deps = () => ({ doc: {} as never, config, chat }) as never;

beforeEach(() => vi.clearAllMocks());

describe("escribaPreview", () => {
  it("devolve proposta e parecer para o Mestre", async () => {
    chat
      .mockResolvedValueOnce(JSON.stringify(proposal))
      .mockResolvedValueOnce(JSON.stringify({ verdict: "OK", flags: [], conflictingEntryIds: [] }));

    const res = await escribaPreview(deps(), req({ body: { rawText: "Quero criar Sera." } }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ proposal: { title: "Sera de Vargen" }, review: { verdict: "OK" } });
  });

  it("recusa quem não é Mestre", async () => {
    await expect(
      escribaPreview(deps(), req({ body: { rawText: "x" } }, "player")),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe("escribaPublicar", () => {
  it("escreve o cânone e devolve os ids", async () => {
    const res = await escribaPublicar(deps(), req({ body: { proposal, houseId: "vargen-x1" } }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ wikiEntryId: "wiki01", visualEntityId: "ent01" });
    expect(vi.mocked(escreverCanone).mock.calls[0][1]).toMatchObject({ houseId: "vargen-x1" });
  });

  it("aceita cânone sem Casa", async () => {
    await escribaPublicar(deps(), req({ body: { proposal, houseId: null } }));

    expect(vi.mocked(escreverCanone).mock.calls[0][1].houseId).toBeNull();
  });

  it("recusa quem não é Mestre", async () => {
    await expect(
      escribaPublicar(deps(), req({ body: { proposal, houseId: null } }, "player")),
    ).rejects.toBeInstanceOf(HttpError);
  });

  /**
   * Um verbete gravado sem entidade é consertável pela tela do Acervo, mas só
   * se a resposta disser qual verbete ficou órfão.
   */
  it("uma falha parcial responde 409 dizendo qual verbete sobreviveu", async () => {
    vi.mocked(escreverCanone).mockRejectedValueOnce(new ErroDeEscrita("faltou a entidade", "wiki07"));

    const erro = await escribaPublicar(deps(), req({ body: { proposal, houseId: null } })).catch((e) => e);

    expect(erro).toBeInstanceOf(HttpError);
    expect((erro as HttpError).status).toBe(409);
    expect((erro as HttpError).message).toContain("wiki07");
  });
});
