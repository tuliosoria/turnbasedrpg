import type { ProjectCard } from "./projects.js";

/**
 * A Energia é o que o jogador gasta para mover suas cartas. Cada Casa recebe
 * três pontos no início do turno e um ponto vale um turno de progresso, então a
 * mesma Energia compra três cartas andando um passo ou uma carta andando três.
 *
 * Este arquivo é o dono único da regra. Rota, tela e resolução de turno derivam
 * daqui e não repetem número nenhum.
 */
export const ENERGIA_POR_TURNO = 3;

/**
 * Quanta Energia esta Casa recebe neste turno.
 *
 * São os três pontos de sempre, mas nunca menos do que uma carta ativa cada.
 * O teto de cartas (`projectSlotLimit`) chega a quatro para Controle alto, e
 * com quatro cartas um orçamento de três tornaria toda distribuição um
 * prejuízo: a Casa andaria mais deixando a tela fechada do que usando a
 * mecânica. Distribuir tem de poder, no mínimo, empatar com não distribuir.
 *
 * O ponto continua valendo um turno de progresso, e uma carta sozinha continua
 * aceitando no máximo três — o que cresce é só o total da Casa.
 */
export function energiaDoTurno(cartas: ProjectCard[]): number {
  return Math.max(ENERGIA_POR_TURNO, cartas.filter(estaAtiva).length);
}

/** A alocação de um turno: quantos pontos cada carta recebeu. */
export type AlocacaoEnergia = Record<string, number>;

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
}

function estaAtiva(carta: ProjectCard): boolean {
  return carta.status === "ACTIVE";
}

/**
 * Quanto de Energia esta carta ainda aceita.
 *
 * É o que falta para concluir, nunca a duração inteira: dar 3 pontos a uma
 * carta que precisa de 1 queimaria dois sem retorno, e a tela teria de explicar
 * por quê. O teto também não passa do total do turno.
 */
export function energiaMaximaPara(carta: ProjectCard): number {
  if (!estaAtiva(carta)) return 0;
  const falta = carta.durationTurns - carta.turnsCompleted;
  return Math.max(0, Math.min(falta, ENERGIA_POR_TURNO));
}

/** Confere uma alocação contra as cartas da Casa. Recusa em português. */
export function validarAlocacao(alocacao: AlocacaoEnergia, cartas: ProjectCard[]): ResultadoValidacao {
  const porId = new Map(cartas.map((c) => [c.id, c]));
  let soma = 0;

  for (const [id, pontos] of Object.entries(alocacao)) {
    if (!Number.isInteger(pontos)) {
      return { ok: false, motivo: `A Energia é contada em pontos inteiros; "${pontos}" não é.` };
    }
    if (pontos < 0) {
      return { ok: false, motivo: "Não dá para alocar Energia negativa." };
    }
    if (pontos === 0) continue;

    const carta = porId.get(id);
    if (!carta || !estaAtiva(carta)) {
      return { ok: false, motivo: "Uma das cartas escolhidas não está ativa." };
    }

    const teto = energiaMaximaPara(carta);
    if (pontos > teto) {
      return { ok: false, motivo: `"${carta.title}" precisa de ${teto} de Energia para concluir; ${pontos} desperdiçaria o resto.` };
    }

    soma += pontos;
  }

  const total = energiaDoTurno(cartas);
  if (soma > total) {
    return { ok: false, motivo: `Sua Casa tem ${total} de Energia por turno, e isso soma ${soma}.` };
  }

  return { ok: true };
}

/**
 * O que acontece quando o jogador não distribui nada.
 *
 * Dá exatamente um ponto por carta ativa — o ritmo de hoje — e deixa o resto se
 * perder. A tentação seria espalhar os três pontos pelas cartas ativas, mas cada
 * Casa tem hoje uma carta só: ela receberia os três e saltaria três turnos sem
 * ninguém pedir, atropelando os projetos que já estão em voo.
 *
 * O princípio é que inação não acelera nada. Só anda mais depressa quem escolher.
 *
 * Repare que este padrão não é limitado por ENERGIA_POR_TURNO, e sim pelo total
 * do turno, que cresce junto com o número de cartas ativas (`energiaDoTurno`).
 * Limitar em três deixaria a quarta carta de uma Casa de Controle alto parada
 * para sempre, escolhida pela ordem do banco — ela perderia progresso justamente
 * por não mexer em nada.
 */
export function alocacaoPadrao(cartas: ProjectCard[]): AlocacaoEnergia {
  const alocacao: AlocacaoEnergia = {};

  for (const carta of cartas) {
    if (energiaMaximaPara(carta) <= 0) continue;
    alocacao[carta.id] = 1;
  }

  return alocacao;
}
