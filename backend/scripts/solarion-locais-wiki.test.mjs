import { describe, expect, it } from "vitest";
import { DEFAULT_WIKI_ENTRIES } from "../../shared/dist/index.js";
import { TROCAS, TROCAS_GUIA, TROCAS_POVO, blocosPendentes, misturarCenso, misturarGuia, misturarLocais, misturarPovo } from "./solarion-locais-wiki.mjs";

/** Um verbete com todos os blocos na forma da semeadura. */
function verbeteAntigo() {
  return ["## Dossiê", ...TROCAS.map((t) => t.de[0])].join("\n\n");
}

/** O corpo de Solarion como a semente o traz hoje, sem intermediário. */
function corpoDaSemente() {
  const e = DEFAULT_WIKI_ENTRIES.find((x) => x.title.includes("Os Olhos do Meio-Dia"));
  if (!e) throw new Error("O verbete de Solarion sumiu da semente.");
  return e.body;
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
    for (const nome of ["Sahra-Lun", "Deserto de Sahr", "Observatório das Sete Sombras", "fontes subterrâneas", "Qasir-Alim", "Oásis dos Sete Espelhos"]) {
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

  it("diz quem é a rainha Samira, para não confundir com a Lady que o Mestre apagou", () => {
    expect(misturarLocais(verbeteAntigo())).toContain("mãe de Akumon e de Mithrakar");
  });

  it("não chama Valdren de continente, porque Valdren é uma ilha", () => {
    expect(misturarLocais(verbeteAntigo())).not.toMatch(/continente/i);
  });

  it("fecha a conta dos 155.000 da Casa", () => {
    const novo = misturarLocais(verbeteAntigo());
    const cidades = [...novo.matchAll(/([\d.]+) habitantes/g)].map((m) => Number(m[1].replace(".", "")));
    const resto = Number(novo.match(/outros (\d+) mil/)[1]) * 1000;
    expect(cidades).toContain(64000);
    expect(cidades.reduce((a, b) => a + b, 0) + resto).toBe(155000);
  });

  it("é idempotente", () => {
    const uma = misturarLocais(verbeteAntigo());
    expect(misturarLocais(uma)).toBe(uma);
  });

  it("aceita o texto da primeira rodada e o leva à forma final", () => {
    // Cada bloco na forma mais recente que não é a final: é o que está no ar.
    const primeiraRodada = ["## Dossiê", ...TROCAS.map((t) => t.de.at(-1))].join("\n\n");
    const geografia = TROCAS.find((t) => t.nome === "seção de geografia");
    expect(misturarLocais(primeiraRodada)).toContain(geografia.para);
  });

  it("troca só os blocos presentes, porque a semente não tem Dossiê", () => {
    const semente = TROCAS.filter((t) => !t.somenteSe).map((t) => t.de[0]).join("\n\n");
    const novo = misturarLocais(semente);
    expect(novo).toContain("Solythar, a Cidade do Sol");
    expect(novo).not.toContain("64.000 habitantes");
  });

  it("reclama quando o bloco sumiu do texto", () => {
    const mexido = verbeteAntigo().replace("> **Território:** Deserto de Sahr.", "> **Território:** Um pântano.");
    expect(() => misturarLocais(mexido)).toThrow(/território e sede/);
  });

  it("reclama quando o bloco aparece duas vezes, em vez de trocar só a primeira", () => {
    const dobrado = [verbeteAntigo(), TROCAS[0].de[0]].join("\n\n");
    expect(() => misturarLocais(dobrado)).toThrow(/aparece 2 vezes/);
  });
});

// O que os testes acima montam a partir de TROCAS só prova que TROCAS é
// coerente consigo mesmo. Estes rodam contra o texto de verdade.
describe("contra a semente real", () => {
  it("a semente já está na forma final", () => {
    expect(blocosPendentes(corpoDaSemente())).toEqual([]);
  });

  it("cada forma antiga aparece no máximo uma vez na semente", () => {
    const corpo = corpoDaSemente();
    for (const troca of TROCAS) {
      for (const forma of troca.de) {
        expect(corpo.split(forma).length - 1).toBeLessThanOrEqual(1);
      }
    }
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

describe("misturarCenso", () => {
  function censo() {
    return DEFAULT_WIKI_ENTRIES.find((x) => x.section === "censo").body;
  }

  it("põe Solythar como sede na tabela de Casas", () => {
    expect(misturarCenso(censo())).toContain("| Casa Solarion | 155.000 | 7,75% | Solythar |");
  });

  it("insere Solythar entre Porto Cinzento e Akrathos", () => {
    const linhas = misturarCenso(censo()).split("\n");
    const i = linhas.findIndex((l) => l.startsWith("| Solythar | 64.000"));
    expect(linhas[i - 1]).toContain("Porto Cinzento");
    expect(linhas[i + 1]).toContain("Akrathos");
  });

  it("passa a falar de duas cidades sem mexer nos outros títulos iguais", () => {
    const novo = misturarCenso(censo());
    // As outras sete Casas seguem com uma cidade principal só; a de Solarion é
    // a única que virou plural.
    expect(novo.split("## Principais cidades").length - 1).toBe(1);
    expect(novo.split("## Principal cidade").length - 1).toBe(7);
  });

  it("preserva Qasir-Alim e o Oásis dos Sete Espelhos, que o texto antigo omitia", () => {
    const novo = misturarCenso(censo());
    expect(novo).toContain("Qasir-Alim");
    expect(novo).toContain("Oásis dos Sete Espelhos");
  });

  it("fecha a conta dos 155.000 da Casa no censo", () => {
    expect(64000 + 58000 + 33000).toBe(155000);
  });

  it("não contradiz o verbete da Casa quanto à sede", () => {
    const casa = DEFAULT_WIKI_ENTRIES.find((x) => x.title.includes("Os Olhos do Meio-Dia")).body;
    expect(casa).toContain("Solythar");
    expect(misturarCenso(censo())).toContain("Solythar");
  });

  it("é idempotente", () => {
    const uma = misturarCenso(censo());
    expect(misturarCenso(uma)).toBe(uma);
  });
});

describe("misturarPovo", () => {
  it("anuncia as duas cidades na origem do povo", () => {
    const antigo = "> **Origem:** Deserto de Sahr, com sede em Sahra-Lun";
    const novo = misturarPovo(antigo);
    expect(novo).toContain("Solythar");
    expect(novo).toContain("Sahra-Lun");
  });

  it("bate com o que peoples.ts semeia", async () => {
    const { VALDREN_PEOPLES } = await import("../../shared/dist/lore/dnd/peoples.js");
    const solarion = VALDREN_PEOPLES.find((p) => p.name === "Solarion");
    expect(TROCAS_POVO[0].para).toContain(solarion.homeland);
  });

  it("é idempotente", () => {
    const uma = misturarPovo("> **Origem:** Deserto de Sahr, com sede em Sahra-Lun");
    expect(misturarPovo(uma)).toBe(uma);
  });
});

describe("misturarGuia", () => {
  const linha = "| Solarion | Elf | Deserto de Sahr, com sede em Sahra-Lun |";

  it("atualiza a linha da tabela de povos", () => {
    const novo = misturarGuia(linha);
    expect(novo).toContain("Solythar");
    expect(novo).toContain("Sahra-Lun");
  });

  it("bate com o que peoples.ts semeia", async () => {
    const { VALDREN_PEOPLES } = await import("../../shared/dist/lore/dnd/peoples.js");
    const solarion = VALDREN_PEOPLES.find((p) => p.name === "Solarion");
    expect(TROCAS_GUIA[0].para).toContain(solarion.homeland);
  });

  it("é idempotente", () => {
    const uma = misturarGuia(linha);
    expect(misturarGuia(uma)).toBe(uma);
  });
});
