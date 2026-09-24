import type { DiplomaticMessage } from "@ravenloft/content";
import { descreverCompromissos, type Dossie } from "./dossie";

/** Uma única montagem da memória usada tanto pelo escritor quanto pelo revisor. */
export function responseMemory(dossie: Dossie, turnNumber: number, currentThread: DiplomaticMessage[]) {
  return {
    priorLetters: dossie.fio
      .filter((m) => m.turnNumber < turnNumber)
      .map((m) => ({ turnNumber: m.turnNumber, author: m.author, body: m.body })),
    // A carta enviada já está no fio consultado do banco. Ordenar por instante,
    // pois a chave do DynamoDB termina em id, não em data de criação.
    thread: [...currentThread]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((m) => ({ author: m.author, body: m.body })),
    commitments: descreverCompromissos(dossie),
  };
}
