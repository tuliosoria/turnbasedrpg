import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, houseSk, playerPk } from "../keys";
import { HttpError } from "../types/domain";
import type { House, Emblem, Attributes } from "@ravenloft/content";

export interface CreateHouseInput {
  displayName: string; codeHash: string;
  name: string; motto: string; emblem: Emblem;
  leaderName: string; heirName: string; castleName: string; townsText: string;
  historyText: string; specialty: string; weakness: string; attributes: Attributes;
}

function slugify(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "casa";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export async function createAccountAndHouse(
  doc: DynamoDBDocumentClient, tableName: string, campaignId: string, input: CreateHouseInput,
): Promise<{ houseId: string }> {
  const houseId = slugify(input.name);
  const createdAt = new Date().toISOString();
  const house: House = {
    houseId, name: input.name, motto: input.motto, emblem: input.emblem,
    leaderName: input.leaderName, heirName: input.heirName, castleName: input.castleName,
    townsText: input.townsText, historyText: input.historyText, specialty: input.specialty,
    weakness: input.weakness, attributes: input.attributes, createdAt,
  };
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: { PK: campaignPk(campaignId), SK: houseSk(houseId), ...house, ownerCodeHash: input.codeHash },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } },
      { Put: { TableName: tableName, Item: { PK: playerPk(input.codeHash), SK: "PROFILE", houseId, displayName: input.displayName, codeHash: input.codeHash },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } },
    ] }));
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException")
      throw new HttpError(409, "ACCOUNT_EXISTS", "Conta ou Casa já existe. Tente novamente.");
    throw e;
  }
  return { houseId };
}

export async function getHouse(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string): Promise<House | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) } }));
  if (!res.Item) return null;
  return toHouse(res.Item);
}

export async function listHouses(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<House[]> {
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "HOUSE#" } }));
  return (res.Items ?? []).map(toHouse);
}

export async function updateHouseAttributes(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string, attributes: Attributes): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) },
    UpdateExpression: "SET attributes = :a", ExpressionAttributeValues: { ":a": attributes } }));
}

function toHouse(item: Record<string, unknown>): House {
  return {
    houseId: item.houseId as string, name: item.name as string, motto: item.motto as string,
    emblem: item.emblem as Emblem, leaderName: item.leaderName as string, heirName: item.heirName as string,
    castleName: item.castleName as string, townsText: item.townsText as string, historyText: item.historyText as string,
    specialty: item.specialty as string, weakness: item.weakness as string,
    attributes: item.attributes as Attributes, createdAt: item.createdAt as string,
  };
}
