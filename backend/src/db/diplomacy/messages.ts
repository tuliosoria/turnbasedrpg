import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, diplomaticMessageSk, diplomaticPairPrefix, diplomaticTurnPrefix, diplomaticPrefix } from "../../keys";
import { pairKey, playerPairKey, seatKeyForHouseId, type DiplomaticMessage } from "@ravenloft/content";

export async function putMessage(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, m: DiplomaticMessage,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: diplomaticMessageSk(m.turnNumber, pairKey(m.fromHouseId, m.toHouseKey), m.id), ...m },
  }));
}

/**
 * Apaga uma carta.
 *
 * Só serve para carta que o mundo escreveu: o que um jogador enviou é registro
 * da partida e não se apaga. Quem chama é que garante isso — aqui a operação é
 * burra de propósito.
 */
export async function deleteMessage(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, m: DiplomaticMessage,
): Promise<void> {
  await doc.send(new DeleteCommand({
    TableName: table,
    Key: { PK: campaignPk(campaignId), SK: diplomaticMessageSk(m.turnNumber, pairKey(m.fromHouseId, m.toHouseKey), m.id) },
  }));
}

async function query(doc: DynamoDBDocumentClient, table: string, campaignId: string, prefix: string): Promise<DiplomaticMessage[]> {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": prefix },
  }));
  return (res.Items ?? []).map(strip);
}

/**
 * A conversa de um par num turno, quando a chave do fio já foi decidida.
 *
 * Existe porque o fio entre dois jogadores não é `casa~sede`: é a chave
 * canônica das duas sedes, e quem sabe escolher entre as duas formas é
 * `fioDe`, não este módulo.
 */
export function listThreadByPair(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnNumber: number, pair: string,
): Promise<DiplomaticMessage[]> {
  return query(doc, table, campaignId, diplomaticPairPrefix(turnNumber, pair));
}

/** Grava sob uma chave de fio já decidida. */
export async function putMessageInPair(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, m: DiplomaticMessage, pair: string,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: diplomaticMessageSk(m.turnNumber, pair, m.id), ...m },
  }));
}

/** A conversa de um par num turno, em ordem cronológica. */
export function listThread(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnNumber: number, houseId: string, houseKey: string,
): Promise<DiplomaticMessage[]> {
  return query(doc, table, campaignId, diplomaticPairPrefix(turnNumber, pairKey(houseId, houseKey)));
}

/**
 * Toda a correspondência da campanha, de todos os turnos. É o que o Mestre
 * precisa para arbitrar: sem ler o que as Casas combinaram entre si, ele julga
 * às cegas. O volume é pequeno — algumas centenas de cartas por campanha.
 */
export async function listAllMessages(
  doc: DynamoDBDocumentClient, table: string, campaignId: string,
): Promise<DiplomaticMessage[]> {
  const all = await query(doc, table, campaignId, diplomaticPrefix());
  return all.sort((a, b) => a.turnNumber - b.turnNumber || a.createdAt.localeCompare(b.createdAt));
}

/** Tudo que foi trocado num turno — a visão do GM. */
export function listTurnMessages(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnNumber: number,
): Promise<DiplomaticMessage[]> {
  return query(doc, table, campaignId, diplomaticTurnPrefix(turnNumber));
}

function strip(i: Record<string, unknown>): DiplomaticMessage {
  const { PK, SK, ...rest } = i as any;
  return rest as DiplomaticMessage;
}

/**
 * Tudo que este par já trocou, em todos os turnos.
 *
 * A conversa de um turno é o assunto do momento; esta é a memória. Sem ela cada
 * turno recomeça do zero e a Casa responde como quem nunca falou com você —
 * exatamente o que uma correspondência não pode ser.
 *
 * A chave é ordenada por turno, então o par não é prefixo consultável: filtra
 * em memória. O volume é pequeno, algumas centenas de cartas por campanha.
 */
export async function listPairHistory(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string, houseKey: string,
): Promise<DiplomaticMessage[]> {
  const all = await query(doc, table, campaignId, diplomaticPrefix());
  // Numa carta entre jogadores há um registro só para dois leitores, e ele
  // guarda a direção em que foi escrito. Quem está do outro lado procura pelo
  // par invertido, então a comparação é entre as duas SEDES, não entre id e
  // sede — senão o destinatário abre o fio e não encontra a carta que recebeu.
  const minhaSede = seatKeyForHouseId(houseId);
  const meuPar = minhaSede ? playerPairKey(minhaSede, houseKey) : null;
  const parDe = (m: DiplomaticMessage): string | null => {
    if (!m.fromPlayerHouseId) return null;
    const sede = seatKeyForHouseId(m.fromPlayerHouseId);
    return sede ? playerPairKey(sede, m.toHouseKey) : null;
  };
  return all
    .filter((m) =>
      (m.fromHouseId === houseId && m.toHouseKey === houseKey) ||
      (!!meuPar && parDe(m) === meuPar))
    .sort((a, b) => a.turnNumber - b.turnNumber || a.createdAt.localeCompare(b.createdAt));
}
