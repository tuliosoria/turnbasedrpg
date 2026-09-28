import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, worldBibleSk, entityPrefix, styleBiblePrefix, bookPrefix, assetPrefix } from "../keys";
import { batchDeleteKeys } from "./batchDelete";
import { createNextTurnDraft } from "./turns";

export interface ResetResult {
  deleted: number;
}

type Key = { PK: string; SK: string };

/**
 * Wipes a campaign back to a fresh start: deletes all houses, turns and
 * submissions for the campaign, plus every player account, then recreates
 * TURN#001 as a DRAFT.
 *
 * Hand-authored canon survives: the World Bible (lore + visual directives),
 * the Valdren wiki, the GM bible, novel chapters, and the visual canon —
 * entity sheets, the style bible, and canonical images. Sheets point at those
 * images; deleting the assets and keeping the sheets leaves the canon broken.
 * Image generations (VGEN#) are disposable attempts and go with the play state.
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
      if (typeof item.SK === "string" && item.SK.startsWith("GM#")) continue;
      if (typeof item.SK === "string" && item.SK.startsWith(entityPrefix())) continue;
      if (typeof item.SK === "string" && item.SK.startsWith(styleBiblePrefix())) continue;
      if (typeof item.SK === "string" && item.SK.startsWith(bookPrefix())) continue;
      if (typeof item.SK === "string" && item.SK.startsWith(assetPrefix())) continue;
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

  await batchDeleteKeys(doc, tableName, keys);

  await createNextTurnDraft(doc, tableName, campaignId, 1);

  return { deleted: keys.length };
}
