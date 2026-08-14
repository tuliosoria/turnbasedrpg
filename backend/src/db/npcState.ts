import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, npcStatePrefix, npcStateSk } from "../keys";
import { emptyNpcState, type NpcState } from "@ravenloft/content";

function toState(item: Record<string, unknown>): NpcState {
  return {
    houseKey: typeof item.houseKey === "string" ? item.houseKey : "",
    characterId: typeof item.characterId === "string" ? item.characterId : "",
    mood: typeof item.mood === "string" ? item.mood : "",
    favors: typeof item.favors === "string" ? item.favors : "",
    note: typeof item.note === "string" ? item.note : "",
    perceptions:
      item.perceptions && typeof item.perceptions === "object"
        ? (item.perceptions as Record<string, string>)
        : {},
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

/** O estado de um NPC, ou o estado vazio se o Mestre nunca o tocou. */
export async function getNpcState(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  houseKey: string,
  characterId: string,
): Promise<NpcState> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: npcStateSk(houseKey, characterId) } }),
  );
  return res.Item ? toState(res.Item) : emptyNpcState(houseKey, characterId);
}

/** Todos os estados que o Mestre já editou. */
export async function listNpcStates(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<NpcState[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": npcStatePrefix() },
    }),
  );
  return (res.Items ?? []).map(toState);
}

export async function putNpcState(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: { houseKey: string; characterId: string; mood: string; favors: string; note: string; perceptions: Record<string, string> },
): Promise<NpcState> {
  const state: NpcState = {
    houseKey: input.houseKey,
    characterId: input.characterId,
    mood: input.mood,
    favors: input.favors,
    note: input.note,
    perceptions: input.perceptions,
    updatedAt: new Date().toISOString(),
  };
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: npcStateSk(input.houseKey, input.characterId), ...state },
    }),
  );
  return state;
}
