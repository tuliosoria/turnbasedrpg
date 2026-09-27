import { describe, expect, it } from "vitest";
import { corrigirCarta, corrigirFato, planejarReparo } from "./reparar-solarion-mandibula.mjs";

const PK = "CAMPAIGN#WINTER_DEAD";

const carta = (over = {}) => ({
  PK,
  SK: "DIPLMSG#0010#solarion-k0hc~cla-mandibula-de-osso#mu7bh7vm-ryesl2",
  id: "mu7bh7vm-ryesl2",
  turnNumber: 10,
  author: "AI",
  fromHouseId: "solarion-k0hc",
  toHouseKey: "cla-mandibula-de-osso",
  body: "Escrevo isso com a boca amarga: Thorgul Crânio Cinzento caiu, e ainda não tivemos noite limpa para chorar direito.",
  ...over,
});

const primeiraCarta = carta();
const segundaCarta = carta({
  SK: "DIPLMSG#0010#solarion-k0hc~cla-mandibula-de-osso#mua8jyze-4ykmgk",
  id: "mua8jyze-4ykmgk",
  body: "Depois de Thorgul cair, contamos cada lança antes de responder.",
});
const fatoAntigo = {
  PK,
  SK: "CFACT#mu7bh7vv-ywo3lm",
  id: "mu7bh7vv-ywo3lm",
  betweenA: "solarion-k0hc",
  betweenB: "cla-mandibula-de-osso",
  turnNumber: 10,
  kind: "ACORDO",
  status: "ATIVO",
  sourceMessageId: "mu7bh7vm-ryesl2",
};
const fatoMantido = {
  ...fatoAntigo,
  SK: "CFACT#mua8uzjq-buoc2p",
  id: "mua8uzjq-buoc2p",
  sourceMessageId: "mua8jyze-4ykmgk",
};

describe("transformações puras do reparo", () => {
  it("corrige apenas a premissa falsa e preserva o resto da carta", () => {
    const result = corrigirCarta(carta());
    expect(result.state).toBe("update");
    expect(result.after.body).not.toContain("Thorgul Crânio Cinzento caiu");
    expect(result.after.body).toContain("nossos mortos engrossarem a fileira inimiga");
    expect(result.after.body).toContain("e ainda não tivemos noite limpa para chorar direito.");
  });

  it("recusa texto de jogador mesmo quando contém a frase alvo", () => {
    expect(() => corrigirCarta(carta({ author: "PLAYER" }))).toThrow(/autor IA/);
  });

  it("reconhece a carta já corrigida sem reescrever", () => {
    const once = corrigirCarta(carta()).after;
    expect(corrigirCarta(once).state).toBe("unchanged");
  });

  it("revoga o acordo antigo sem apagar procedência", () => {
    const result = corrigirFato(fatoAntigo);
    expect(result.after).toEqual({ ...fatoAntigo, status: "REVOGADO" });
    expect(corrigirFato(result.after).state).toBe("unchanged");
  });
});

describe("planejamento fechado antes de qualquer escrita", () => {
  it("valida todos os alvos antes de devolver qualquer escrita", () => {
    expect(() => planejarReparo([primeiraCarta, segundaCarta, fatoAntigo]))
      .toThrow(/mua8uzjq-buoc2p/);
  });

  it("aceita execução interrompida e atualiza somente o alvo ainda antigo", () => {
    const primeiraCorrigida = corrigirCarta(primeiraCarta).after;
    const plan = planejarReparo([
      primeiraCorrigida,
      segundaCarta,
      fatoAntigo,
      fatoMantido,
    ]);
    expect(plan.updates.map((u) => u.id).sort()).toEqual([
      "mua8jyze-4ykmgk",
      "mu7bh7vv-ywo3lm",
    ].sort());
    expect(plan.unchanged).toContain("mu7bh7vm-ryesl2");
  });

  it("recusa terceiro estado em vez de adivinhar correção", () => {
    expect(() => planejarReparo([
      { ...primeiraCarta, body: "texto inesperado" },
      segundaCarta,
      fatoAntigo,
      fatoMantido,
    ])).toThrow(/estado inesperado/);
  });
});
