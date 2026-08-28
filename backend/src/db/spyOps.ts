import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, spyOpSk, spyOpHousePrefix, spyOpPrefix } from "../keys";
import type { SpyOperation } from "@ravenloft/content";

export async function putSpyOp(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, op: SpyOperation,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: spyOpSk(op.houseId, op.id), ...op },
  }));
}

function strip(i: Record<string, unknown>): SpyOperation {
  const { PK, SK, ...rest } = i as Record<string, unknown>;
  return rest as unknown as SpyOperation;
}

async function query(doc: DynamoDBDocumentClient, table: string, campaignId: string, prefix: string) {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": prefix },
  }));
  return (res.Items ?? []).map(strip);
}

export function listHouseSpyOps(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string,
): Promise<SpyOperation[]> {
  return query(doc, table, campaignId, spyOpHousePrefix(houseId));
}

/** Todas as operações da campanha: a fila que o Mestre resolve. */
export function listAllSpyOps(
  doc: DynamoDBDocumentClient, table: string, campaignId: string,
): Promise<SpyOperation[]> {
  return query(doc, table, campaignId, spyOpPrefix());
}
