import { describe, expect, it } from "vitest";
import { finalAgreement, letterEvidence, safeSignature } from "./grounding";
import type { WorldFact } from "@ravenloft/content";

describe("fontes de uma carta", () => {
  it("mostra origem do fato público e não vaza o privado", () => {
    const fact = { id: "marcha-7", turnNumber: 7, parties: ["casa-khazdrun"], visibility: "PUBLICO", status: "ATIVO",
      summary: "Khazdrun enviou cem combatentes.", quote: "Khazdrun mandou cem combatentes para a Marcha.", createdAt: "2026-01-01" } as WorldFact;
    const text = letterEvidence([fact, { ...fact, id: "segredo", visibility: "casa-khazdrun", summary: "Espiões em Ferrum." }], ["casa-khazdrun"]);
    expect(text).toContain("marcha-7");
    expect(text).toContain("Khazdrun mandou cem combatentes");
    expect(text).not.toContain("Espiões");
  });
});

describe("registro da carta final", () => {
  it("não transforma proposta unilateral em aliança firmada", () => {
    expect(finalAgreement({ tipo: "ALIANCA", resumo: "Aliança de defesa em Raven's Cross" }, "Proponho aliança de defesa em Raven's Cross."))
      .toEqual({ tipo: "PEDIDO", resumo: "Aliança de defesa em Raven's Cross" });
  });

  it("não grava quantidade inventada na extração do revisor", () => {
    expect(finalAgreement({ tipo: "PEDIDO", resumo: "Envio de 300 cavaleiras" }, "Podemos enviar cavaleiras."))
      .toBeNull();
    expect(finalAgreement({ tipo: "PEDIDO", resumo: "Envio de madeira por trigo" }, "Proponho enviar cavaleiras para a fronteira."))
      .toBeNull();
    expect(finalAgreement({ tipo: "PEDIDO", resumo: "Envio de 30 cavaleiras" }, "Podemos enviar 300 cavaleiras."))
      .toBeNull();
  });

  it("substitui assinatura de pessoa não registrada, preservando nome canônico", () => {
    expect(safeSignature("Aceitamos conversar.\n— Gharun Casco-Negro", ["Lady Miriel Ferrumor"], "Casa Ferrumor"))
      .toBe("Aceitamos conversar.\n— Pela chancelaria de Casa Ferrumor");
    expect(safeSignature("Aceitamos conversar.\n— Lady Miriel Ferrumor", ["Lady Miriel Ferrumor"], "Casa Ferrumor"))
      .toContain("— Lady Miriel Ferrumor");
    expect(safeSignature("Aceitamos conversar.\n— Inventado", ["Selma"], "Casa Karasoy", "Selma"))
      .toBe("Aceitamos conversar.\n— Selma");
  });
});
