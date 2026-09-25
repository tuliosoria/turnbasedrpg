import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProjectCard } from "@ravenloft/content";
import { previaDoFechamento, cartasParaRevelar, lerVistoEm, gravarVistoEm, EVENTO_REVELACAO } from "./previa";

const ativa = (turnsCompleted: number, durationTurns: number) =>
  ({ status: "ACTIVE", turnsCompleted, durationTurns }) as const;

describe("previaDoFechamento", () => {
  it("sem Energia, a carta anda o passo grátis", () => {
    expect(previaDoFechamento(ativa(1, 5), 0)).toEqual({ andadas: 1, gratis: 1, comEnergia: 0, depois: 2, total: 5, conclui: false });
  });

  it("Energia soma passos além do grátis", () => {
    expect(previaDoFechamento(ativa(1, 5), 2)).toMatchObject({ gratis: 1, comEnergia: 2, depois: 4, conclui: false });
  });

  it("0 de 1: conclui sozinha, e Energia não compra nada", () => {
    expect(previaDoFechamento(ativa(0, 1), 2)).toEqual({ andadas: 0, gratis: 1, comEnergia: 0, depois: 1, total: 1, conclui: true });
  });

  it("nunca passa do total", () => {
    expect(previaDoFechamento(ativa(3, 5), 3)).toMatchObject({ comEnergia: 1, depois: 5, conclui: true });
  });

  it("pausada não anda", () => {
    expect(previaDoFechamento({ status: "PAUSED", turnsCompleted: 1, durationTurns: 3 }, 2))
      .toEqual({ andadas: 1, gratis: 0, comEnergia: 0, depois: 1, total: 3, conclui: false });
  });
});

const resolvida = (id: string, status: "COMPLETED" | "FAILED", resolvedAt: string | null) =>
  ({ id, status, resolvedAt }) as unknown as ProjectCard;

describe("cartasParaRevelar", () => {
  const cartas = [
    resolvida("velha", "COMPLETED", "2026-09-18T14:00:00.000Z"),
    resolvida("b", "FAILED", "2026-09-23T14:06:03.100Z"),
    resolvida("a", "COMPLETED", "2026-09-23T14:06:02.900Z"),
    resolvida("sem-data", "COMPLETED", null),
    { id: "ativa", status: "ACTIVE", resolvedAt: null } as unknown as ProjectCard,
  ];

  it("com vistoEm, revela só o que foi resolvido depois, em ordem", () => {
    expect(cartasParaRevelar(cartas, "2026-09-20T00:00:00.000Z").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("sem vistoEm, revela só o último fechamento — não a campanha inteira", () => {
    expect(cartasParaRevelar(cartas, null).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("carta antiga sem resolvedAt fica de fora, sem erro", () => {
    expect(cartasParaRevelar([resolvida("sem-data", "FAILED", null)], null)).toEqual([]);
  });

  it("nada novo depois do visto: lista vazia", () => {
    expect(cartasParaRevelar(cartas, "2026-09-24T00:00:00.000Z")).toEqual([]);
  });
});

describe("vistoEm no aparelho", () => {
  beforeEach(() => localStorage.clear());

  it("grava, lê e avisa a tela", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_REVELACAO, ouvinte);
    gravarVistoEm("casa-x", "2026-09-23T14:06:03.100Z");
    expect(lerVistoEm("casa-x")).toBe("2026-09-23T14:06:03.100Z");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_REVELACAO, ouvinte);
  });

  it("sem storage, não quebra: lê null e grava nada", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(lerVistoEm("casa-x")).toBeNull();
    expect(() => gravarVistoEm("casa-x", "2026-09-23T00:00:00.000Z")).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});
