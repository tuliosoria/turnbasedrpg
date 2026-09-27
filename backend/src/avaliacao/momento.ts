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
    // A memória viva guarda o turno de cada lembrança, então dá para cortar.
    // Estrito: a lembrança do turno N é escrita no aftermath da resolução de
    // N, depois de toda carta daquele turno.
    // Humor, objetivo e lealdade não: foram escritos DEPOIS da última
    // lembrança. Se ela é do futuro, o estado também é, e sai em branco —
    // omitir é melhor que vazar ("diante da ascensão de Kaelen" num turno 8).
    if (i.SK.startsWith("NPCDYN#") && Array.isArray(i.memory)) {
      const memoria = (i.memory as { turnNumber?: number }[]).filter((e) => Number(e.turnNumber) < turno);
      if (memoria.length === i.memory.length) return [i];
      return [{ ...i, memory: memoria, mood: "", objective: "", loyalty: "", concerns: "" }];
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
