import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, gmSk } from "../keys";
import { GM_SECTION_IDS, DEFAULT_GM_ENTRIES, type GmEntry } from "@ravenloft/content";

export interface GmEntryInput {
  section: string;
  title: string;
  body: string;
  order: number;
}

function toEntry(item: Record<string, unknown>): GmEntry {
  return {
    entryId: typeof item.entryId === "string" ? item.entryId : "",
    section: typeof item.section === "string" ? item.section : "",
    title: typeof item.title === "string" ? item.title : "",
    body: typeof item.body === "string" ? item.body : "",
    order: typeof item.order === "number" ? item.order : 0,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function sortEntries(entries: GmEntry[]): GmEntry[] {
  const sectionIndex = (id: string) => {
    const i = GM_SECTION_IDS.indexOf(id);
    return i === -1 ? GM_SECTION_IDS.length : i;
  };
  return entries.sort((a, b) => {
    const sa = sectionIndex(a.section);
    const sb = sectionIndex(b.section);
    if (sa !== sb) return sa - sb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

export function generateGmId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

export async function listGmEntries(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<GmEntry[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "GM#" },
    }),
  );
  return sortEntries((res.Items ?? []).map(toEntry));
}

export async function putGmEntry(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  entry: GmEntry,
): Promise<GmEntry> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: gmSk(entry.entryId), ...entry },
    }),
  );
  return entry;
}

export async function deleteGmEntry(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  entryId: string,
): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: gmSk(entryId) } }),
  );
}

/**
 * Populates the GM bible with the default secret lore of Valdren, but only when
 * it is currently empty. Returns how many entries were seeded (0 if entries
 * already exist), so seeding is safe to trigger more than once.
 */
export async function seedDefaultGm(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<{ seeded: number }> {
  const existing = await listGmEntries(doc, tableName, campaignId);
  if (existing.length > 0) return { seeded: 0 };

  const now = new Date().toISOString();
  for (const def of DEFAULT_GM_ENTRIES) {
    await putGmEntry(doc, tableName, campaignId, {
      entryId: generateGmId(),
      section: def.section,
      title: def.title,
      body: def.body,
      order: def.order,
      updatedAt: now,
    });
  }
  return { seeded: DEFAULT_GM_ENTRIES.length };
}
