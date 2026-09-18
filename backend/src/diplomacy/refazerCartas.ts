import type { DiplomaticMessage } from "@ravenloft/content";
import { pairKey } from "@ravenloft/content";

/**
 * Quais cartas de um turno podem ser refeitas, e por que as outras ficam.
 *
 * Mora aqui, separado do script que apaga e grava, porque é exatamente esta
 * decisão que já falhou duas vezes: uma vez filtrando por uma numeração de
 * mensagem e passando por cima da carta ruim que estava noutra, outra vez
 * reescrevendo por cima de um fio que o jogador já tinha respondido.
 *
 * Nada aqui toca o banco. A função devolve as duas listas, e quem chama mostra
 * as duas ao Mestre antes de apagar coisa nenhuma.
 */

/** O prefixo que `cartasDoMundo` dá às cartas que o mundo escreve sozinho. */
const PREFIXO_DO_MUNDO = "out-";

/** O prefixo das cartas que o Mestre escreveu à mão. Lore, não geração. */
const PREFIXO_DO_MESTRE = "gm-";

export interface CartaMantida {
  carta: DiplomaticMessage;
  motivo: string;
}

export interface Triagem {
  refazer: DiplomaticMessage[];
  mantidas: CartaMantida[];
}

/**
 * Separa as cartas de um turno entre as que podem ser refeitas e as que não.
 *
 * Só entra na lista de refazer a carta que o MUNDO escreveu e que ninguém
 * respondeu ainda. Uma carta já respondida não se reescreve: fazer isso
 * desmancha a resposta do jogador, que passa a responder a um texto que deixou
 * de existir.
 */
export function triarCartasDoTurno(mensagens: DiplomaticMessage[], turnNumber: number): Triagem {
  const doTurno = mensagens.filter((m) => m.turnNumber === turnNumber);

  // Quando o jogador falou pela última vez em cada fio. Uma carta do mundo
  // anterior a essa fala já foi lida e respondida.
  const ultimaFalaDoJogador = new Map<string, string>();
  for (const m of doTurno) {
    if (m.author !== "PLAYER") continue;
    const fio = pairKey(m.fromHouseId, m.toHouseKey);
    const atual = ultimaFalaDoJogador.get(fio);
    if (!atual || m.createdAt > atual) ultimaFalaDoJogador.set(fio, m.createdAt);
  }

  const refazer: DiplomaticMessage[] = [];
  const mantidas: CartaMantida[] = [];

  for (const carta of doTurno) {
    if (carta.author === "PLAYER") {
      mantidas.push({ carta, motivo: "escrita pelo jogador — registro da partida, não se apaga" });
      continue;
    }
    if (carta.id.startsWith(PREFIXO_DO_MESTRE)) {
      mantidas.push({ carta, motivo: "escrita à mão pelo Mestre — é lore, não geração" });
      continue;
    }
    if (!carta.id.startsWith(PREFIXO_DO_MUNDO)) {
      mantidas.push({ carta, motivo: "é resposta a uma carta do jogador, não carta do mundo" });
      continue;
    }
    const respondida = ultimaFalaDoJogador.get(pairKey(carta.fromHouseId, carta.toHouseKey));
    if (respondida && respondida > carta.createdAt) {
      mantidas.push({ carta, motivo: "o jogador já respondeu — refazer desmancharia a resposta dele" });
      continue;
    }
    refazer.push(carta);
  }

  return { refazer, mantidas };
}
