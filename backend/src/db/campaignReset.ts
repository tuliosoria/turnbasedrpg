import { DynamoDBDocumentClient, QueryCommand, ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, worldBibleSk } from "../keys";
import { createNextTurnDraft } from "./turns";

export interface ResetResult {
  deleted: number;
}

type Key = { PK: string; SK: string };

/**
 * Wipes a campaign back to a fresh start: deletes all houses, turns and
 * submissions for the campaign, plus every player account, then recreates
 * TURN#001 as a DRAFT. The World Bible (lore + visual directives) and the
 * Valdren wiki entries are preserved.
 */
export async function resetCampaign(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<ResetResult> {
  const keys: Key[] = [];

  let campaignEsk: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": campaignPk(campaignId) },
        ExclusiveStartKey: campaignEsk,
      }),
    );
    for (const item of res.Items ?? []) {
      if (item.SK === worldBibleSk()) continue;
      if (typeof item.SK === "string" && item.SK.startsWith("WIKI#")) continue;
      keys.push({ PK: item.PK as string, SK: item.SK as string });
    }
    campaignEsk = res.LastEvaluatedKey;
  } while (campaignEsk);

  let playerEsk: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :p)",
        ExpressionAttributeValues: { ":p": "PLAYER#" },
        ExclusiveStartKey: playerEsk,
      }),
    );
    for (const item of res.Items ?? []) {
      keys.push({ PK: item.PK as string, SK: item.SK as string });
    }
    playerEsk = res.LastEvaluatedKey;
  } while (playerEsk);

  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: { [tableName]: batch.map((Key) => ({ DeleteRequest: { Key } })) },
      }),
    );
  }

  await createNextTurnDraft(doc, tableName, campaignId, 1);

  return { deleted: keys.length };
}
