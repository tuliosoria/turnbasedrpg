import { construirDetector, corpusDoCanone, type Detector } from "@ravenloft/content";

let memo: Detector | null = null;

/**
 * O detector de nomes, construído uma vez por aba do navegador.
 *
 * Montá-lo varre o cânone inteiro para decidir o que é nome próprio e o que é
 * palavra comum, e o resultado não muda enquanto a página vive. Fazer isso a
 * cada parágrafo renderizado seria desperdício puro.
 *
 * Usa o corpus estático, não a wiki: uma carta precisa saber quem é "Elara"
 * antes de qualquer requisição terminar, e cartas aparecem em telas que nunca
 * carregam verbetes.
 */
export function detectorDoCanone(): Detector {
  return (memo ??= construirDetector(corpusDoCanone()));
}
