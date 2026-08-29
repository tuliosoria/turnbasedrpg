import { fold } from "../lore/mortality.js";

export const WORLD_FACT_KINDS = ["MILITAR", "PACTO", "DIVIDA", "SUCESSAO", "DECRETO"] as const;
export type WorldFactKind = (typeof WORLD_FACT_KINDS)[number];

export const WORLD_FACT_KIND_LABELS: Record<WorldFactKind, string> = {
  MILITAR: "Compromisso militar",
  PACTO: "Pacto",
  DIVIDA: "Dívida",
  SUCESSAO: "Sucessão",
  DECRETO: "Decreto da Coroa",
};

export function isWorldFactKind(v: unknown): v is WorldFactKind {
  return typeof v === "string" && (WORLD_FACT_KINDS as readonly string[]).includes(v);
}

/**
 * Uma coisa que a campanha não pode esquecer.
 *
 * Existe porque o que aconteceu só vivia como prosa. A afirmação errada de que
 * Khazdrun não enviou tropa nenhuma atravessou três turnos, o evento público, o
 * resultado da Casa e três cartas já entregues — e corrigi-la exigiu varrer sete
 * turnos à mão procurando contradição. Uma linha consultável teria bastado.
 *
 * Deliberadamente separado de `CampaignFact`, que é o razão bilateral do
 * jogador e tem botão de aceitar e recusar preso nele. Aqui cabe o que não
 * pertence a nenhum par: o edito da Coroa, a data do eclipse, quem foi coroado.
 */
export interface WorldFact {
  id: string;
  campaignId: string;
  /** O turno em que o fato aconteceu, não o turno em que foi anotado. */
  turnNumber: number;
  kind: WorldFactKind;
  /**
   * As sedes que o fato envolve. VAZIO quer dizer o reino inteiro.
   *
   * Sem o caso vazio não haveria onde guardar "o eclipse cai em quarenta e um
   * dias", que é verdade para todo mundo e de ninguém.
   */
  parties: string[];
  /**
   * Quem pode SABER disto: "PUBLICO", ou a chave da sede dona do segredo.
   *
   * O turno tem duas camadas — o que foi anunciado e o que cada Casa viveu por
   * dentro —, e a extração lê as duas. Sem esta marca, a investigação sigilosa
   * de Khazdrun sobre moedas da Casa do Ouro viraria contexto de qualquer carta
   * envolvendo a Casa do Ouro, e um NPC saberia o segredo que o jogador pagou
   * para descobrir. Fato privado nunca entra em carta; só o Mestre o lê.
   */
  visibility: string;
  /** Uma frase, com número e prazo quando houver. */
  summary: string;
  /**
   * O trecho do texto do turno que afirma isto.
   *
   * É a prova, e não um enfeite: como não há aprovação humana por fato, a única
   * defesa contra invenção é a citação ser conferida contra a fonte antes de
   * gravar. Ver `quoteIsGrounded`.
   */
  quote: string;
  status: "ATIVO" | "REVOGADO";
  /** O fato que corrige este, quando um turno é reescrito. */
  supersededBy: string | null;
  createdAt: string;
}

/**
 * A citação existe mesmo no texto de origem?
 *
 * Normaliza espaço em branco e acentuação porque o modelo reescreve quebra de
 * linha e reticências sem querer, e reprovar por isso descartaria fato bom.
 *
 * Não normaliza número nem palavra, de propósito: "cem homens" e "mil homens"
 * precisam continuar diferentes. É exatamente isso que se está protegendo.
 */
export function quoteIsGrounded(quote: string, source: string): boolean {
  const limpar = (v: string) => fold(v).replace(/\s+/g, " ").trim();
  const agulha = limpar(quote);
  // Citação curta demais não prova nada: "a Coroa" aparece em qualquer texto.
  if (agulha.length < 20) return false;
  return limpar(source).includes(agulha);
}

export const PUBLICO = "PUBLICO";

function ativos(facts: readonly WorldFact[]): WorldFact[] {
  return facts.filter((f) => f.status === "ATIVO");
}

function maisRecentesPrimeiro(a: WorldFact, b: WorldFact): number {
  return b.turnNumber - a.turnNumber || b.createdAt.localeCompare(a.createdAt);
}

/** Quantos fatos cabem numa carta sem afogar o resto do prompt. */
export const LETTER_FACT_LIMIT = 15;
/** No texto do turno o orçamento é outro, e quem lê é o Mestre. */
export const TURN_FACT_LIMIT = 60;

/**
 * Os fatos que importam para uma carta entre duas sedes.
 *
 * Leva os que tocam qualquer um dos dois lados, mais os do reino — um decreto
 * de tributo vale para quem escreve mesmo que o decreto não a nomeie.
 */
export function selectFactsForLetter(
  facts: readonly WorldFact[],
  input: { seats: readonly (string | null | undefined)[]; limit?: number },
): WorldFact[] {
  const sedes = new Set(input.seats.filter((s): s is string => !!s));
  return ativos(facts)
    // Só o que é público. Um NPC não pode saber o que uma Casa descobriu por
    // dentro, mesmo que o fato a nomeie.
    .filter((f) => f.visibility === PUBLICO)
    .filter((f) => f.parties.length === 0 || f.parties.some((p) => sedes.has(p)))
    .sort(maisRecentesPrimeiro)
    .slice(0, input.limit ?? LETTER_FACT_LIMIT);
}

/**
 * Tudo que está de pé, para quem escreve o turno.
 *
 * Aqui o privado entra: quem escreve o turno é o Mestre, e ele já sabe tudo.
 */
export function selectFactsForTurn(facts: readonly WorldFact[], limit = TURN_FACT_LIMIT): WorldFact[] {
  return ativos(facts).sort(maisRecentesPrimeiro).slice(0, limit);
}

/**
 * Os fatos como bloco de prompt, ou null quando não há nenhum.
 *
 * Um cabeçalho sozinho, sem fato debaixo, ensina o modelo que a seção costuma
 * vir vazia — e ele passa a ignorá-la quando vem cheia.
 */
export function describeFacts(facts: readonly WorldFact[], nomeDaSede: (key: string) => string): string | null {
  if (facts.length === 0) return null;
  const linhas = facts.map((f) => {
    const quem = f.parties.length ? f.parties.map(nomeDaSede).join(", ") : "o reino";
    return `- [Turno ${f.turnNumber}] ${quem}: ${f.summary}`;
  });
  return `O QUE JÁ ACONTECEU E NÃO SE DISCUTE. Isto é registro da campanha, não boato — trate como fato assentado e nunca contradiga:\n${linhas.join("\n")}`;
}
