import { describe, expect, it } from "vitest";
import { snapshotNoMomento } from "./momento";

const PK = "CAMPAIGN#WINTER_DEAD";
const par = "solarion-k0hc~cla-mandibula-de-osso";

const itens = [
  { PK, SK: "TURN#009", turnId: 9, status: "RESOLVED", publicEvent: "e9", result: { publicResult: "r9" } },
  { PK, SK: "TURN#010", turnId: 10, status: "RESOLVED", publicEvent: "e10", result: { publicResult: "Asterhall caiu" } },
  { PK, SK: "TURN#010#SUB#solarion-k0hc", turnId: 10 },
  { PK, SK: "TURN#011", turnId: 11, status: "OPEN", publicEvent: "e11" },
  { PK, SK: `DIPLMSG#0010#${par}#antes`, id: "antes", author: "AI", createdAt: "2026-09-10T10:00:00.000Z", turnNumber: 10 },
  { PK, SK: `DIPLMSG#0010#${par}#alvo`, id: "alvo", author: "PLAYER", createdAt: "2026-09-10T12:00:00.000Z", turnNumber: 10 },
  { PK, SK: `DIPLMSG#0010#${par}#resposta`, id: "resposta", author: "AI", replyToId: "alvo", createdAt: "2026-09-10T12:01:00.000Z", turnNumber: 10 },
  { PK, SK: "CFACT#velho", id: "velho", createdAt: "2026-09-09T00:00:00.000Z" },
  { PK, SK: "CFACT#novo", id: "novo", createdAt: "2026-09-11T00:00:00.000Z" },
  { PK, SK: "WFACT#novo", id: "wnovo", createdAt: "2026-09-11T00:00:00.000Z" },
  { PK, SK: "NPCDYN#cla-mandibula-de-osso#garok", mood: "hoje", updatedAt: "2026-09-27T00:00:00.000Z" },
];

const sks = (xs: { SK: string }[]) => xs.map((x) => x.SK);

describe("snapshotNoMomento", () => {
  it("tira cartas e fatos criados depois da carta", () => {
    const { itens: m } = snapshotNoMomento(itens, "alvo");
    expect(sks(m)).toContain(`DIPLMSG#0010#${par}#antes`);
    expect(sks(m)).toContain(`DIPLMSG#0010#${par}#alvo`);
    expect(sks(m)).not.toContain(`DIPLMSG#0010#${par}#resposta`);
    expect(sks(m)).toContain("CFACT#velho");
    expect(sks(m)).not.toContain("CFACT#novo");
    expect(sks(m)).not.toContain("WFACT#novo");
  });

  it("tira turnos posteriores e reabre o turno da carta sem resultado", () => {
    const { itens: m } = snapshotNoMomento(itens, "alvo");
    expect(sks(m)).not.toContain("TURN#011");
    expect(sks(m)).toContain("TURN#010#SUB#solarion-k0hc");
    const t10 = m.find((i) => i.SK === "TURN#010")!;
    expect(t10.status).toBe("OPEN");
    expect(t10).not.toHaveProperty("result");
    expect(m.find((i) => i.SK === "TURN#009")!.result).toEqual({ publicResult: "r9" });
  });

  it("mantém estado sem história e devolve a carta e a resposta gravada", () => {
    const r = snapshotNoMomento(itens, "alvo");
    expect(sks(r.itens)).toContain("NPCDYN#cla-mandibula-de-osso#garok");
    expect(r.carta.id).toBe("alvo");
    expect(r.respostaGravada?.id).toBe("resposta");
  });

  it("não altera os itens recebidos", () => {
    snapshotNoMomento(itens, "alvo");
    expect(itens.find((i) => i.SK === "TURN#010")!.status).toBe("RESOLVED");
  });

  it("falha quando a carta não existe", () => {
    expect(() => snapshotNoMomento(itens, "sumida")).toThrow(/sumida/);
  });
});
