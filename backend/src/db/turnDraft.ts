import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, turnDraftSk } from "../keys";
import type { TurnDraft } from "@ravenloft/content";

export async function getTurnDraft(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<TurnDraft | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: turnDraftSk() } }),
  );
  const item = res.Item;
  if (!item) return null;
  const privateInfo: Record<string, string> = {};
  const raw = (item.privateInfo ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") privateInfo[k] = v;
  return {
    publicEvent: typeof item.publicEvent === "string" ? item.publicEvent : "",
    privateInfo,
    note: typeof item.note === "string" ? item.note : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
  };
}

export async function putTurnDraft(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: { publicEvent: string; privateInfo: Record<string, string>; note: string },
): Promise<TurnDraft> {
  const draft: TurnDraft = {
    publicEvent: input.publicEvent,
    privateInfo: input.privateInfo,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  await doc.send(
    new PutCommand({ TableName: tableName, Item: { PK: campaignPk(campaignId), SK: turnDraftSk(), ...draft } }),
  );
  return draft;
}

export async function deleteTurnDraft(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: turnDraftSk() } }),
  );
}
