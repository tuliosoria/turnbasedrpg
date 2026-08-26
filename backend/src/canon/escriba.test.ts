import { describe, it, expect, vi, beforeEach } from "vitest";
import { escreverCanone, ErroDeEscrita } from "./escriba";
import type { CanonProposal } from "@ravenloft/content";

vi.mock("../db/wiki", () => ({ putWikiEntry: vi.fn(async (_d, _t, _c, e) => e), generateWikiId: vi.fn(() => "wiki01") }));
vi.mock("../db/visual/entities", () => ({ putEntity: vi.fn(), listEntities: vi.fn(async () => []) }));

import * as wikiDb from "../db/wiki";
import * as entitiesDb from "../db/visual/entities";

function proposta(over: Partial<CanonProposal> = {}): CanonProposal {
  return {
    title: "Sera de Vargen",
    section: "casas",
    body: "Batedora das fronteiras.",
    summary: "Batedora.",
    entityType: "CHARACTER",
    canonicalName: "Sera de Vargen",
    immutableTraits: ["cicatriz no queixo"],
    houseId: "Vargen",
    ...over,
  };
}

let ids = 0;
const deps = () => ({
  doc: {} as never,
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  newId: () => `id${++ids}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  ids = 0;
});

describe("escreverCanone", () => {
  it("grava verbete e entidade e devolve os dois ids", async () => {
    const r = await escreverCanone(deps(), { proposal: proposta(), houseId: "vargen-x1" });

    expect(r.wikiEntryId).toBe("wiki01");
    expect(r.visualEntityId).toBe("id1");

    const entry = vi.mocked(wikiDb.putWikiEntry).mock.calls[0][3];
    expect(entry.title).toBe("Sera de Vargen");
    expect(entry.body).toBe("Batedora das fronteiras.");
    // Sem imagem é o ponto da ferramenta: o verbete não pode sair com campo de
    // imagem nenhum, nem vazio, para não abrir moldura sem retrato na tela.
    expect(entry.imageUrl).toBeUndefined();
    expect(entry.imageUrls).toBeUndefined();

    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.canonicalName).toBe("Sera de Vargen");
    expect(entity.wikiEntryId).toBe("wiki01");
    expect(entity.status).toBe("CANONICAL");
    expect(entity.immutableTraits.map((t) => t.text)).toEqual(["cicatriz no queixo"]);
  });

  /**
   * A Casa do Mestre vem do seletor da tela, nunca do campo homônimo da
   * proposta: aquele é texto livre da IA, que devolve o nome ("Vargen") onde o
   * banco espera o id sorteado ("vargen-x1").
   */
  it("usa a Casa recebida, não a que a IA escreveu na proposta", async () => {
    await escreverCanone(deps(), { proposal: proposta({ houseId: "Vargen" }), houseId: "vargen-x1" });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].houseId).toBe("vargen-x1");
  });

  it("aceita cânone sem Casa nenhuma", async () => {
    await escreverCanone(deps(), { proposal: proposta(), houseId: null });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].houseId).toBeNull();
  });

  it("grava só o verbete quando a proposta não pede entidade", async () => {
    const r = await escreverCanone(deps(), { proposal: proposta({ entityType: null }), houseId: null });

    expect(r.wikiEntryId).toBe("wiki01");
    expect(r.visualEntityId).toBeNull();
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
  });

  it("recusa seção fora do cânone antes de gravar qualquer coisa", async () => {
    await expect(
      escreverCanone(deps(), { proposal: proposta({ section: "campanha-dnd" }), houseId: null }),
    ).rejects.toThrow(/fora do cânone/);

    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
  });

  it("desempata slug já usado", async () => {
    vi.mocked(entitiesDb.listEntities).mockResolvedValueOnce([{ slug: "sera-de-vargen" }] as never);

    await escreverCanone(deps(), { proposal: proposta(), houseId: null });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].slug).toMatch(/^sera-de-vargen-/);
  });

  /**
   * O conserto de um verbete órfão já existe na tela: o botão "Criar entidade
   * visual" do Acervo. Para a tela poder apontar para lá, o erro precisa dizer
   * qual verbete sobreviveu.
   */
  it("quando a entidade falha, o erro carrega o verbete que sobreviveu", async () => {
    vi.mocked(entitiesDb.putEntity).mockRejectedValueOnce(new Error("dynamo caiu"));

    const erro = await escreverCanone(deps(), { proposal: proposta(), houseId: null }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroDeEscrita);
    expect((erro as ErroDeEscrita).wikiEntryId).toBe("wiki01");
  });
});
