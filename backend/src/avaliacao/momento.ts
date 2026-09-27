/**
 * O banco como estava quando uma carta de jogador chegou.
 *
 * O replay é aproximado como história e exato como benchmark: humor de NPC,
 * relação entre Casas e wiki só existem no estado de hoje e ficam como estão.
 * O que tem data — cartas, fatos e turnos — é cortado no momento da carta, e
 * o turno dela volta a ficar aberto e sem resultado. Sem isso a queda de
 * Asterhall, resolvida DEPOIS, vazava para cartas escritas durante o cerco.
 */

export interface Item {
  PK: string;
  SK: string;
  [campo: string]: unknown;
}

export interface Momento {
  itens: Item[];
  carta: Item;
  /** A resposta que produção gravou para esta carta; linha de base. */
  respostaGravada: Item | null;
}

const DATADOS = ["DIPLMSG#", "CFACT#", "WFACT#"];

export function snapshotNoMomento(itens: readonly Item[], sentId: string): Momento {
  const carta = itens.find((i) => i.SK.startsWith("DIPLMSG#") && i.id === sentId);
  if (!carta) throw new Error(`Carta ausente do snapshot: ${sentId}`);
  const quando = String(carta.createdAt);
  const turno = Number(carta.turnNumber);

  const respostaGravada = itens.find((i) => i.SK.startsWith("DIPLMSG#") && i.replyToId === sentId) ?? null;

  const cortados = itens.flatMap((i): Item[] => {
    if (DATADOS.some((p) => i.SK.startsWith(p))) {
      return typeof i.createdAt === "string" && i.createdAt > quando ? [] : [i];
    }
    if (i.SK.startsWith("TURN#")) {
      const n = Number(i.SK.split("#")[1]);
      if (n > turno) return [];
      if (n === turno && !i.SK.includes("#SUB#")) {
        const { result: _r, resultImageUrl: _ri, ...aberto } = i;
        return [{ ...aberto, status: "OPEN" }];
      }
    }
    return [i];
  });

  return { itens: cortados, carta, respostaGravada };
}
