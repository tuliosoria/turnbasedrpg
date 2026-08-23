/**
 * Quem já morreu nesta campanha.
 *
 * Deliberadamente NÃO faz parte de `characters.ts`. O elenco é cânone do mundo e
 * vale para qualquer mesa; quem está vivo é estado desta partida. Guardar
 * `alive` junto do personagem misturava as duas coisas, e a primeira versão
 * gerada por IA matou Lady Celene Valerius — que aparece viva e agindo no turno
 * 3 — além do líder do Clã Mandíbula, cujas cartas passariam a ser assinadas por
 * um morto.
 *
 * Por isso a morte é derivada em código a partir da crônica pública, nunca
 * decidida pelo modelo: é o tipo de erro que o leitor percebe na primeira linha
 * e que o modelo não tem como perceber sozinho.
 */

/** Palavras que, na mesma frase que um nome, declaram aquela pessoa morta. */
const DEATH_WORDS = /\b(morr\w*|mort\w*|pereceu|falecid\w*|tombou|v[íi]tim\w*|afogad\w*|enterr\w*)\b/i;

/**
 * A unidade de proximidade é a frase, não uma janela de caracteres.
 *
 * Janela errava: "Entre os mortos confirmados estão..." num parágrafo e "Lady
 * Elira Vargen enviou mensageiros" no seguinte ficavam a menos de 200
 * caracteres, e Elira era declarada morta.
 */
const SENTENCE = /[^.!?]+[.!?]?/g;

const TITLES = new Set([
  "lorde", "lady", "senhor", "senhora", "principe", "princesa", "chanceler",
  "farao", "strategos", "pontifice", "trino", "khan", "matriarca", "ser",
  "rei", "rainha", "irma", "irmao", "mestre", "mestra", "capita", "capitao",
]);

export function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O nome próprio da pessoa, sem títulos.
 *
 * O sobrenome sozinho é ambíguo — "Karasoy" nomeia a Casa inteira, e procurar
 * por ele mataria todo mundo da Casa junto com o líder.
 */
export function givenName(name: string): string | null {
  const parts = fold(name).split(/\s+/).filter((w) => w.length >= 4 && !TITLES.has(w));
  return parts[0] ?? null;
}

/** Se a crônica declara esta pessoa morta. */
export function isDeadInChronicle(name: string, chronicle: string): boolean {
  const needle = givenName(name?.trim() ?? "");
  if (!needle || !chronicle) return false;

  // Colapsa a quebra de linha antes de fatiar: a lista de mortos do cânone
  // ocupa duas linhas e uma frase só, e cortar na quebra separava metade dos
  // nomes da palavra que os declara mortos.
  const flat = fold(chronicle).replace(/\s+/g, " ");
  for (const sentence of flat.match(SENTENCE) ?? []) {
    if (sentence.includes(needle) && DEATH_WORDS.test(sentence)) return true;
  }
  return false;
}
