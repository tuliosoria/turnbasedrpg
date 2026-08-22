import type { CompletionEffects, ProjectCard, ProjectTemplate } from "./projects.js";

/**
 * A regra de troca do jogo: o que uma carta pode cobrar e conceder, pela sua
 * duração. Antes disto a regra existia três vezes em prosa dentro dos prompts
 * de IA, e as três discordavam entre si. Este arquivo é a única cópia.
 *
 * Os números vêm da decisão do Mestre registrada na seção 2.1 da spec:
 * ganho de atributo a partir de 3 turnos, +2 a partir de 4, sem portão de
 * aprovação. A carta longa precisa oferecer sempre pelo menos o que a curta
 * oferece, senão ninguém escolhe a longa.
 */
export interface FaixaDeTroca {
  turnos: number;
  custoMin: number;
  custoMax: number;
  atributoPermanenteMax: number;
  resumo: string;
}

export const TABELA_DE_TROCA: FaixaDeTroca[] = [
  { turnos: 1, custoMin: 0, custoMax: 1, atributoPermanenteMax: 0, resumo: "efeito imediato pequeno: Estabilidade, um Favor ou um desbloqueio" },
  { turnos: 2, custoMin: 0, custoMax: 1, atributoPermanenteMax: 0, resumo: "um desbloqueio, um Favor ou um ativo pequeno" },
  { turnos: 3, custoMin: 1, custoMax: 2, atributoPermanenteMax: 1, resumo: "+1 permanente num atributo, ou um ativo nomeado com desbloqueio" },
  { turnos: 4, custoMin: 2, custoMax: 3, atributoPermanenteMax: 2, resumo: "+2 permanente num atributo, ou +1 com um ativo forte" },
  { turnos: 5, custoMin: 3, custoMax: 4, atributoPermanenteMax: 2, resumo: "+2 permanente num atributo, mais um ativo ou desbloqueio" },
];

/** Cartas mais longas que a tabela caem na faixa mais alta. */
export function faixaPara(turnos: number): FaixaDeTroca {
  const exata = TABELA_DE_TROCA.find((f) => f.turnos === turnos);
  if (exata) return exata;
  if (turnos < TABELA_DE_TROCA[0].turnos) return TABELA_DE_TROCA[0];
  return TABELA_DE_TROCA[TABELA_DE_TROCA.length - 1];
}

const NOMES: Record<string, string> = {
  riqueza: "Riqueza", recursos: "Recursos", soldados: "Soldados",
  controle: "Controle", stability: "Estabilidade",
};

function custoTotal(carta: Pick<ProjectTemplate, "costs">): number {
  return carta.costs.reduce((n, c) => n + c.amount, 0);
}

function temGanho(e: CompletionEffects): boolean {
  return e.attributeChanges.length > 0 || e.favors.length > 0 || e.assets.length > 0 || e.unlocks.length > 0;
}

/**
 * Devolve a lista de problemas de uma carta. Lista vazia quer dizer que a
 * carta respeita o trato. Usado pelo teste de auditoria da biblioteca e pelo
 * painel do Mestre.
 */
export function auditarCarta(carta: ProjectTemplate | ProjectCard): string[] {
  const problemas: string[] = [];
  const faixa = faixaPara(carta.durationTurns);
  const e = carta.completionEffects;

  if (!temGanho(e)) problemas.push("não concede ganho nenhum");

  for (const ch of e.attributeChanges) {
    if (!ch.permanent) {
      problemas.push(`promete efeito temporário em ${ch.attribute}, e o motor só aplica permanentes`);
      continue;
    }
    if (ch.amount > faixa.atributoPermanenteMax) {
      problemas.push(`concede +${ch.amount} em ${ch.attribute}, mas ${carta.durationTurns} turnos permitem no máximo +${faixa.atributoPermanenteMax}`);
    }
  }

  const total = custoTotal(carta);
  if (total < faixa.custoMin || total > faixa.custoMax) {
    problemas.push(`custa ${total} no total, mas ${carta.durationTurns} turnos pedem entre ${faixa.custoMin} e ${faixa.custoMax}`);
  }

  return problemas;
}

/**
 * O ganho da carta em uma linha, para a tela. Nunca devolve string vazia: uma
 * carta sem ganho precisa dizer isso em voz alta, que é o problema que este
 * trabalho inteiro ataca.
 */
export function resumoDoGanho(e: CompletionEffects): string {
  const partes: string[] = [];

  for (const ch of e.attributeChanges) {
    const nome = NOMES[ch.attribute] ?? ch.attribute;
    const sinal = ch.amount >= 0 ? "+" : "";
    partes.push(`${nome} ${sinal}${ch.amount} ${ch.permanent ? "permanente" : "temporário"}`);
  }
  for (const a of e.assets) partes.push(`Ativo: ${a}`);
  if (e.favors.length) partes.push(`${e.favors.length} Favor${e.favors.length > 1 ? "es" : ""}`);
  if (e.unlocks.length) partes.push(`Abre ${e.unlocks.length} carta${e.unlocks.length > 1 ? "s" : ""} nova${e.unlocks.length > 1 ? "s" : ""}`);

  return partes.length ? partes.join(" · ") : "Sem ganho mecânico";
}
