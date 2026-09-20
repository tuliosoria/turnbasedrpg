export interface BookPart {
  id: string;
  label: string;
}

/**
 * As partes do romance, em ordem de leitura. O prólogo abre a moldura de
 * memória; as três partes seguem a jornada. A ordem aqui é a ordem canônica
 * de leitura, e é ela que agrupa os capítulos no índice público e no editor.
 */
export const BOOK_PARTS: BookPart[] = [
  { id: "prologo", label: "Prólogo" },
  { id: "parte-1", label: "Parte I — O Norte Morto" },
  { id: "parte-2", label: "Parte II — A Companhia" },
  { id: "parte-3", label: "Parte III — A Coroa" },
];

export const BOOK_PART_IDS: string[] = BOOK_PARTS.map((p) => p.id);

export function bookPartLabel(id: string): string {
  return BOOK_PARTS.find((p) => p.id === id)?.label ?? id;
}

export type BookStatus = "rascunho" | "publicado";

export interface BookChapter {
  chapterId: string;
  part: string;
  order: number;
  title: string;
  body: string;
  status: BookStatus;
  updatedAt: string;
  /**
   * A revisão do Mestre, presa aos parágrafos que ela critica.
   *
   * Nunca sai pela rota pública, nem em capítulo publicado: é bilhete de autor
   * para autor, e filtrar por status não o esconde — um capítulo publicado
   * carrega os comentários junto se ninguém os tirar.
   */
  comentarios?: ComentarioDoLivro[];
}

/**
 * Um recado do Mestre sobre um parágrafo.
 *
 * Guarda o índice e também **o trecho como ele era**. O índice sozinho não
 * sobrevive: este livro vai de dezoito capítulos para trinta e cinco e cada
 * capítulo quadruplica de tamanho, então todo parágrafo muda de posição. Um
 * comentário reancorado pelo índice passaria a criticar um texto que não é o
 * criticado, o que é pior do que perdê-lo.
 */
export interface ComentarioDoLivro {
  id: string;
  /** Onde o parágrafo estava quando o comentário foi escrito. */
  paragrafo: number;
  /** O parágrafo como ele era. É isto que reancora depois da reescrita. */
  trecho: string;
  texto: string;
  criadoEm: string;
}

/** O comentário já colocado no capítulo de hoje. */
export interface ComentarioAncorado extends ComentarioDoLivro {
  /** Verdadeiro quando o trecho comentado não existe mais no capítulo. */
  orfao: boolean;
}

/** O corpo do capítulo em parágrafos, do mesmo jeito que a tela o mostra. */
export function paragrafosDe(body: string): string[] {
  return String(body).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** Quanto do começo do trecho basta para reconhecê-lo. */
const ASSINATURA = 48;

// A pontuação sai da assinatura de propósito. Ampliar um parágrafo quase
// sempre substitui o ponto final por uma vírgula e continua a frase, e com o
// ponto dentro da comparação o trecho ampliado deixava de ser reconhecido.
const assinar = (t: string) =>
  String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, ASSINATURA);

/**
 * Põe cada comentário no parágrafo que ele comenta, no capítulo de agora.
 *
 * Tenta o índice original, depois procura o trecho entre todos os parágrafos,
 * e só então desiste. Quem desiste vira órfão e a tela o mostra numa lista com
 * o trecho antigo citado: o comentário perde o lugar, nunca a existência.
 *
 * Compara pelo COMEÇO do trecho porque a reescrita quase sempre amplia o fim
 * do parágrafo e preserva a abertura dele.
 */
export function reancorar(
  comentarios: readonly ComentarioDoLivro[],
  paragrafos: readonly string[],
): ComentarioAncorado[] {
  const assinaturas = paragrafos.map(assinar);
  return comentarios.map((c) => {
    const alvo = assinar(c.trecho);
    if (!alvo) return { ...c, orfao: true };
    if (assinaturas[c.paragrafo] === alvo) return { ...c, orfao: false };
    const achado = assinaturas.findIndex((a) => a === alvo || a.startsWith(alvo) || alvo.startsWith(a));
    return achado === -1 ? { ...c, orfao: true } : { ...c, paragrafo: achado, orfao: false };
  });
}
