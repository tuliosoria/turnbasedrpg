import { describe, it, expect } from "vitest";
import { TABELA_DE_TROCA, faixaPara, auditarCarta, resumoDoGanho } from "./projectBalance.js";
import type { ProjectTemplate } from "./projects.js";

/** Uma carta mínima e válida, para os testes mexerem só no que interessa. */
function carta(over: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    id: "carta-de-teste",
    title: "Carta de Teste",
    category: "MILITARY",
    durationTurns: 3,
    costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
    requirements: [],
    description: "Uma carta para testar.",
    completionEffects: {
      attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    },
    risks: ["um risco"],
    requiresTargetApproval: false,
    requiresGmApproval: false,
    ...over,
  } as ProjectTemplate;
}

describe("TABELA_DE_TROCA", () => {
  it("cobre de 1 a 5 turnos sem buraco", () => {
    expect(TABELA_DE_TROCA.map((f) => f.turnos)).toEqual([1, 2, 3, 4, 5]);
  });

  it("não dá atributo permanente abaixo de 3 turnos", () => {
    expect(faixaPara(1).atributoPermanenteMax).toBe(0);
    expect(faixaPara(2).atributoPermanenteMax).toBe(0);
  });

  it("segue a decisão do Mestre: +1 em 3 turnos, +2 em 4 e 5", () => {
    expect(faixaPara(3).atributoPermanenteMax).toBe(1);
    expect(faixaPara(4).atributoPermanenteMax).toBe(2);
    expect(faixaPara(5).atributoPermanenteMax).toBe(2);
  });

  it("a carta longa nunca oferece menos que a curta", () => {
    // Sem isto, o desempate da spec (2.1) se desfaz sem ninguém notar e as
    // cartas de 4 e 5 turnos viram lixo mecânico.
    for (let t = 2; t <= 5; t++) {
      expect(faixaPara(t).atributoPermanenteMax).toBeGreaterThanOrEqual(faixaPara(t - 1).atributoPermanenteMax);
      expect(faixaPara(t).custoMax).toBeGreaterThanOrEqual(faixaPara(t - 1).custoMax);
    }
  });

  it("trata duração acima de 5 como a faixa mais alta", () => {
    expect(faixaPara(9)).toBe(faixaPara(5));
  });
});

describe("auditarCarta", () => {
  it("aprova uma carta dentro da faixa", () => {
    expect(auditarCarta(carta())).toEqual([]);
  });

  it("reprova carta sem ganho nenhum", () => {
    const muda = carta({
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["só sabor"], unlocks: [] },
    });
    expect(auditarCarta(muda)).toContain("não concede ganho nenhum");
  });

  it("reprova atributo permanente acima do que a duração permite", () => {
    const forte = carta({
      durationTurns: 3,
      completionEffects: {
        attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(auditarCarta(forte)).toContain("concede +2 em soldados, mas 3 turnos permitem no máximo +1");
  });

  it("reprova atributo permanente em carta curta demais", () => {
    const cedo = carta({ durationTurns: 2 });
    expect(auditarCarta(cedo)).toContain("concede +1 em soldados, mas 2 turnos permitem no máximo +0");
  });

  it("reprova custo fora da faixa", () => {
    const cara = carta({ durationTurns: 3, costs: [{ type: "WEALTH", amount: 4, timing: "ON_START" }] });
    expect(auditarCarta(cara)).toContain("custa 4 no total, mas 3 turnos pedem entre 1 e 2");
  });

  it("reprova efeito temporário, que o motor descarta em silêncio", () => {
    const temp = carta({
      completionEffects: {
        attributeChanges: [{ attribute: "soldados", amount: 1, permanent: false }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(auditarCarta(temp)).toContain("promete efeito temporário em soldados, e o motor só aplica permanentes");
  });

  it("aceita Estabilidade em carta curta, que a tabela permite", () => {
    const festa = carta({
      durationTurns: 1,
      costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
      completionEffects: {
        attributeChanges: [{ attribute: "stability", amount: 1, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(auditarCarta(festa)).toEqual([]);
  });

  it("mas nem a Estabilidade escapa do limite numa carta curta", () => {
    const demais = carta({
      durationTurns: 1,
      costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
      completionEffects: {
        attributeChanges: [{ attribute: "stability", amount: 2, permanent: true }],
        favors: [], assets: [], qualitativeEffects: [], unlocks: [],
      },
    });
    expect(auditarCarta(demais)).toContain("concede +2 em stability, mas 1 turnos permitem no máximo +1");
  });

  it("aceita carta curta que paga em ativo e desbloqueio", () => {
    const curta = carta({
      durationTurns: 2,
      costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
      completionEffects: {
        attributeChanges: [], favors: [], assets: ["Rede de Batedores"],
        qualitativeEffects: [], unlocks: ["criar-uma-rede-de-espioes"],
      },
    });
    expect(auditarCarta(curta)).toEqual([]);
  });
});

describe("resumoDoGanho", () => {
  it("escreve o atributo com sinal", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Soldados +2 permanente");
  });

  it("junta as moedas com separador", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "riqueza", amount: 1, permanent: true }],
      favors: [], assets: ["Estaleiro"], qualitativeEffects: [], unlocks: ["expandir-a-frota"],
    })).toBe("Riqueza +1 permanente · Ativo: Estaleiro · Abre 1 carta nova");
  });

  it("nunca devolve vazio, porque a tela precisa escrever alguma coisa", () => {
    expect(resumoDoGanho({
      attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Sem ganho mecânico");
  });

  it("escreve estabilidade negativa sem inventar sinal", () => {
    expect(resumoDoGanho({
      attributeChanges: [{ attribute: "stability", amount: -1, permanent: true }],
      favors: [], assets: [], qualitativeEffects: [], unlocks: [],
    })).toBe("Estabilidade -1 permanente");
  });
});

describe("pagar em informação", () => {
  /**
   * O Porto entrega um briefing privado no turno seguinte, e nada mais. Sem
   * esta ressalva o auditor acusaria de vazia uma carta que cumpre exatamente
   * o que promete — e a saída seria inventar um ativo falso na ficha da Casa.
   */
  it("uma carta que entrega informação privada não é acusada de vazia", () => {
    const carta = {
      id: "compra-de-rumor",
      title: "Compra de Rumor",
      category: "INTELLIGENCE" as const,
      durationTurns: 1,
      costs: [{ type: "RESOURCES" as const, amount: 1, timing: "ON_START" as const }],
      requirements: [],
      description: "",
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
      risks: [],
      requiresTargetApproval: false,
      requiresGmApproval: false,
      entregaInformacaoPrivada: true,
    };

    expect(auditarCarta(carta)).not.toContain("não concede ganho nenhum");
    expect(auditarCarta({ ...carta, entregaInformacaoPrivada: false })).toContain("não concede ganho nenhum");
  });
});

describe("resumoDoGanho com informação", () => {
  const vazio = { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] };

  it("anuncia a informação em vez de dizer que não há ganho", () => {
    expect(resumoDoGanho(vazio, true)).toBe("Informação privada no próximo turno");
    expect(resumoDoGanho(vazio)).toBe("Sem ganho mecânico");
  });
});
