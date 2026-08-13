import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, diplomaticMessageSk, diplomaticPairPrefix, diplomaticTurnPrefix } from "../../keys";
import { pairKey, type DiplomaticMessage } from "@ravenloft/content";

export async function putMessage(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, m: DiplomaticMessage,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: diplomaticMessageSk(m.turnNumber, pairKey(m.fromHouseId, m.toHouseKey), m.id), ...m },
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

/** A conversa de um par num turno, em ordem cronológica. */
export function listThread(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnNumber: number, houseId: string, houseKey: string,
): Promise<DiplomaticMessage[]> {
  return query(doc, table, campaignId, diplomaticPairPrefix(turnNumber, pairKey(houseId, houseKey)));
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
