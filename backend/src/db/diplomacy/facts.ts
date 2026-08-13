import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, campaignFactSk, campaignFactPrefix } from "../../keys";
import type { CampaignFact } from "@ravenloft/content";

export async function putFact(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, f: CampaignFact,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: campaignFactSk(f.id), ...f },
  }));
}

export async function listFacts(
  doc: DynamoDBDocumentClient, table: string, campaignId: string,
): Promise<CampaignFact[]> {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": campaignFactPrefix() },
  }));
  return (res.Items ?? []).map((i) => {
    const { PK, SK, ...rest } = i as any;
    return rest as CampaignFact;
  });
}
