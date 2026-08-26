import { describe, expect, it } from "vitest";
import { SEATS } from "./geography.js";
import {
  PACT_BREAK_DELTAS,
  PACT_DELTAS,
  applyDeltas,
  isAnswerable,
  pactAssetName,
  pactKindFor,
  placeInSummary,
  politicalFallout,
} from "./pacts.js";

const ROTA =
  "Rota Comercial de Raven's Cross — proposta de Euralune. Posto comum por 90 dias. " +
  "Euralion envia 12 cavaleiros de hipogrifo e 24 aves de recado; Solarion envia 6 lentes de longo alcance.";

describe("applyDeltas", () => {
  it("move os eixos e respeita os limites da escala", () => {
    const alto = applyDeltas({ amizade: 95, comercio: 50, favores: 50 }, PACT_DELTAS.ALIANCA);
    expect(alto.amizade).toBe(100);
    const baixo = applyDeltas({ amizade: 5, comercio: 5, favores: 5 }, PACT_BREAK_DELTAS.ALIANCA);
    expect(baixo.amizade).toBe(0);
  });

  // Aliança é compromisso político; acordo é negócio. Devem pesar diferente.
  it("faz aliança mexer mais na amizade e acordo mais no comércio", () => {
    expect(PACT_DELTAS.ALIANCA.amizade!).toBeGreaterThan(PACT_DELTAS.ACORDO.amizade!);
    expect(PACT_DELTAS.ACORDO.comercio!).toBeGreaterThan(PACT_DELTAS.ALIANCA.comercio!);
  });

  // Quebrar custa mais do que firmar rendeu: confiança se perde mais rápido.
  it("cobra a quebra mais caro do que o pacto rendeu", () => {
    for (const tipo of ["ALIANCA", "ACORDO"] as const) {
      expect(Math.abs(PACT_BREAK_DELTAS[tipo].amizade!)).toBeGreaterThan(PACT_DELTAS[tipo].amizade!);
    }
  });
});

describe("o lugar do pacto", () => {
  // O resumo cita números, prazos e mercadorias. Qualquer heurística de
  // "primeira maiúscula" pegaria "Posto" ou "Rota" em vez da sede.
  it("acha a sede citada no resumo", () => {
    expect(placeInSummary(ROTA, SEATS.map((s) => s.seat))).toBe("Raven's Cross");
  });

  // Um acordo cita as duas pontas da rota. Sem excluir a própria capital, o
  // pacto rendia "Entreposto em Solythar" a quem já governa Solythar.
  it("nunca escolhe a capital de quem está aceitando", () => {
    const resumo = "Rota entre Solythar e Ordu-Yildiz, com entreposto no caminho.";
    const sedes = SEATS.map((s) => s.seat);
    // Nos dois sentidos, para não depender de qual nome é mais longo.
    expect(placeInSummary(resumo, sedes, "Solythar")).toBe("Ordu-Yildiz");
    expect(placeInSummary(resumo, sedes, "Ordu-Yildiz")).toBe("Solythar");
  });

  it("devolve null quando nenhuma sede é citada", () => {
    expect(placeInSummary("Trocaremos ferro por grão em algum ponto do caminho.", SEATS.map((s) => s.seat))).toBeNull();
  });
});

describe("o que o pacto deixa no mundo", () => {
  // Um pacto que não deixa nada é uma frase. A embaixada é o que faz o jogador
  // ver na ficha que aquela carta aconteceu.
  it("nomeia embaixada para aliança e entreposto para acordo", () => {
    expect(pactAssetName("ALIANCA", "Raven's Cross")).toBe("Embaixada em Raven's Cross");
    expect(pactAssetName("ACORDO", "Raven's Cross")).toBe("Entreposto em Raven's Cross");
  });

  it("ainda nomeia algo quando o pacto não tem lugar", () => {
    expect(pactAssetName("ALIANCA", null)).toBe("Aliança firmada");
    expect(pactAssetName("ACORDO", "  ")).toBe("Acordo comercial");
  });
});

describe("classificação", () => {
  it("lê aliança no texto e cai em acordo no resto", () => {
    expect(pactKindFor("Aliança de defesa mútua entre as Casas.")).toBe("ALIANCA");
    expect(pactKindFor("Embaixada permanente em Raven's Cross.")).toBe("ALIANCA");
    expect(pactKindFor(ROTA)).toBe("ACORDO");
  });
});

describe("o que pode ser respondido", () => {
  it("só proposta em aberto", () => {
    expect(isAnswerable("PEDIDO", "ATIVO")).toBe(true);
    expect(isAnswerable("PEDIDO", "REVOGADO")).toBe(false);
    expect(isAnswerable("ALIANCA", "ATIVO")).toBe(false);
    expect(isAnswerable("AMEACA", "ATIVO")).toBe(false);
  });
});

describe("o preço político", () => {
  const rels = [
    { fromKey: "casa-valerius", toKey: "casa-drakorys", amizade: 2 },
    { fromKey: "casa-do-ouro", toKey: "casa-drakorys", amizade: 15 },
    { fromKey: "casa-karasoy", toKey: "casa-drakorys", amizade: 50 },
  ];

  // Um teto de pactos seria regra artificial. O limite verdadeiro é que os seus
  // aliados se odeiam: fechar com Krythos afasta a Coroa.
  it("só ofende quem já era inimigo declarado de quem você abraçou", () => {
    const f = politicalFallout("casa-drakorys", "ALIANCA", rels);
    expect(f.map((x) => x.seatKey)).toEqual(["casa-valerius", "casa-do-ouro"]);
    expect(f.map((x) => x.seatKey)).not.toContain("casa-karasoy");
  });

  it("cobra mais caro de quem odeia mais", () => {
    const [valerius, ouro] = politicalFallout("casa-drakorys", "ALIANCA", rels);
    expect(Math.abs(valerius.amizade)).toBeGreaterThan(Math.abs(ouro.amizade));
  });

  // Comerciar não é abraçar: um entreposto custa metade de uma aliança.
  it("cobra metade por acordo comercial", () => {
    const alianca = politicalFallout("casa-drakorys", "ALIANCA", rels)[0].amizade;
    const acordo = politicalFallout("casa-drakorys", "ACORDO", rels)[0].amizade;
    expect(Math.abs(acordo)).toBeLessThan(Math.abs(alianca));
  });

  // Relação intocada é médio, e médio não gera ofensa: uma Casa sem opinião
  // sobre Krythos não se importa que você negocie com Krythos.
  it("não cobra nada quando ninguém declarou inimizade", () => {
    expect(politicalFallout("casa-drakorys", "ALIANCA", [])).toEqual([]);
    expect(politicalFallout("casa-drakorys", "ALIANCA", [{ fromKey: "casa-karasoy", toKey: "casa-drakorys", amizade: 50 }])).toEqual([]);
  });

  it("não faz a própria Casa se ofender consigo mesma", () => {
    const f = politicalFallout("casa-drakorys", "ALIANCA", [{ fromKey: "casa-drakorys", toKey: "casa-drakorys", amizade: 0 }]);
    expect(f).toEqual([]);
  });
});
