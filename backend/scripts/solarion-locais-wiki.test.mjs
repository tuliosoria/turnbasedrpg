import { describe, expect, it } from "vitest";
import { TROCAS, blocosPendentes, misturarLocais } from "./solarion-locais-wiki.mjs";

/** Um verbete com todos os blocos na forma antiga, como o publicado hoje. */
function verbeteAntigo() {
  return ["## Dossiê", ...TROCAS.map((t) => t.de)].join("\n\n");
}

describe("misturarLocais", () => {
  it("traz os locais que o jogador escreveu", () => {
    const novo = misturarLocais(verbeteAntigo());
    for (const nome of ["Solythar", "Nayrath", "Kha'Zer", "Nahr'Zul", "Nymara", "Nayren", "Athon", "Esfinge", "Setas"]) {
      expect(novo).toContain(nome);
    }
  });

  it("preserva os locais que o Mestre escreveu", () => {
    const novo = misturarLocais(verbeteAntigo());
    for (const nome of ["Sahra-Lun", "Deserto de Sahr", "Observatório das Sete Sombras", "fontes subterrâneas"]) {
      expect(novo).toContain(nome);
    }
  });

  it("liga os dois mapas pelo mito que o jogador propôs", () => {
    const novo = misturarLocais(verbeteAntigo());
    // A Deusa recolheu as águas: é o que explica um deserto com rios mortos e
    // água escondida embaixo. Sem essa frase a mistura vira duas listas.
    expect(novo).toContain("recolheu suas águas da terra");
    expect(novo).toContain("o mesmo rio enterrado");
  });

  it("mantém Solythar dentro do censo de 155.000", () => {
    const novo = misturarLocais(verbeteAntigo());
    const habitantes = [...novo.matchAll(/([\d.]+) habitantes/g)].map((m) => Number(m[1].replace(".", "")));
    expect(habitantes).toContain(64000);
    expect(habitantes.reduce((a, b) => a + b, 0)).toBeLessThan(155000);
  });

  it("é idempotente", () => {
    const uma = misturarLocais(verbeteAntigo());
    expect(misturarLocais(uma)).toBe(uma);
  });

  it("troca só os blocos presentes, porque a semente não tem Dossiê", () => {
    const semente = TROCAS.filter((t) => !t.somenteSe).map((t) => t.de).join("\n\n");
    const novo = misturarLocais(semente);
    expect(novo).toContain("Solythar, a Cidade do Sol");
    expect(novo).not.toContain("64.000 habitantes");
  });

  it("reclama quando o bloco sumiu do texto", () => {
    const mexido = verbeteAntigo().replace("> **Território:** Deserto de Sahr.", "> **Território:** Um pântano.");
    expect(() => misturarLocais(mexido)).toThrow(/território e sede/);
  });

  it("não deixa nenhum bloco com o mesmo texto de outro", () => {
    const nomes = new Set(TROCAS.map((t) => t.de));
    expect(nomes.size).toBe(TROCAS.length);
  });
});

describe("blocosPendentes", () => {
  it("lista tudo num verbete que ainda não foi tocado", () => {
    expect(blocosPendentes(verbeteAntigo())).toHaveLength(TROCAS.length);
  });

  it("não lista nada depois da mistura", () => {
    expect(blocosPendentes(misturarLocais(verbeteAntigo()))).toEqual([]);
  });
});
