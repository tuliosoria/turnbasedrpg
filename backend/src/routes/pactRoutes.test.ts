import { describe, it, expect, vi, beforeEach } from "vitest";
import { respondToPact } from "./diplomacyRoutes";
import type { Deps } from "./publicRoutes";
import * as auth from "../auth/playerAuth";
import * as factsDb from "../db/diplomacy/facts";
import * as relDb from "../db/houseRelations";
import * as housesDb from "../db/houses";
import { emptyHouseRelation } from "@ravenloft/content";

const PROPOSTA = {
  id: "f1", campaignId: "winter-dead", turnNumber: 7, kind: "PEDIDO" as const,
  betweenA: "solarion-k0hc", betweenB: "casa-euralune",
  summary: "Rota Comercial de Raven's Cross — posto comum por 90 dias, lentes por aves.",
  sourceMessageId: "m1", status: "ATIVO" as const, createdAt: "2026-08-26T00:00:00.000Z",
};

const deps = () => ({ doc: {} as never, config: { tableName: "t", campaignId: "winter-dead" } } as unknown as Deps);
const req = (body: unknown) => ({ method: "POST", path: "/", headers: {}, body, pathParams: {} }) as never;

let putFact: any;
let putRel: any;
let putAssets: any;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(auth, "requirePlayer").mockReturnValue({ houseId: "solarion-k0hc" } as never);
  vi.spyOn(factsDb, "listFacts").mockResolvedValue([PROPOSTA]);
  vi.spyOn(relDb, "getHouseRelation").mockResolvedValue(emptyHouseRelation("a", "b"));
  // O custo político lê a matriz inteira; sem inimizade declarada, ninguém se ofende.
  vi.spyOn(relDb, "listHouseRelations").mockResolvedValue([]);
  vi.spyOn(housesDb, "getHouse").mockResolvedValue({ houseId: "solarion-k0hc", stability: 3, assets: [] } as never);
  putFact = vi.spyOn(factsDb, "putFact").mockResolvedValue();
  putRel = vi.spyOn(relDb, "putHouseRelation").mockResolvedValue({} as never);
  putAssets = vi.spyOn(housesDb, "updateHouseStabilityAndAssets").mockResolvedValue();
});

describe("responder a um pacto", () => {
  // Era o elo que faltava: a carta propunha, o registro guardava, e uma aliança
  // firmada não mexia numa única linha do jogo.
  it("aceitar move as relações NOS DOIS SENTIDOS", async () => {
    await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    expect(putRel).toHaveBeenCalledTimes(2);
    const gravadas = putRel.mock.calls.map((c: any) => c[3]);
    for (const r of gravadas) expect(r.comercio).toBeGreaterThan(50);
  });

  it("aceitar deixa um ativo com o lugar que a carta nomeou", async () => {
    const res = await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    expect((res.body as any).ativo).toBe("Entreposto em Raven's Cross");
    expect(putAssets).toHaveBeenCalled();
  });

  it("aceitar fecha a proposta e cria o pacto", async () => {
    await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    const escritos = putFact.mock.calls.map((c: any) => c[3]);
    expect(escritos[0]).toMatchObject({ id: "f1", status: "REVOGADO" });
    expect(escritos[1]).toMatchObject({ kind: "ACORDO", status: "ATIVO" });
  });

  it("recusar registra a recusa e não mexe em relação nem ativo", async () => {
    const res = await respondToPact(deps(), req({ factId: "f1", aceitar: false }));
    expect((res.body as any).aceito).toBe(false);
    expect(putRel).not.toHaveBeenCalled();
    expect(putAssets).not.toHaveBeenCalled();
  });

  // Aceitar duas vezes dobraria os ganhos por um acordo só.
  it("recusa responder proposta já respondida", async () => {
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([{ ...PROPOSTA, status: "REVOGADO" as const }]);
    await expect(respondToPact(deps(), req({ factId: "f1", aceitar: true }))).rejects.toMatchObject({ status: 409 });
  });

  it("recusa responder proposta de outra Casa", async () => {
    vi.spyOn(auth, "requirePlayer").mockReturnValue({ houseId: "khazdrun-wxey" } as never);
    await expect(respondToPact(deps(), req({ factId: "f1", aceitar: true }))).rejects.toMatchObject({ status: 403 });
  });

  it("aliança pesa mais na amizade que um acordo comercial", async () => {
    vi.spyOn(factsDb, "listFacts").mockResolvedValue([
      { ...PROPOSTA, summary: "Aliança de defesa mútua e embaixada em Raven's Cross." },
    ]);
    const res = await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    expect((res.body as any).ativo).toBe("Embaixada em Raven's Cross");
    expect(putRel.mock.calls[0][3].amizade).toBe(70);
  });
});

describe("o preço político de um pacto", () => {
  // O limite dos pactos não é um teto artificial: é que os seus aliados se
  // odeiam. Sem isto, o jogador fecharia com as dezesseis Casas.
  it("derruba a amizade de quem odeia a Casa abraçada", async () => {
    vi.spyOn(relDb, "listHouseRelations").mockResolvedValue([
      { ...emptyHouseRelation("casa-valerius", "casa-euralune"), amizade: 2 },
    ]);
    const res = await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    expect((res.body as any).custoPolitico).toEqual([{ casa: "Casa Valerius", amizade: expect.any(Number) }]);
    // Duas do pacto em si, mais uma da Casa ofendida.
    expect(putRel).toHaveBeenCalledTimes(3);
  });

  it("não cobra nada quando ninguém declarou inimizade", async () => {
    const res = await respondToPact(deps(), req({ factId: "f1", aceitar: true }));
    expect((res.body as any).custoPolitico).toEqual([]);
    expect(putRel).toHaveBeenCalledTimes(2);
  });
});
