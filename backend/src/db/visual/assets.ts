import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, assetSk, assetPrefix } from "../../keys";
import type { VisualAsset, CanonicalLevel } from "@ravenloft/content";

export async function putAsset(doc: DynamoDBDocumentClient, table: string, campaignId: string, a: VisualAsset): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: assetSk(a.id), ...a } }));
}
export async function getAsset(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualAsset | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: assetSk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function listAssets(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualAsset[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": assetPrefix() } }));
  return (res.Items ?? []).map(strip);
}
export async function setAssetCanonicalLevel(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string, level: CanonicalLevel): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: table,
    Key: { PK: campaignPk(campaignId), SK: assetSk(id) },
    UpdateExpression: "SET canonicalLevel = :level",
    ExpressionAttributeValues: { ":level": level } }));
}
function strip(i: Record<string, unknown>): VisualAsset {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualAsset;
}
