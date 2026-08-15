import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, turnDraftSk } from "../keys";
import type { TurnDraft, TurnDraftResolution } from "@ravenloft/content";

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
    eventImageUrl: typeof item.eventImageUrl === "string" && item.eventImageUrl ? item.eventImageUrl : undefined,
    resolution: readResolution(item.resolution),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
  };
}

function readResolution(raw: unknown): TurnDraftResolution | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const houseResults: Record<string, string> = {};
  const hr = (r.houseResults ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(hr)) if (typeof v === "string") houseResults[k] = v;
  const discoveries = Array.isArray(r.discoveries) ? r.discoveries.filter((d): d is string => typeof d === "string") : [];
  return {
    publicResult: typeof r.publicResult === "string" ? r.publicResult : "",
    houseResults,
    discoveries,
  };
}

export async function putTurnDraft(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: { publicEvent: string; privateInfo: Record<string, string>; note: string; eventImageUrl?: string; resolution?: TurnDraftResolution },
): Promise<TurnDraft> {
  const draft: TurnDraft = {
    publicEvent: input.publicEvent,
    privateInfo: input.privateInfo,
    note: input.note,
    ...(input.eventImageUrl ? { eventImageUrl: input.eventImageUrl } : {}),
    ...(input.resolution ? { resolution: input.resolution } : {}),
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
