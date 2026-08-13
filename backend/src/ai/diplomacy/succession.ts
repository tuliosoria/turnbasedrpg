import { fold } from "../visual/canonLookup";

/** Palavras que, perto de um nome, indicam que aquela pessoa morreu. */
const DEATH_WORDS = /\b(morr\w*|mort\w*|pereceu|falecid\w*|tombou|v[íi]tim\w*|afogad\w*|enterr\w*)\b/i;

/**
 * A unidade de proximidade é a frase, não uma janela de caracteres.
 *
 * Janela errava: "Entre os mortos confirmados estão..." num parágrafo e "Lady
 * Elira Vargen enviou mensageiros" no seguinte ficavam a menos de 200
 * caracteres, e Elira era declarada morta. A lista de mortos é uma frase só,
 * separada por ponto e vírgula, então a frase é o limite natural.
 */
const SENTENCE = /[^.!?]+[.!?]?/g;

/**
 * Descobre se o líder canônico de uma Casa morreu no que já aconteceu na
 * campanha.
 *
 * As personas nascem do wiki, que descreve Valdren antes da crise. A campanha
 * seguiu: a Asteria afundou no turno 3 levando Lorde Thrain Khazdrun e Aylin
 * Karasoy. Sem esta checagem, Karasoy assinaria cartas com o nome de alguém que
 * morreu afogado, e o erro apareceria já na primeira linha.
 *
 * Feito em código e não deixado a cargo do modelo: um nome de morto assinando
 * uma carta é o tipo de erro que destrói a ilusão inteira, e o modelo pode
 * simplesmente não reparar.
 */
export function leaderIsDead(leaderName: string, chronicle: string): boolean {
  const name = leaderName.trim();
  if (!name || !chronicle) return false;

  // O sobrenome sozinho é ambíguo — "Karasoy" nomeia a Casa inteira. Procura
  // pelo nome próprio, que é o que identifica a pessoa.
  const parts = fold(name).split(/\s+/).filter((w) => w.length >= 4 && !TITLES.has(w));
  if (!parts.length) return false;
  const needle = parts[0];

  // Colapsa a quebra de linha antes de fatiar: a lista de mortos do cânone
  // ocupa duas linhas e uma frase só, e cortar na quebra separava metade dos
  // nomes da palavra que os declara mortos.
  const flat = fold(chronicle).replace(/\s+/g, " ");
  for (const sentence of flat.match(SENTENCE) ?? []) {
    if (sentence.includes(needle) && DEATH_WORDS.test(sentence)) return true;
  }
  return false;
}

const TITLES = new Set([
  "lorde", "lady", "senhor", "senhora", "principe", "princesa", "chanceler",
  "farao", "strategos", "pontifice", "trino", "khan", "matriarca", "ser", "rei", "rainha",
]);
