import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, npcDynamicPrefix, npcDynamicSk } from "../keys";
import { emptyDynamic, type NpcDynamic } from "@ravenloft/content";

function toDynamic(item: Record<string, unknown>): NpcDynamic {
  const d = emptyDynamic(
    typeof item.affiliation === "string" ? item.affiliation : "",
    typeof item.id === "string" ? item.id : "",
  );
  return {
    ...d,
    mood: typeof item.mood === "string" ? item.mood : "",
    location: typeof item.location === "string" ? item.location : "",
    objective: typeof item.objective === "string" ? item.objective : "",
    concerns: typeof item.concerns === "string" ? item.concerns : "",
    loyalty: typeof item.loyalty === "string" ? item.loyalty : "",
    relations: item.relations && typeof item.relations === "object" ? (item.relations as NpcDynamic["relations"]) : {},
    memory: Array.isArray(item.memory) ? (item.memory as NpcDynamic["memory"]) : [],
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

/** O estado vivo de um NPC, ou o estado vazio se ele nunca foi tocado. */
export async function getNpcDynamic(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  affiliation: string,
  id: string,
): Promise<NpcDynamic> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: npcDynamicSk(affiliation, id) } }),
  );
  return res.Item ? toDynamic(res.Item) : emptyDynamic(affiliation, id);
}

export async function listNpcDynamics(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<NpcDynamic[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": npcDynamicPrefix() },
    }),
  );
  return (res.Items ?? []).map(toDynamic);
}

export async function putNpcDynamic(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  dynamic: NpcDynamic,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: npcDynamicSk(dynamic.affiliation, dynamic.id), ...dynamic },
    }),
  );
}
