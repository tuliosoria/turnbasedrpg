import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, generationSk } from "../../keys";
import type { VisualGeneration } from "@ravenloft/content";

export async function putGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, g: VisualGeneration): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: generationSk(g.id), ...g } }));
}
export async function getGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualGeneration | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: generationSk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function updateGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, g: VisualGeneration): Promise<void> {
  await putGeneration(doc, table, campaignId, g);
}
function strip(i: Record<string, unknown>): VisualGeneration {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualGeneration;
}
