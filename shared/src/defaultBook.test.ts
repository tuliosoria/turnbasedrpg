import { describe, expect, it } from "vitest";
import { DEFAULT_BOOK_CHAPTERS } from "./defaultBook.js";

/**
 * O corte da Coroa é segredo do Mestre.
 *
 * `livro/ESTRUTURA.md` e `valdren-context/MESTRE/15` já registram o erro:
 * os Ulgar conhecem o sintoma, não a causa, e a palavra "coroa" como o que
 * se destrói antes de Alic ser coroado ainda não é pública. O seed do romance
 * só pode carregar o que o compilador marca como publicado.
 */
const CORTE_DA_COROA = [
  /única coisa que corta a fome/i,
  /destruir a coroa antes/i,
  /se consumar sobre a cabeça de alic/i,
  /a raiz é a coroa/i,
  /destruir uma coroa/i,
  /chegar à coroa antes/i,
  /coroa antes da coroação/i,
  /não destruir a coroa/i,
  /íamos destruir/i,
  /foi preciso destruí-la/i,
  /cortando a raiz de uma fome/i,
  /destruir a coroa não sai de graça/i,
  /a raiz fora cortada/i,
  /enquanto ele não a desejasse por inteiro/i,
  /rei branco/i,
];

describe("defaultBook", () => {
  it("não semeia o corte da Coroa", () => {
    const texto = DEFAULT_BOOK_CHAPTERS.map((c) => `${c.title}\n${c.body}`).join("\n");
    const vazou = CORTE_DA_COROA.filter((re) => re.test(texto)).map((re) => re.source);
    expect(vazou).toEqual([]);
  });

  it("só carrega capítulos publicados", () => {
    const rascunhos = DEFAULT_BOOK_CHAPTERS.filter((c) => c.status !== "publicado").map((c) => c.chapterId);
    expect(rascunhos).toEqual([]);
  });
});
