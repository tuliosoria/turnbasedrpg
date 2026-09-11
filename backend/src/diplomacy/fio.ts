import { pairKey, playerPairKey, type DiplomaticMessage } from "@ravenloft/content";

/**
 * Sob que chave vive a conversa entre esta Casa e aquele destino.
 *
 * Existem dois formatos, e a diferença não é cosmética.
 *
 * Contra um NPC, o fio pertence ao jogador: `solarion-k0hc~casa-karasoy`. Só
 * uma pessoa o lê, e a chave pode carregar o id da Casa viva.
 *
 * Entre dois jogadores não há dono. Se Solarion gravasse em
 * `solarion-k0hc~casa-khazdrun`, Khazdrun procuraria em
 * `khazdrun-wxey~casa-solarion` e encontraria um fio vazio — a mesma carta sob
 * duas chaves, invisível de um dos lados. Ordenar as duas SEDES dá uma chave
 * que os dois calculam igual, e então existe um registro só.
 *
 * Esta função é o único lugar que sabe disso. Toda leitura e toda gravação
 * passam por aqui, porque uma segunda cópia dessa regra é uma cópia que um dia
 * vai discordar da primeira.
 */
export function fioDe(
  ownHouseId: string,
  /** A sede de quem escreve. Vem pronta de quem chama, e não derivada do id. */
  ownSeatKey: string | null,
  targetSeatKey: string,
  alvoEhJogador: boolean,
): string {
  // Sem sede não há chave canônica possível; cair no par comum é melhor que
  // gravar sob uma chave que o outro lado nunca vai procurar.
  if (!alvoEhJogador || !ownSeatKey) return pairKey(ownHouseId, targetSeatKey);
  return playerPairKey(ownSeatKey, targetSeatKey);
}

/**
 * A mesma carta, vista por quem a está lendo.
 *
 * `author` nasceu com dois valores que respondiam à pergunta certa enquanto
 * havia um jogador só no fio: PLAYER é minha, AI é do outro lado. Entre dois
 * jogadores as duas cartas são PLAYER, e o mesmo registro é lido pelas duas
 * pontas — o campo deixa de distinguir qualquer coisa.
 *
 * Em vez de ensinar a tela a fazer essa conta, a resposta da API já sai na
 * perspectiva de quem pediu. A tela continua perguntando "isto é meu?" do
 * mesmo jeito que perguntava antes, e nenhum componente precisou saber que
 * cartas entre jogadores existem.
 */
export function paraLeitor(m: DiplomaticMessage, ownHouseId: string): DiplomaticMessage {
  if (!m.fromPlayerHouseId) return m;
  return { ...m, author: m.fromPlayerHouseId === ownHouseId ? "PLAYER" : "AI" };
}
