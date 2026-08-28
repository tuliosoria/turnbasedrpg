import { describe, it, expect, vi, beforeEach } from "vitest";
import { startSpyOp, resolveSpyOp } from "./spyRoutes";
import type { Deps } from "./publicRoutes";
import * as auth from "../auth/playerAuth";
import * as adminAuth from "../auth/adminAuth";
import * as housesDb from "../db/houses";
import * as turnsDb from "../db/turns";
import * as spyDb from "../db/spyOps";

const casa: any = {
  houseId: "solarion-k0hc", name: "Solarion",
  attributes: { riqueza: 2, recursos: 3, soldados: 2, controle: 3 },
};

const deps = () => ({ doc: {} as never, config: { tableName: "t", campaignId: "winter-dead" } } as unknown as Deps);
const req = (body: unknown) => ({ method: "POST", path: "/", headers: {}, body, pathParams: {} }) as never;

let put: any;
let cobrar: any;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(auth, "requirePlayer").mockReturnValue({ houseId: "solarion-k0hc" } as never);
  vi.spyOn(adminAuth, "requireAdmin").mockReturnValue(undefined as never);
  vi.spyOn(housesDb, "getHouse").mockResolvedValue(casa);
  vi.spyOn(turnsDb, "getActiveTurn").mockResolvedValue({ turnId: 7, status: "OPEN" } as never);
  vi.spyOn(spyDb, "listAllSpyOps").mockResolvedValue([]);
  put = vi.spyOn(spyDb, "putSpyOp").mockResolvedValue();
  cobrar = vi.spyOn(housesDb, "updateHouseAttributes").mockResolvedValue();
});

describe("contratar uma operação", () => {
  it("cobra na hora, e não na resolução", async () => {
    const res = await startSpyOp(deps(), req({ question: "Quem pôs Aylin no barco", level: "TESTEMUNHA" }));
    expect(res.status).toBe(201);
    // 3 recursos - 2 do nível
    expect(cobrar.mock.calls[0][4]).toMatchObject({ recursos: 1, riqueza: 2 });
  });

  // Cobrar depois deixaria contratar dez operações com Recurso para uma, e a
  // conta apareceria no turno seguinte, quando não dá mais para escolher.
  it("recusa e não cobra quando a Casa não pode pagar", async () => {
    vi.spyOn(housesDb, "getHouse").mockResolvedValue({ ...casa, attributes: { riqueza: 0, recursos: 1, soldados: 2, controle: 3 } } as never);
    await expect(startSpyOp(deps(), req({ question: "x", level: "PROVA" }))).rejects.toMatchObject({ status: 409 });
    expect(cobrar).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("só com o turno aberto", async () => {
    vi.spyOn(turnsDb, "getActiveTurn").mockResolvedValue({ turnId: 7, status: "LOCKED" } as never);
    await expect(startSpyOp(deps(), req({ question: "x", level: "BOCA" }))).rejects.toMatchObject({ status: 409 });
  });

  it("recusa alvo que não existe no mapa", async () => {
    await expect(
      startSpyOp(deps(), req({ question: "x", level: "BOCA", targetKey: "casa-inventada" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("aceita pergunta sobre o mundo, sem alvo", async () => {
    const res = await startSpyOp(deps(), req({ question: "O que volta do Norte", level: "BOCA" }));
    expect((res.body as any).targetKey).toBe("");
    expect((res.body as any).status).toBe("EM_CURSO");
  });
});

describe("resolver", () => {
  const emCurso = {
    id: "s1", campaignId: "winter-dead", houseId: "solarion-k0hc", turnNumber: 7,
    question: "x", level: "PROVA", targetKey: "", status: "EM_CURSO",
    outcome: null, report: "", createdAt: "", resolvedAt: null,
  };

  it("grava o desfecho e o relato", async () => {
    vi.spyOn(spyDb, "listAllSpyOps").mockResolvedValue([emCurso] as never);
    const res = await resolveSpyOp(deps(), req({ id: "s1", outcome: "FRACASSO", report: "O agente foi pego." }));
    expect((res.body as any)).toMatchObject({ status: "RESOLVIDA", outcome: "FRACASSO" });
  });

  // Resolver duas vezes reescreveria o que a Casa já leu.
  it("recusa resolver de novo", async () => {
    vi.spyOn(spyDb, "listAllSpyOps").mockResolvedValue([{ ...emCurso, status: "RESOLVIDA" }] as never);
    await expect(resolveSpyOp(deps(), req({ id: "s1", outcome: "SUCESSO", report: "x" }))).rejects.toMatchObject({ status: 409 });
  });

  it("404 para operação que não existe", async () => {
    const res = await resolveSpyOp(deps(), req({ id: "nada", outcome: "SUCESSO", report: "x" }));
    expect(res.status).toBe(404);
  });
});
