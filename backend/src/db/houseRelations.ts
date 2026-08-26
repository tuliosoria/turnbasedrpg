import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, houseRelationSk, houseRelationPrefix } from "../keys";
import { clampRelationValue, emptyHouseRelation, type HouseRelation } from "@ravenloft/content";

function strip(item: Record<string, unknown>): HouseRelation {
  const base = emptyHouseRelation(
    typeof item.fromKey === "string" ? item.fromKey : "",
    typeof item.toKey === "string" ? item.toKey : "",
  );
  return {
    ...base,
    amizade: clampRelationValue(item.amizade),
    comercio: clampRelationValue(item.comercio),
    favores: clampRelationValue(item.favores),
    note: typeof item.note === "string" ? item.note : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

/**
 * Só os pares que o Mestre tocou. O resto vale o padrão (médio) e não ocupa
 * linha no banco — dezesseis potências dariam 240 pares.
 */
export async function listHouseRelations(
  doc: DynamoDBDocumentClient, table: string, campaignId: string,
): Promise<HouseRelation[]> {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": houseRelationPrefix() },
  }));
  return (res.Items ?? []).map(strip);
}

/** A relação de uma Casa com outra, com o padrão quando ninguém a definiu. */
export async function getHouseRelation(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, fromKey: string, toKey: string,
): Promise<HouseRelation> {
  const res = await doc.send(new GetCommand({
    TableName: table,
    Key: { PK: campaignPk(campaignId), SK: houseRelationSk(fromKey, toKey) },
  }));
  return res.Item ? strip(res.Item) : emptyHouseRelation(fromKey, toKey);
}

export async function putHouseRelation(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, input: HouseRelation,
): Promise<HouseRelation> {
  const relation: HouseRelation = {
    ...input,
    amizade: clampRelationValue(input.amizade),
    comercio: clampRelationValue(input.comercio),
    favores: clampRelationValue(input.favores),
    updatedAt: new Date().toISOString(),
  };
  await doc.send(new PutCommand({
    TableName: table,
    Item: {
      PK: campaignPk(campaignId),
      SK: houseRelationSk(relation.fromKey, relation.toKey),
      ...relation,
    },
  }));
  return relation;
}
