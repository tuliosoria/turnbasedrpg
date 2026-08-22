import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES, auditarCarta } from "../../shared/dist/index.js";
import { EFEITOS_NOVOS, migrarProjeto, precisaMigrar } from "./migrar-efeitos-cartas-ativas.mjs";

/** Um projeto como o banco o guarda hoje: sem ganho nenhum. */
function projetoAntigo(over = {}) {
  return {
    SK: "PROJECT#do-ouro-g0gg#u2agb4ksqz",
    title: "Fundar uma Academia de Oficiais",
    templateId: "fundar-uma-academia-de-oficiais",
    status: "ACTIVE",
    durationTurns: 5,
    turnsCompleted: 3,
    costs: [{ type: "WEALTH", timing: "ON_START", amount: 2 }, { type: "RESOURCES", amount: 1, timing: "ON_START" }],
    completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["texto antigo"], unlocks: [] },
    ...over,
  };
}

describe("migrarProjeto", () => {
  it("dá ao projeto o efeito novo", () => {
    const novo = migrarProjeto(projetoAntigo());
    expect(novo.completionEffects.attributeChanges.length).toBeGreaterThan(0);
  });

  it("não encosta no custo, na duração nem no progresso", () => {
    // O jogador já pagou o custo antigo e planejou em cima da duração antiga.
    // Mudar o preço de algo já comprado é quebra de contrato.
    const antes = projetoAntigo();
    const novo = migrarProjeto(antes);
    expect(novo.costs).toEqual(antes.costs);
    expect(novo.durationTurns).toBe(antes.durationTurns);
    expect(novo.turnsCompleted).toBe(antes.turnsCompleted);
    expect(novo.status).toBe(antes.status);
    expect(novo.SK).toBe(antes.SK);
  });

  it("é idempotente", () => {
    const uma = migrarProjeto(projetoAntigo());
    expect(migrarProjeto(uma)).toEqual(uma);
    expect(precisaMigrar(uma)).toBe(false);
  });

  it("reconhece que o projeto antigo ainda precisa migrar", () => {
    expect(precisaMigrar(projetoAntigo())).toBe(true);
  });

  it("recusa projeto que não está no plano, em vez de inventar efeito", () => {
    expect(() => migrarProjeto(projetoAntigo({ SK: "PROJECT#desconhecido", templateId: "nao-existe", title: "Outra Coisa" })))
      .toThrow(/não está no plano de migração/);
  });

  it("cobre as três cartas ativas de produção", () => {
    expect(Object.keys(EFEITOS_NOVOS).sort()).toEqual([
      "PROJECT#do-ouro-g0gg#u2agb4ksqz",
      "PROJECT#khazdrun-wxey#67o2lpv8ea",
      "PROJECT#solarion-k0hc#j1q2uwnwce",
    ]);
  });
});

describe("os efeitos novos respeitam o trato", () => {
  it("cada um cabe na faixa da duração do projeto", () => {
    for (const [sk, def] of Object.entries(EFEITOS_NOVOS)) {
      const problemas = auditarCarta({
        durationTurns: def.durationTurns,
        costs: def.costs,
        completionEffects: def.completionEffects,
      });
      expect(problemas, sk).toEqual([]);
    }
  });

  it("nenhum promete efeito temporário, que o motor descarta", () => {
    for (const [sk, def] of Object.entries(EFEITOS_NOVOS)) {
      const temporarios = def.completionEffects.attributeChanges.filter((c) => !c.permanent);
      expect(temporarios, sk).toEqual([]);
    }
  });

  it("o efeito da carta de biblioteca bate exatamente com o do template", () => {
    // Quem tem templateId deve receber o que a biblioteca passou a oferecer,
    // senão o mesmo projeto vale coisas diferentes para pessoas diferentes.
    for (const [sk, def] of Object.entries(EFEITOS_NOVOS)) {
      if (!def.templateId) continue;
      const t = DEFAULT_PROJECT_TEMPLATES.find((x) => x.id === def.templateId);
      expect(t, sk).toBeDefined();
      expect(def.completionEffects, sk).toEqual(t.completionEffects);
    }
  });

  it("o custo que o script registra é o que o jogador realmente pagou", () => {
    // Se o custo do template mudou no retrofit, herdar o efeito ainda é justo,
    // mas a auditoria precisa julgar contra o custo real do projeto em jogo.
    const academia = EFEITOS_NOVOS["PROJECT#do-ouro-g0gg#u2agb4ksqz"];
    expect(academia.costs.reduce((n, c) => n + c.amount, 0)).toBe(3);
  });
});

describe("precisaMigrar não se engana com a ordem das chaves", () => {
  it("reconhece como igual o objeto que o DynamoDB devolve embaralhado", () => {
    // O DynamoDB não preserva a ordem dos campos. Comparar JSON.stringify cru
    // acusava diferença onde não havia, e o script regravava para sempre.
    const def = EFEITOS_NOVOS["PROJECT#do-ouro-g0gg#u2agb4ksqz"];
    const embaralhado = {
      favors: def.completionEffects.favors,
      unlocks: def.completionEffects.unlocks,
      assets: def.completionEffects.assets,
      qualitativeEffects: def.completionEffects.qualitativeEffects,
      attributeChanges: def.completionEffects.attributeChanges.map((c) => ({
        permanent: c.permanent, attribute: c.attribute, amount: c.amount,
      })),
    };
    expect(precisaMigrar({ SK: "PROJECT#do-ouro-g0gg#u2agb4ksqz", completionEffects: embaralhado })).toBe(false);
  });

  it("ainda enxerga diferença de verdade", () => {
    const def = EFEITOS_NOVOS["PROJECT#do-ouro-g0gg#u2agb4ksqz"];
    const outro = { ...def.completionEffects, assets: ["Outra Coisa"] };
    expect(precisaMigrar({ SK: "PROJECT#do-ouro-g0gg#u2agb4ksqz", completionEffects: outro })).toBe(true);
  });
});
