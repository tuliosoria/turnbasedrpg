import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, styleBibleSk, styleBiblePrefix } from "../../keys";
import type { VisualStyleBible } from "@ravenloft/content";

export async function putStyleBible(doc: DynamoDBDocumentClient, table: string, campaignId: string, b: VisualStyleBible): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: styleBibleSk(b.version), ...b } }));
}

export async function listStyleBibles(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualStyleBible[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": styleBiblePrefix() } }));
  return (res.Items ?? []).map(strip);
}

export async function getActiveStyleBible(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualStyleBible | null> {
  const all = await listStyleBibles(doc, table, campaignId);
  const active = all.filter((b) => b.status === "ACTIVE").sort((a, b) => b.version - a.version);
  return active[0] ?? null;
}

function strip(i: Record<string, unknown>): VisualStyleBible {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualStyleBible;
}
