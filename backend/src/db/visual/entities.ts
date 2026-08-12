import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, entitySk, entityPrefix } from "../../keys";
import { coerceCanonTraits } from "@ravenloft/content";
import type { VisualEntity } from "@ravenloft/content";

export async function putEntity(doc: DynamoDBDocumentClient, table: string, campaignId: string, e: VisualEntity): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: entitySk(e.id), ...e } }));
}
export async function getEntity(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualEntity | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: entitySk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function listEntities(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualEntity[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": entityPrefix() } }));
  return (res.Items ?? []).map(strip);
}
function strip(i: Record<string, unknown>): VisualEntity {
  const { PK, SK, ...rest } = i as any;
  return {
    ...rest,
    immutableTraits: coerceCanonTraits(rest.immutableTraits),
    wikiEntryId: typeof rest.wikiEntryId === "string" ? rest.wikiEntryId : null,
  } as VisualEntity;
}
