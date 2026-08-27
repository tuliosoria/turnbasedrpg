import { describe, it, expect } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES } from "./projectTemplates.js";
import { auditarCarta, faixaPara } from "./projectBalance.js";
import { ATTRIBUTE_KEYS } from "./types.js";

describe("a biblioteca respeita o trato", () => {
  it("nenhuma carta foge da sua faixa", () => {
    const ruins = DEFAULT_PROJECT_TEMPLATES
      .map((t) => ({ id: t.id, problemas: auditarCarta(t) }))
      .filter((r) => r.problemas.length > 0);
    const relatorio = ruins.map((r) => `  ${r.id}: ${r.problemas.join("; ")}`).join("\n");
    expect(relatorio).toBe("");
  });

  it("toda carta concede alguma coisa", () => {
    const mudas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const e = t.completionEffects;
      if (t.entregaInformacaoPrivada) return false;
      return !e.attributeChanges.length && !e.favors.length && !e.assets.length && !e.unlocks.length;
    });
    expect(mudas.map((t) => t.id)).toEqual([]);
  });

  it("todo desbloqueio aponta para uma carta que existe", () => {
    const ids = new Set(DEFAULT_PROJECT_TEMPLATES.map((t) => t.id));
    const quebrados: string[] = [];
    for (const t of DEFAULT_PROJECT_TEMPLATES) {
      for (const u of t.completionEffects.unlocks) {
        if (!ids.has(u)) quebrados.push(`${t.id} -> ${u}`);
      }
    }
    expect(quebrados).toEqual([]);
  });

  it("nenhuma carta desbloqueia a si mesma", () => {
    const bobas = DEFAULT_PROJECT_TEMPLATES.filter((t) => t.completionEffects.unlocks.includes(t.id));
    expect(bobas.map((t) => t.id)).toEqual([]);
  });
});

/** Qual atributo cada tipo de custo debita. */
const ATRIBUTO_DO_CUSTO: Record<string, string> = {
  WEALTH: "riqueza", RESOURCES: "recursos",
  SOLDIERS_COMMITTED: "soldados", CONTROL_COMMITTED: "controle",
};

function custoTocaAtributo(tipo: string, attr: string): boolean {
  return ATRIBUTO_DO_CUSTO[tipo] === attr;
}

describe("o trato é alcançável de qualquer canto do mapa", () => {
  // Uma Casa que zera um atributo não pode ficar presa nele. Se toda carta que
  // concede Riqueza também custa Riqueza, quem chega a zero nunca mais sobe.
  // Foi exatamente o que aconteceu com a Casa Solarion.
  it.each(ATTRIBUTE_KEYS)("existe carta que dá %s sem cobrar %s", (attr) => {
    const saidas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const da = t.completionEffects.attributeChanges.some((c) => c.permanent && c.attribute === attr && c.amount > 0);
      const cobra = t.costs.some((c) => custoTocaAtributo(c.type, attr) && c.amount > 0);
      return da && !cobra && faixaPara(t.durationTurns).atributoPermanenteMax > 0;
    });
    expect(saidas.map((t) => t.id).length).toBeGreaterThan(0);
  });
});

/**
 * Os estados reais das três Casas em produção, colhidos do DynamoDB. Não é
 * fixture inventada: é o jogo como está. A Solarion com Riqueza 0 é a razão
 * deste bloco existir — ela conseguia iniciar 19 das 65 cartas e nenhuma delas
 * dava recompensa mecânica.
 */
const CASAS_REAIS = [
  { nome: "Do Ouro", attrs: { riqueza: 5, recursos: 1, soldados: 4, controle: 3 }, stability: 3 },
  { nome: "Khazdrun", attrs: { riqueza: 1, recursos: 1, soldados: 3, controle: 1 }, stability: 3 },
  { nome: "Solarion", attrs: { riqueza: 0, recursos: 3, soldados: 1, controle: 2 }, stability: 3 },
];

function podePagar(casa: (typeof CASAS_REAIS)[number], costs: { type: string; amount: number }[]): boolean {
  return costs.every((c) => {
    if (c.type === "STABILITY") return casa.stability >= c.amount;
    const attr = ATRIBUTO_DO_CUSTO[c.type];
    return attr ? (casa.attrs as Record<string, number>)[attr] >= c.amount : true;
  });
}

describe("nenhuma Casa em produção fica sem saída", () => {
  it.each(CASAS_REAIS)("$nome consegue iniciar alguma carta com recompensa", (casa) => {
    const alcancaveis = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
      const daGanho = t.completionEffects.attributeChanges.some((c) => c.permanent && c.amount > 0)
        || t.completionEffects.assets.length > 0;
      return podePagar(casa, t.costs) && daGanho;
    });
    expect(alcancaveis.map((t) => t.id).length).toBeGreaterThan(0);
  });

  it.each(CASAS_REAIS)("$nome tem caminho para subir cada atributo que está em zero", (casa) => {
    const zerados = ATTRIBUTE_KEYS.filter((a) => (casa.attrs as Record<string, number>)[a] === 0);
    for (const attr of zerados) {
      const saidas = DEFAULT_PROJECT_TEMPLATES.filter((t) => {
        const da = t.completionEffects.attributeChanges.some((c) => c.permanent && c.attribute === attr && c.amount > 0);
        return da && podePagar(casa, t.costs);
      });
      expect(saidas.map((t) => t.id), `${casa.nome} preso em ${attr}`).not.toEqual([]);
    }
  });
});
