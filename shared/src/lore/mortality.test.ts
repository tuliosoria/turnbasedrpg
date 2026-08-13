import { describe, expect, it } from "vitest";
import { isDeadInChronicle } from "./mortality";

/**
 * Trechos reais da crônica, copiados dos turnos gravados no banco.
 *
 * Não são paráfrases de propósito: a primeira versão deste teste usava um
 * resumo escrito à mão, e a distância entre "Celene" e a palavra de morte
 * saiu maior do que no texto verdadeiro. O teste passava até com uma
 * implementação ingênua de janela de caracteres — a mesma que produziu o bug.
 */
const TURN_1 = [
  "existem relatos de mortos deixando suas sepulturas.",
  "",
  "Um mensageiro de Stonebridge confirmou a chegada de refugiados. Entre eles estava",
  "um soldado reconhecido por seus antigos companheiros como um homem morto e enterrado meses antes.",
  "",
  "Antes de encerrar a assembleia, Celene apresentou uma segunda questão: a coroação",
  "de seu filho Alic, de apenas 12 anos.",
].join("\n");

const TURN_2 = [
  "Os sinos de Asterhall tocaram antes do nascer do sol.",
  "",
  "Não anunciaram morte, ataque ou celebração.",
  "",
  "Convocaram as Casas.",
  "",
  "Quando as grandes portas do Salão Real foram abertas, cada estandarte já ocupava",
  "seu lugar. Representantes de todas as Casas reconhecidas haviam respondido ao chamado de Lady Celene.",
].join("\n");

const TURN_3 = [
  "Alguns passageiros conseguiram sobreviver, mas dezenas morreram era o fim do navio Asteria.",
  "",
  "Entre os mortos confirmados estão Lorde Thrain Khazdrun, senhor de Khar-Durak;",
  "Aylin Karasoy, líder da Casa Karasoy; Theron Drakorys, comandante da delegação de Krythos;",
  "Conde Lucien de Montclair, representante de Auremont; e Prior Severin, uma das",
  "principais vozes da Ordem do Sino.",
].join("\n");

const CHRONICLE = [TURN_1, TURN_2, TURN_3].join("\n\n");

describe("isDeadInChronicle", () => {
  it("reconhece todos os mortos da Asteria", () => {
    for (const name of [
      "Lorde Thrain Khazdrun",
      "Aylin Karasoy",
      "Theron Drakorys",
      "Conde Lucien de Montclair",
      "Prior Severin",
    ]) {
      expect(isDeadInChronicle(name, CHRONICLE), name).toBe(true);
    }
  });

  /**
   * O caso que a geração por IA errou. Celene é a regente: aparece em todos os
   * turnos, e os turnos 1 e 2 mencionam morte a menos de 200 caracteres do nome
   * dela sem que nada disso seja sobre ela.
   */
  it("mantém Lady Celene viva apesar da morte mencionada por perto", () => {
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_1)).toBe(false);
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_2)).toBe(false);
    expect(isDeadInChronicle("Lady Celene Valerius", CHRONICLE)).toBe(false);
  });

  // Procurar pelo sobrenome mataria a Casa inteira junto com o líder.
  it("não mata parentes homônimos do morto", () => {
    expect(isDeadInChronicle("Selim Karasoy", CHRONICLE)).toBe(false);
    expect(isDeadInChronicle("Borin Khazdrun", CHRONICLE)).toBe(false);
  });

  it("ignora títulos ao identificar a pessoa", () => {
    expect(isDeadInChronicle("Thrain", CHRONICLE)).toBe(true);
    expect(isDeadInChronicle("Lady", CHRONICLE)).toBe(false);
  });

  it("é indiferente a acento e caixa", () => {
    expect(isDeadInChronicle("THRAIN KHAZDRÚN", CHRONICLE)).toBe(true);
  });

  it("não morre ninguém sem crônica", () => {
    expect(isDeadInChronicle("Aylin Karasoy", "")).toBe(false);
    expect(isDeadInChronicle("", CHRONICLE)).toBe(false);
  });
});
