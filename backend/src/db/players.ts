import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { campaignPk, houseSk, playerPk } from "../keys";
import { HttpError } from "../types/domain";

export interface PlayerProfile {
  houseId: string;
  displayName: string;
  codeHash: string;
}

export interface HouseClaim {
  houseId: string;
  displayName: string;
}

export interface ClaimInput {
  houseId: string;
  displayName: string;
  codeHash: string;
  playerToken: string;
}

export async function claimHouse(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: ClaimInput,
): Promise<void> {
  const pk = campaignPk(campaignId);
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: pk,
                SK: houseSk(input.houseId),
                houseId: input.houseId,
                displayName: input.displayName,
                codeHash: input.codeHash,
                claimedAt: new Date().toISOString(),
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: playerPk(input.codeHash),
                SK: "PROFILE",
                houseId: input.houseId,
                displayName: input.displayName,
                codeHash: input.codeHash,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
        ],
      }),
    );
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
      throw new HttpError(409, "HOUSE_TAKEN", "Esta Casa já foi escolhida.");
    }
    throw e;
  }
}

export async function getPlayerByCodeHash(
  doc: DynamoDBDocumentClient,
  tableName: string,
  codeHash: string,
): Promise<PlayerProfile | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: playerPk(codeHash), SK: "PROFILE" } }),
  );
  if (!res.Item) return null;
  return {
    houseId: res.Item.houseId as string,
    displayName: res.Item.displayName as string,
    codeHash: res.Item.codeHash as string,
  };
}

export async function listHouseClaims(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<Map<string, HouseClaim>> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "HOUSE#" },
    }),
  );
  const map = new Map<string, HouseClaim>();
  for (const item of res.Items ?? []) {
    map.set(item.houseId as string, {
      houseId: item.houseId as string,
      displayName: item.displayName as string,
    });
  }
  return map;
}
