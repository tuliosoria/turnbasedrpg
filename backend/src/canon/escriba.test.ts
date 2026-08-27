import { describe, it, expect, vi, beforeEach } from "vitest";
import { escreverCanone, ErroDeEscrita } from "./escriba";
import type { CanonProposal } from "@ravenloft/content";

vi.mock("../db/wiki", () => ({ putWikiEntry: vi.fn(async (_d, _t, _c, e) => e) }));
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

const deps = () => ({
  doc: {} as never,
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
});

const OP = "op-abc";

beforeEach(() => vi.clearAllMocks());

describe("escreverCanone", () => {
  it("grava verbete e entidade e devolve os dois ids", async () => {
    const r = await escreverCanone(deps(), { proposal: proposta(), houseId: "vargen-x1", opId: OP });

    expect(r.wikiEntryId).toBeTruthy();
    expect(r.visualEntityId).toBeTruthy();

    const entry = vi.mocked(wikiDb.putWikiEntry).mock.calls[0][3];
    expect(entry.title).toBe("Sera de Vargen");
    expect(entry.body).toBe("Batedora das fronteiras.");
    // Sem imagem é o ponto da ferramenta: o verbete não pode sair com campo de
    // imagem nenhum, nem vazio, para não abrir moldura sem retrato na tela.
    expect(entry.imageUrl).toBeUndefined();
    expect(entry.imageUrls).toBeUndefined();

    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.canonicalName).toBe("Sera de Vargen");
    expect(entity.wikiEntryId).toBe(r.wikiEntryId);
    expect(entity.status).toBe("CANONICAL");
    expect(entity.immutableTraits.map((t) => t.text)).toEqual(["cicatriz no queixo"]);
  });

  /**
   * A Casa do Mestre vem do seletor da tela, nunca do campo homônimo da
   * proposta: aquele é texto livre da IA, que devolve o nome ("Vargen") onde o
   * banco espera o id sorteado ("vargen-x1").
   */
  it("usa a Casa recebida, não a que a IA escreveu na proposta", async () => {
    await escreverCanone(deps(), { proposal: proposta({ houseId: "Vargen" }), houseId: "vargen-x1", opId: OP });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].houseId).toBe("vargen-x1");
  });

  it("aceita cânone sem Casa nenhuma", async () => {
    await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: OP });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].houseId).toBeNull();
  });

  it("grava só o verbete quando a proposta não pede entidade", async () => {
    const r = await escreverCanone(deps(), { proposal: proposta({ entityType: null }), houseId: null, opId: OP });

    expect(r.wikiEntryId).toBeTruthy();
    expect(r.visualEntityId).toBeNull();
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
  });

  it("recusa seção fora do cânone antes de gravar qualquer coisa", async () => {
    await expect(
      escreverCanone(deps(), { proposal: proposta({ section: "campanha-dnd" }), houseId: null, opId: OP }),
    ).rejects.toThrow(/fora do cânone/);

    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
  });

  it("desempata slug já usado", async () => {
    vi.mocked(entitiesDb.listEntities).mockResolvedValueOnce([{ slug: "sera-de-vargen" }] as never);

    await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: OP });

    expect(vi.mocked(entitiesDb.putEntity).mock.calls[0][3].slug).toMatch(/^sera-de-vargen-/);
  });

  /**
   * O conserto de um verbete órfão já existe na tela: o botão "Criar entidade
   * visual" do Acervo. Para a tela poder apontar para lá, o erro precisa dizer
   * qual verbete sobreviveu.
   */
  it("quando a entidade falha, o erro carrega o verbete que sobreviveu", async () => {
    vi.mocked(entitiesDb.putEntity).mockRejectedValueOnce(new Error("dynamo caiu"));

    const erro = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: OP }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroDeEscrita);
    expect((erro as ErroDeEscrita).wikiEntryId).toBeTruthy();
  });
});

/**
 * O caso que a revisão levantou: a gravação acontece no servidor mas a resposta
 * se perde. O Mestre vê erro e publica de novo. Sem chave de operação, isso
 * criava um segundo verbete e um segundo personagem no cânone de uma partida ao
 * vivo. Com ela, republicar reescreve o mesmo registro — e vira a recuperação
 * certa também para a falha parcial.
 */
describe("republicar com a mesma chave de operação", () => {
  it("reescreve os mesmos ids em vez de duplicar", async () => {
    const a = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-1" });
    const b = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-1" });

    expect(b.wikiEntryId).toBe(a.wikiEntryId);
    expect(b.visualEntityId).toBe(a.visualEntityId);
  });

  it("chaves diferentes escrevem cânone diferente", async () => {
    const a = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-1" });
    const b = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-2" });

    expect(b.wikiEntryId).not.toBe(a.wikiEntryId);
  });

  /**
   * O desempate de slug não pode disparar contra a própria entidade de uma
   * tentativa anterior: se disparasse, cada retentativa mudaria o slug e o
   * endereço do personagem na Enciclopédia mudaria sozinho.
   */
  it("não desempata o slug contra a própria tentativa anterior", async () => {
    const primeira = await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-1" });
    vi.mocked(entitiesDb.listEntities).mockResolvedValueOnce([
      { id: primeira.visualEntityId, slug: "sera-de-vargen" },
    ] as never);

    await escreverCanone(deps(), { proposal: proposta(), houseId: null, opId: "op-1" });

    const ultima = vi.mocked(entitiesDb.putEntity).mock.calls.at(-1)![3];
    expect(ultima.slug).toBe("sera-de-vargen");
  });
});
