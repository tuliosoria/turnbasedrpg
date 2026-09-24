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
 * A unidade de proximidade é a frase, não uma janela de caracteres — e os
 * dois-pontos também fecham frase, junto com `.!?`.
 *
 * Janela errava: "Entre os mortos confirmados estão..." num parágrafo e "Lady
 * Elira Vargen enviou mensageiros" no seguinte ficavam a menos de 200
 * caracteres, e Elira era declarada morta.
 *
 * O motivo de incluir `:` veio depois, do Turno 1 de verdade: "Lady Celene
 * apresentou mensagens preocupantes vindas do Norte: A cidade de Rimewatch
 * deixou de responder, [...] e existem relatos de mortos deixando suas
 * sepulturas." é UMA frase em português — só fecha no ponto final. Celene é
 * quem relata a notícia do Norte, não quem morreu, e o nome dela fica antes
 * dos dois-pontos enquanto "mortos" vem só no conteúdo do que ela relatou.
 * Cortar ali separa quem fala do que foi dito. Isso não quebra a lista de
 * mortos da Asteria, que não tem dois-pontos: o texto que introduz a lista
 * ("Entre os mortos confirmados estão") e os nomes ficam do mesmo lado.
 */
const SENTENCE = /[^.!?:]+[.!?:]?/g;

/**
 * "NOME" logo depois de "de " é posse, não sujeito: "os orcs DE Thorgul que
 * morriam" mata a tropa dele, não Thorgul — ele segue vivo e lidera o
 * assalto a Asterhall no turno seguinte. Sem este filtro, qualquer frase que
 * atribua uma perda a alguém ("as tropas de X", "os homens de X") declarava
 * X morto pelo mero fato de ser dono de quem morreu.
 */
function possessiveOf(needle: string): RegExp {
  return new RegExp(`\\bde\\s+${needle}\\b`, "g");
}

const TITLES = new Set([
  "lorde", "lady", "senhor", "senhora", "principe", "princesa", "chanceler",
  "farao", "strategos", "pontifice", "trino", "khan", "matriarca", "ser",
  "rei", "rainha", "irma", "irmao", "mestre", "mestra", "capita", "capitao",
  // O bloco abaixo entrou tarde e custou caro. Faltando aqui, o título vira a
  // "identidade" da pessoa: "Dama Elara Voss" era procurada por "dama" — e como
  // três pessoas do elenco começam assim, o termo saía disputado e as três
  // sumiam. "Lord Aelric Roderic" era pior: só existe um, então nada acusava o
  // conflito e a palavra "Lord" no meio de qualquer frase virava link para ele.
  //
  // A lista tem títulos que o elenco ainda não usa. Um honorífico nunca é o
  // nome próprio de ninguém, então incluí-lo cedo não custa nada e evita que o
  // próximo Conde entre pelo mesmo buraco.
  "dama", "lord", "duque", "duquesa", "conde", "condessa", "barao", "baronesa",
  "padre", "padre-contador", "madre", "patriarca", "abade", "abadessa",
  "almirante", "general", "comandante", "sacerdote", "sacerdotisa",
  "sra.", "sra", "srta.", "srta", "doutor", "doutora",
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

/**
 * O nome sem títulos, para decidir se dois registros são a MESMA pessoa.
 *
 * O codex lista Alic duas vezes — "Príncipe Alic Valerius" pela Casa e "Alic
 * Valerius" pela Coroa. São a mesma pessoa, mas para quem só compara strings
 * pareciam duas, e o nome próprio delas era descartado por ambiguidade.
 */
export function nameKey(name: string): string {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w))
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Se a crônica declara esta pessoa morta. */
export function isDeadInChronicle(name: string, chronicle: string): boolean {
  const needle = givenName(name?.trim() ?? "");
  if (!needle || !chronicle) return false;

  const escaped = escapeRegExp(needle);
  // Fronteira de palavra: "kael" é o nome próprio de Ser Kael Rimerberg, mas
  // "kaelen" (Kaelen Drakorys, outra pessoa) CONTÉM "kael" como substring.
  // Sem \b, a máquina de Kaelen subindo o rio no Turno 10 matava Rimerberg
  // num turno em que o sobrenome dele nunca aparece.
  const nameHit = new RegExp(`\\b${escaped}\\b`);

  // Colapsa a quebra de linha antes de fatiar: a lista de mortos do cânone
  // ocupa duas linhas e uma frase só, e cortar na quebra separava metade dos
  // nomes da palavra que os declara mortos.
  const flat = fold(chronicle).replace(/\s+/g, " ");
  for (const sentence of flat.match(SENTENCE) ?? []) {
    // Tira as menções possessivas ("de Thorgul") antes de checar se o nome
    // aparece: se sobrar alguma menção fora desse padrão, ainda conta.
    const withoutPossessive = sentence.replace(possessiveOf(escaped), "");
    if (nameHit.test(withoutPossessive) && DEATH_WORDS.test(sentence)) return true;
  }
  return false;
}
