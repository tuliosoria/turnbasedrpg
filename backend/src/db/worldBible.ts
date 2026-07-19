import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, worldBibleSk } from "../keys";
import type { WorldBible } from "@ravenloft/content";

export async function getWorldBible(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<WorldBible | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: worldBibleSk() } }),
  );
  const item = res.Item;
  if (!item) return null;
  return {
    lore: typeof item.lore === "string" ? item.lore : "",
    visualDirectives: typeof item.visualDirectives === "string" ? item.visualDirectives : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

export async function putWorldBible(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: { lore: string; visualDirectives: string },
): Promise<WorldBible> {
  const worldBible: WorldBible = {
    lore: input.lore,
    visualDirectives: input.visualDirectives,
    updatedAt: new Date().toISOString(),
  };
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: worldBibleSk(), ...worldBible },
    }),
  );
  return worldBible;
}
