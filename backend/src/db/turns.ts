import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, padTurn } from "../keys";
import type { Turn, TurnStatus, TurnResult, NarrativeCard } from "@ravenloft/content";

const TURN_SK_PREFIX = "TURN#";

export async function putTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turn: Turn): Promise<void> {
  await doc.send(new PutCommand({ TableName: tableName, Item: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turn.turnId)}`, ...turn } }));
}

export async function getTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Turn | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` } }));
  return res.Item ? toTurn(res.Item) : null;
}

export async function listTurns(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<Turn[]> {
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": TURN_SK_PREFIX } }));
  return (res.Items ?? [])
    .filter((i) => !(i.SK as string).includes("#SUB#"))
    .map(toTurn)
    .sort((a, b) => a.turnId - b.turnId);
}

export async function getActiveTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<Turn | null> {
  const turns = await listTurns(doc, tableName, campaignId);
  return turns.length ? turns[turns.length - 1] : null;
}

export async function setTurnStatus(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, status: TurnStatus): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` },
    UpdateExpression: "SET #s = :s", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":s": status } }));
}

export async function saveTurnResult(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, result: TurnResult): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` },
    UpdateExpression: "SET #s = :s, #r = :r", ExpressionAttributeNames: { "#s": "status", "#r": "result" },
    ExpressionAttributeValues: { ":s": "RESOLVED", ":r": result } }));
}

export async function setTurnImage(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, kind: "event" | "result", url: string): Promise<void> {
  const attr = kind === "event" ? "eventImageUrl" : "resultImageUrl";
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` },
    UpdateExpression: "SET #a = :u", ExpressionAttributeNames: { "#a": attr }, ExpressionAttributeValues: { ":u": url } }));
}

export async function createNextTurnDraft(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Turn> {
  const turn: Turn = { turnId, status: "DRAFT", publicEvent: "", privateInfo: {}, cards: [], createdAt: new Date().toISOString() };
  await putTurn(doc, tableName, campaignId, turn);
  return turn;
}

function toTurn(item: Record<string, unknown>): Turn {
  return {
    turnId: item.turnId as number, status: item.status as TurnStatus, publicEvent: (item.publicEvent as string) ?? "",
    privateInfo: (item.privateInfo as Record<string, string>) ?? {}, cards: (item.cards as NarrativeCard[]) ?? [],
    createdAt: (item.createdAt as string) ?? "", result: item.result as TurnResult | undefined,
    eventImageUrl: (item.eventImageUrl as string | undefined) || undefined,
    resultImageUrl: (item.resultImageUrl as string | undefined) || undefined,
  };
}
