import { describe, expect, it } from "vitest";
import { parseEnergiaBody } from "./schemas";

describe("parseEnergiaBody", () => {
  it("aceita um mapa de carta para pontos", () => {
    expect(parseEnergiaBody({ porProjeto: { abc: 2, def: 1 } })).toEqual({ porProjeto: { abc: 2, def: 1 } });
  });

  it("aceita mapa vazio", () => {
    expect(parseEnergiaBody({ porProjeto: {} })).toEqual({ porProjeto: {} });
  });

  it("recusa quando não é objeto", () => {
    expect(() => parseEnergiaBody({ porProjeto: "tudo" })).toThrow();
  });

  it("recusa pontos que não são número", () => {
    expect(() => parseEnergiaBody({ porProjeto: { abc: "dois" } })).toThrow();
  });

  it("recusa valor quebrado, para o erro sair como corpo inválido e não como conflito", () => {
    expect(() => parseEnergiaBody({ porProjeto: { abc: 1.5 } })).toThrow();
  });

  it("recusa valor negativo", () => {
    expect(() => parseEnergiaBody({ porProjeto: { abc: -1 } })).toThrow();
  });

  it("recusa infinito", () => {
    expect(() => parseEnergiaBody({ porProjeto: { abc: Infinity } })).toThrow();
  });

  it("recusa mais chaves do que uma Casa poderia ter", () => {
    const grande: Record<string, number> = {};
    for (let i = 0; i < 50; i++) grande[`p${i}`] = 1;
    expect(() => parseEnergiaBody({ porProjeto: grande })).toThrow();
  });
});
