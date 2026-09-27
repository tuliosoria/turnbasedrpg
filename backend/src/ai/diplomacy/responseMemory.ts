import type { DiplomaticMessage } from "@ravenloft/content";
import { descreverEstadoDiplomatico, type Dossie } from "./dossie";
import { selectCurrentExchange, selectHistoricalLetters } from "./conversationMemory";

/** Uma única montagem da memória usada tanto pelo escritor quanto pelo revisor. */
export function responseMemory(
  dossie: Dossie,
  turnNumber: number,
  currentThread: DiplomaticMessage[],
  targetMessageId: string,
) {
  const exchange = selectCurrentExchange(currentThread, targetMessageId);
  return {
    priorLetters: selectHistoricalLetters(
      dossie.fio.filter((m) => m.turnNumber < turnNumber),
    ),
    thread: exchange.before.map((m) => ({ author: m.author, body: m.body })),
    incomingLetter: exchange.incoming.body,
    diplomaticState: descreverEstadoDiplomatico(dossie),
  };
}
