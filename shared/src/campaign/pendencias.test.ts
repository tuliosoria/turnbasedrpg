import { describe, expect, it } from "vitest";
import {
  PENDENCIAS_VAZIAS, PENDENCIA_DESTINO, pendenteNaSecao, pendenteNoGrupo, totalPendente,
  type Pendencias,
} from "./pendencias.js";

const cheio: Pendencias = { projetos: 2, canonico: 1, espioes: 3, rascunho: 1, porto: 1, resolucao: 4 };

describe("o que está esperando o Mestre", () => {
  it("soma tudo que trava alguém", () => {
    expect(totalPendente(cheio)).toBe(12);
  });

  // Uma faixa que diz "0 pendências" ocupa o topo todo dia sem informar nada, e
  // ensina o olho a pular a região onde o aviso de verdade vai aparecer.
  it("é zero quando não há nada, para o aviso poder sumir", () => {
    expect(totalPendente(PENDENCIAS_VAZIAS)).toBe(0);
  });

  it("agrupa o que pertence a cada grupo de abas", () => {
    // Turno: resolução, rascunho e Porto.
    expect(pendenteNoGrupo(cheio, "turno")).toBe(4 + 1 + 1);
    // Casas: projetos e espiões.
    expect(pendenteNoGrupo(cheio, "casas")).toBe(2 + 3);
    expect(pendenteNoGrupo(cheio, "mundo")).toBe(1);
    expect(pendenteNoGrupo(cheio, "sistema")).toBe(0);
  });

  it("desce até a seção, para a segunda fileira também avisar", () => {
    expect(pendenteNaSecao(cheio, "mundo", "canonico")).toBe(1);
    expect(pendenteNaSecao(cheio, "mundo", "biblia")).toBe(0);
    expect(pendenteNaSecao(cheio, "casas", "casas")).toBe(2 + 3);
  });

  it("todo tipo de pendência sabe para onde levar o Mestre", () => {
    for (const chave of Object.keys(PENDENCIAS_VAZIAS) as (keyof Pendencias)[]) {
      expect(PENDENCIA_DESTINO[chave], chave).toBeTruthy();
      expect(PENDENCIA_DESTINO[chave].label(1).length, chave).toBeGreaterThan(3);
    }
  });

  it("o rótulo concorda em número", () => {
    expect(PENDENCIA_DESTINO.projetos.label(1)).toContain("projeto ");
    expect(PENDENCIA_DESTINO.projetos.label(3)).toContain("projetos");
  });
});
