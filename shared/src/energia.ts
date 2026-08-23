import type { ProjectCard } from "./projects.js";

/**
 * A Energia é o que o jogador gasta para mover suas cartas. Cada Casa recebe
 * três pontos no início do turno e um ponto vale um turno de progresso, então a
 * mesma Energia compra três cartas andando um passo ou uma carta andando três.
 *
 * O número é igual para toda Casa, e é o mesmo teto de cartas em andamento de
 * `projectSlotLimit`. Os dois andam juntos: um teto de cartas maior que o
 * orçamento faria de toda distribuição um prejuízo diante de não fazer nada.
 *
 * Este arquivo é o dono único da regra. Rota, tela e resolução de turno derivam
 * daqui e não repetem número nenhum.
 */
export const ENERGIA_POR_TURNO = 3;

/**
 * Quanta Energia esta Casa recebe neste turno.
 *
 * São sempre os três pontos, iguais para toda Casa. Existe como função, e não
 * como leitura direta da constante, porque a rota e a tela precisam de um lugar
 * só para perguntar — e porque é aqui que uma regra futura entraria, se o Mestre
 * um dia quiser Energia variável.
 *
 * O total nunca fica abaixo do número de cartas ativas porque `projectSlotLimit`
 * também é três: distribuir sempre consegue, no mínimo, empatar com não
 * distribuir. Se um dos dois números mudar, o outro tem de mudar junto.
 */
export function energiaDoTurno(_cartas: ProjectCard[]): number {
  return ENERGIA_POR_TURNO;
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
 * por quê. O teto de uma carta é a constante, não o total do turno: são coisas
 * diferentes e devem continuar assim.
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
 * Não há teto aqui, e é de propósito. Pelos caminhos do jogador o teto de cartas
 * é o mesmo que o orçamento do turno, então um ponto por carta ativa nunca passa
 * do total. Mas `adminApproveProject` ativa uma carta sem conferir o teto de
 * slots, então uma Casa pode acabar com quatro cartas ativas — e aí o padrão dá
 * quatro pontos enquanto o jogador só pode distribuir três.
 *
 * Mesmo nesse caso o teto aqui seria pior que a falta dele: um `break` ao
 * esgotar o orçamento deixaria a última carta parada para sempre, escolhida pela
 * ordem do banco. Preferimos a Casa andar um pouco mais do que uma carta nunca
 * andar. A situação se desfaz sozinha quando alguma carta conclui.
 */
export function alocacaoPadrao(cartas: ProjectCard[]): AlocacaoEnergia {
  const alocacao: AlocacaoEnergia = {};

  for (const carta of cartas) {
    if (energiaMaximaPara(carta) <= 0) continue;
    alocacao[carta.id] = 1;
  }

  return alocacao;
}
