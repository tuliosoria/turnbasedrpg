import { describe, expect, it } from "vitest";
import { bonusDeRotas, motivoDasRotas, rotasAbertasDe, ROTAS_POR_RECURSO } from "./rotas.js";
import type { CampaignFact } from "./models.js";

function fato(over: Partial<CampaignFact> = {}): CampaignFact {
  return {
    id: "f", campaignId: "c", turnNumber: 7, kind: "ACORDO",
    betweenA: "solarion-k0hc", betweenB: "casa-karasoy", summary: "Rota das Planícies.",
    sourceMessageId: "m", status: "ATIVO", createdAt: "2026-08-29T00:00:00Z", ...over,
  };
}

describe("o que as rotas rendem", () => {
  // Duas rotas não rendem dois terços de recurso: rendem nada, e a terceira é
  // que paga. É o que faz a mesa perseguir a terceira.
  it("paga só na terceira rota", () => {
    expect(bonusDeRotas(0)).toBe(0);
    expect(bonusDeRotas(2)).toBe(0);
    expect(bonusDeRotas(3)).toBe(1);
  });

  it("paga de novo a cada três", () => {
    expect(bonusDeRotas(5)).toBe(1);
    expect(bonusDeRotas(6)).toBe(2);
    expect(bonusDeRotas(9)).toBe(3);
  });

  it("não quebra com número inválido", () => {
    expect(bonusDeRotas(-4)).toBe(0);
    expect(bonusDeRotas(Number.NaN)).toBe(0);
  });

  it("a constante é a única fonte do número três", () => {
    expect(bonusDeRotas(ROTAS_POR_RECURSO)).toBe(1);
  });
});

describe("quais fatos são rota", () => {
  it("conta o acordo ativo da Casa", () => {
    const r = rotasAbertasDe([fato(), fato({ id: "f2", betweenB: "casa-euralune" })], "solarion-k0hc");
    expect(r).toHaveLength(2);
  });

  it("ignora acordo de outra Casa", () => {
    expect(rotasAbertasDe([fato()], "khazdrun-wxey")).toEqual([]);
  });

  // Revogar o fato é a correção para uma rota que não deveria contar.
  it("ignora acordo revogado", () => {
    expect(rotasAbertasDe([fato({ status: "REVOGADO" })], "solarion-k0hc")).toEqual([]);
  });

  it("ignora aliança, promessa e recusa — só acordo é rota", () => {
    const outros = ["ALIANCA", "PROMESSA", "RECUSA", "AMEACA", "PEDIDO"] as const;
    for (const kind of outros) {
      expect(rotasAbertasDe([fato({ kind })], "solarion-k0hc"), kind).toEqual([]);
    }
  });
});

describe("o motivo que o jogador lê", () => {
  it("concorda em número", () => {
    expect(motivoDasRotas(1)).toBe("por 1 rota comercial aberta");
    expect(motivoDasRotas(3)).toBe("por 3 rotas comerciais abertas");
  });
});
