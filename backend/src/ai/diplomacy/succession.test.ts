import { describe, it, expect } from "vitest";
import { leaderIsDead } from "./succession";

// Trecho real do resultado do turno 3.
const CHRONICLE = `## Turno 3
O navio afundou. Alguns passageiros conseguiram sobreviver, mas dezenas morreram.
Entre os mortos confirmados estão Lorde Thrain Khazdrun, senhor de Khar-Durak;
Aylin Karasoy, líder da Casa Karasoy; Theron Drakorys, comandante da delegação.

## Turno 4
Lady Elira Vargen enviou mensageiros pedindo grãos ao sul.`;

describe("leaderIsDead", () => {
  it("reconhece um líder na lista de mortos confirmados", () => {
    // As personas nascem do wiki, anterior à crise. Sem esta checagem, Karasoy
    // assinaria cartas com o nome de quem afundou com a Asteria.
    expect(leaderIsDead("Aylin Karasoy", CHRONICLE)).toBe(true);
    expect(leaderIsDead("Lorde Thrain Khazdrun", CHRONICLE)).toBe(true);
  });

  it("não mata quem só é mencionado", () => {
    expect(leaderIsDead("Lady Elira Vargen", CHRONICLE)).toBe(false);
  });

  it("não confunde a Casa com a pessoa", () => {
    // "Karasoy" nomeia a Casa inteira; só o nome próprio identifica alguém.
    expect(leaderIsDead("Corva Nera Quatro-Estradas", CHRONICLE)).toBe(false);
  });

  it("ignora títulos ao procurar o nome", () => {
    expect(leaderIsDead("Lorde Thrain Khazdrun", CHRONICLE)).toBe(true);
  });

  it("aguenta crônica vazia e nome vazio", () => {
    expect(leaderIsDead("Aylin Karasoy", "")).toBe(false);
    expect(leaderIsDead("", CHRONICLE)).toBe(false);
  });

  it("não marca morte quando a palavra está em outra frase", () => {
    // Janela de caracteres errava aqui: a lista de mortos de um parágrafo
    // contaminava o nome do parágrafo seguinte.
    const other = "Aylin Karasoy assinou o tratado. Muitos morreram no norte.";
    expect(leaderIsDead("Aylin Karasoy", other)).toBe(false);
  });

  it("reconhece a lista de mortos separada por ponto e vírgula", () => {
    // É como o cânone escreve: uma frase só, vários nomes.
    const list = "Entre os mortos confirmados estão Lorde Thrain Khazdrun; Aylin Karasoy; Theron Drakorys.";
    expect(leaderIsDead("Theron Drakorys", list)).toBe(true);
  });
});
