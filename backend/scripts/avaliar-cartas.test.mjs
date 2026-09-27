import { describe, expect, it } from "vitest";
import { materialDoCaso, resumir, decidir } from "./avaliar-cartas.mjs";

const PK = "CAMPAIGN#WINTER_DEAD";
const par = "solarion-k0hc~cla-mandibula-de-osso";
const msg = (id, author, createdAt, body, extra = {}) =>
  ({ PK, SK: `DIPLMSG#0010#${par}#${id}`, id, author, createdAt, body, fromHouseId: "solarion-k0hc", toHouseKey: "cla-mandibula-de-osso", ...extra });

describe("materialDoCaso", () => {
  it("separa o fio anterior e as cartas anteriores da Casa que responde", () => {
    const itens = [
      msg("a", "PLAYER", "2026-09-10T01:00:00Z", "oi"),
      msg("b", "AI", "2026-09-10T02:00:00Z", "resposta b"),
      msg("alvo", "PLAYER", "2026-09-10T03:00:00Z", "pergunta"),
      { PK, SK: "DIPLMSG#0010#solarion-k0hc~casa-vargen#x", id: "x", author: "AI", createdAt: "2026-09-10T00:00:00Z", body: "outro par" },
    ];
    const m = materialDoCaso(itens, itens[2]);
    expect(m.fioAnterior).toEqual(["oi", "resposta b"]);
    expect(m.anterioresDaCasa).toEqual(["resposta b"]);
    expect(m.recebida).toBe("pergunta");
  });
});

const caso = (reciclagem, eco, termos = [], mortes = []) => ({
  metricas: {
    reciclagem, vazia: false, prazos: [], escala: null, nomesForaDoCanone: [], motivosRevisor: [],
    eco: { total: 4, respondidas: Math.round(eco * 4), semEco: [] },
    termosBatidos: termos, morteAfirmada: mortes,
  },
});

describe("resumir", () => {
  it("dá a mediana da reciclagem e conta os casos com eco baixo", () => {
    const r = resumir([caso(0.1, 1), caso(0.3, 0.5), caso(0.2, 0.25)]);
    expect(r.medianaReciclagem).toBeCloseTo(0.2);
    expect(r.casosComEcoBaixo).toBe(2);
  });

  it("conta casos com termo batido ≥ 3 vezes na resposta", () => {
    const r = resumir([caso(0, 1, [{ termo: "vau negro", noFio: 20, naResposta: 3 }]), caso(0, 1, [{ termo: "tecido", noFio: 9, naResposta: 2 }])]);
    expect(r.casosComTermoMartelado).toBe(1);
  });

  it("ignora casos com erro", () => {
    expect(resumir([{ erro: "x" }, caso(0.5, 1)]).casos).toBe(1);
  });
});

describe("decidir (critério fixado no spec)", () => {
  const base = { medianaReciclagem: 0.05, casosComTermoMartelado: 0, casosComEcoBaixo: 0, mortes: 0 };

  it("sem sinal: deployar e parar", () => {
    expect(decidir(base)).toEqual({ detector: false, revisor: false });
  });

  it("reciclagem mediana ≥ 0,15 pede detector", () => {
    expect(decidir({ ...base, medianaReciclagem: 0.15 }).detector).toBe(true);
  });

  it("dois casos com termo martelado pedem detector", () => {
    expect(decidir({ ...base, casosComTermoMartelado: 2 }).detector).toBe(true);
  });

  it("eco baixo em dois casos, ou uma morte afirmada, pede revisor", () => {
    expect(decidir({ ...base, casosComEcoBaixo: 2 }).revisor).toBe(true);
    expect(decidir({ ...base, mortes: 1 }).revisor).toBe(true);
    expect(decidir({ ...base, casosComEcoBaixo: 1 }).revisor).toBe(false);
  });
});
