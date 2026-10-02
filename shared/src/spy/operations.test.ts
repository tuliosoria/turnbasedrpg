import { describe, expect, it } from "vitest";
import {
  SPY_LEVELS,
  SPY_TIERS,
  canAffordSpy,
  isSpyLevel,
  spyCost,
  tierOf,
} from "./operations.js";

describe("os níveis", () => {
  // Se pagar mais fosse só melhor, não haveria decisão: todo mundo pagaria o
  // máximo que coubesse. O teto sobe junto com a gravidade do fracasso.
  it("encarece conforme sobe", () => {
    const custos = SPY_LEVELS.map((l) => spyCost(l).recursos + spyCost(l).riqueza * 2);
    expect(custos).toEqual([...custos].sort((a, b) => a - b));
    expect(custos[0]).toBeLessThan(custos[custos.length - 1]);
  });

  it("agrava o fracasso conforme sobe: dinheiro, depois exposição, depois o agente", () => {
    expect(SPY_TIERS.BOCA.seDerErrado).toMatch(/boato|errada/i);
    expect(SPY_TIERS.TESTEMUNHA.seDerErrado).toMatch(/o alvo fica sabendo/i);
    expect(SPY_TIERS.PROVA.seDerErrado).toMatch(/agente é pego|traição/i);
  });

  it("melhora a recompensa conforme sobe: direção, detalhe, prova", () => {
    expect(SPY_TIERS.BOCA.seDerCerto).toMatch(/sem nome, sem data/i);
    expect(SPY_TIERS.TESTEMUNHA.seDerCerto).toMatch(/nome, uma data, um número/i);
    expect(SPY_TIERS.PROVA.seDerCerto).toMatch(/acusação/i);
  });

  // Risco escondido é armadilha, não escolha: os dois lados existem em todos.
  it("declara os dois lados em todos os níveis", () => {
    for (const l of SPY_LEVELS) {
      expect(tierOf(l).seDerCerto.trim()).not.toBe("");
      expect(tierOf(l).seDerErrado.trim()).not.toBe("");
    }
  });
});

describe("canAffordSpy", () => {
  // Recusar depois de gravar cobraria por uma operação que não aconteceu.
  it("barra quem não tem Recursos, dizendo quanto falta", () => {
    const r = canAffordSpy({ riqueza: 5, recursos: 1 }, "TESTEMUNHA");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/custa 2 e sua Casa tem 1/);
  });

  it("barra quem não tem Riqueza no nível que a exige", () => {
    expect(canAffordSpy({ riqueza: 0, recursos: 5 }, "PROVA").ok).toBe(false);
    expect(canAffordSpy({ riqueza: 0, recursos: 5 }, "TESTEMUNHA").ok).toBe(true);
  });

  it("deixa passar quem pode pagar", () => {
    expect(canAffordSpy({ riqueza: 1, recursos: 2 }, "PROVA")).toEqual({ ok: true });
  });
});

describe("isSpyLevel", () => {
  it("aceita só os níveis conhecidos", () => {
    expect(isSpyLevel("PROVA")).toBe(true);
    expect(isSpyLevel("LENDA")).toBe(false);
    expect(isSpyLevel(3)).toBe(false);
  });
});
