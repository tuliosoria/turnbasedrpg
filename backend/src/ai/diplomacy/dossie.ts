import { listPairHistory } from "../../db/diplomacy/messages";
import { listFacts } from "../../db/diplomacy/facts";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * O que quem escreve uma carta precisa saber antes de escrever.
 *
 * Existe porque os dois caminhos de carta sabiam coisas diferentes, e o mais
 * cego era justamente o que escreve sem ter texto ao qual reagir: a carta
 * proativa recebia o evento do turno e a relação, e nenhuma linha do que as
 * duas Casas já se disseram. Lady Miriel Ferrumor reabriu um encontro que ela
 * mesma tinha marcado sem lembrar de tê-lo marcado.
 *
 * Montado em código, sem chamar modelo. É a parte que não pode alucinar: se o
 * fio está errado aqui, nenhuma quantidade de raciocínio depois conserta.
 */
export interface Dossie {
  /** A conversa inteira, de todos os turnos, na ordem em que aconteceu. */
  fio: { turnNumber: number; author: "PLAYER" | "AI"; body: string }[];
  /** O que já ficou combinado entre estas duas Casas, e continua valendo. */
  compromissos: string[];
}

/**
 * O fio inteiro cabe.
 *
 * Medido na campanha real: o par mais falante tem oito cartas e 2.500 tokens.
 * Resumir custaria uma chamada de modelo e perderia justamente o detalhe — o
 * prazo, a quantidade, a condição — que faz a carta seguinte não se contradizer.
 */
const TETO_DE_CARTAS = 24;

export async function montarDossie(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  playerHouseId: string,
  toHouseKey: string,
): Promise<Dossie> {
  const [historia, fatos] = await Promise.all([
    listPairHistory(doc, tableName, campaignId, playerHouseId, toHouseKey),
    listFacts(doc, tableName, campaignId),
  ]);

  return {
    fio: historia
      .slice(-TETO_DE_CARTAS)
      .map((m) => ({ turnNumber: m.turnNumber, author: m.author, body: m.body })),
    // Só o que envolve estas duas Casas. Um acordo que a outra parte fechou com
    // um terceiro não é compromisso deste fio, e citá-lo denuncia que quem
    // escreve leu correspondência alheia.
    compromissos: fatos
      .filter(
        (f) =>
          f.status === "ATIVO" &&
          [f.betweenA, f.betweenB].includes(playerHouseId) &&
          [f.betweenA, f.betweenB].includes(toHouseKey),
      )
      .map((f) => `Turno ${f.turnNumber}: ${f.summary}`),
  };
}

/** O fio, escrito para entrar no pedido ao modelo. Vazio quando nunca falaram. */
export function descreverFio(d: Dossie, nomeDoJogador: string, nomeDoNpc: string): string {
  if (d.fio.length === 0) return "";
  const linhas = d.fio.map(
    (m) => `[Turno ${m.turnNumber}] ${m.author === "PLAYER" ? nomeDoJogador : nomeDoNpc}: ${m.body}`,
  );
  return `Tudo que vocês dois já se escreveram, do mais antigo ao mais recente. Você lembra de cada uma destas cartas, inclusive das suas:\n\n${linhas.join("\n\n")}`;
}

/** O que já está combinado, para a carta nova não contradizer a antiga. */
export function descreverCompromissos(d: Dossie): string {
  if (d.compromissos.length === 0) return "";
  return `O que já ficou combinado entre vocês dois e continua valendo — não reabra, não renegocie e não finja que não existe:\n${d.compromissos.map((c) => `- ${c}`).join("\n")}`;
}
