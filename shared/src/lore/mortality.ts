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
 *
 * Cortar frase também no ":" foi tentado e revertido: a lista de mortos real
 * às vezes usa dois-pontos em vez de "estão" ("Entre os mortos confirmados:
 * Lorde Thrain Khazdrun; ...", 7 ocorrências em publico/cronica.md e 15 em
 * mestre/cronica.md), e cortar ali separava a palavra de morte, à esquerda,
 * dos nomes, à direita — ninguém era encontrado morto. Dois-pontos agora é
 * tratado como DIREÇÃO dentro da frase (ver isDeadInChronicle), não como fim
 * dela.
 */
const SENTENCE = /[^.!?]+[.!?]?/g;

/**
 * Substantivos que, logo antes de "de/do/da/dos/das <nome>", significam que
 * a morte É da pessoa nomeada: "a morte de Thrain", "o corpo de Aylin", "o
 * cadáver de Theron enterrado". Em português este é o jeito mais comum de
 * anunciar uma morte — inclusive a crônica de verdade tem "até que a morte
 * de Thrain seja esclarecida" (mestre/cronica.md) — então o filtro de posse
 * abaixo tem que reconhecer esses casos e NÃO apagá-los.
 */
const DEATH_NOUNS = new Set([
  "morte", "mortes", "morto", "mortos",
  "corpo", "corpos", "cadaver", "cadaveres",
  "cabeca", "cabecas", "resto", "restos",
  "funeral", "funerais", "enterro", "enterros",
  "execucao", "execucoes", "perda", "perdas",
]);

/**
 * "NOME" logo depois de "de/do/da/dos/das " é posse quando a palavra
 * anterior à preposição NÃO é uma das `DEATH_NOUNS` acima: "os orcs DE
 * Thorgul que morriam" mata a tropa dele, não Thorgul — ele segue vivo e
 * lidera o assalto a Asterhall no turno seguinte. Sem este filtro, qualquer
 * frase que atribua uma perda a alguém ("as tropas de X", "os homens do X")
 * declarava X morto pelo mero fato de ser dono de quem morreu.
 *
 * A versão anterior apagava TODO "de <nome>", inclusive "a morte de Thrain"
 * — que não é posse nenhuma, é a forma mais direta de anunciar a morte dele.
 * Por isso a cabeça da posse (a palavra logo antes da preposição) decide: se
 * for uma palavra de morte, a menção fica; só é apagada quando é outra
 * coisa qualquer ("orcs", "tropas", "homens"...).
 */
function stripOwnershipMentions(segment: string, needle: string): string {
  const pattern = new RegExp(`([a-z]+),?\\s+(?:de|do|da|dos|das)\\s+${needle}\\b`, "g");
  return segment.replace(pattern, (full, head: string) => (DEATH_NOUNS.has(head) ? full : ""));
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
    // Dois-pontos dentro da frase é DIREÇÃO, não corte: uma palavra de morte
    // à ESQUERDA alcança nomes ditos à DIREITA (a lista de mortos às vezes
    // usa ":" em vez de "estão"), mas um nome que só aparece à ESQUERDA não
    // herda uma palavra de morte que só aparece à DIREITA (a forma da
    // Celene: ela é sujeito antes do ":", o que ela relata vem depois).
    //
    // Limitação aceita: "Fulano teve o destino temido: morreu afogado." é
    // gramaticalmente idêntico à forma da Celene — mesma pessoa antes do
    // ":", verbo de morte depois, sem repetir o nome. Não dá para separar
    // os dois só pela posição, e o código erra para o lado seguro: lê como
    // vivo. Só é recuperado se o nome for repetido depois do ":".
    let deathSoFar = false;
    for (const segment of sentence.split(":")) {
      // Tira as menções possessivas ("de/do Thorgul") antes de checar se o
      // nome aparece, exceto quando a posse é a própria morte ("a morte de
      // Thrain"): nesse caso a menção fica, porque apagá-la apagava o
      // anúncio da morte, não uma posse.
      const withoutOwnership = stripOwnershipMentions(segment, escaped);
      const segmentHasDeath = DEATH_WORDS.test(segment);
      if (nameHit.test(withoutOwnership) && (deathSoFar || segmentHasDeath)) return true;
      deathSoFar = deathSoFar || segmentHasDeath;
    }
  }
  return false;
}
