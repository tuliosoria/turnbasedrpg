import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, wikiSk } from "../keys";
import { WIKI_SECTION_IDS, DEFAULT_WIKI_ENTRIES, isCanonWikiSection, type WikiEntry } from "@ravenloft/content";

export interface WikiEntryInput {
  section: string;
  title: string;
  body: string;
  order: number;
}

function toEntry(item: Record<string, unknown>): WikiEntry {
  const entry: WikiEntry = {
    entryId: typeof item.entryId === "string" ? item.entryId : "",
    section: typeof item.section === "string" ? item.section : "",
    title: typeof item.title === "string" ? item.title : "",
    body: typeof item.body === "string" ? item.body : "",
    order: typeof item.order === "number" ? item.order : 0,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
  if (typeof item.imageUrl === "string" && item.imageUrl) entry.imageUrl = item.imageUrl;
  if (Array.isArray(item.imageUrls) && item.imageUrls.every((url) => typeof url === "string")) {
    entry.imageUrls = item.imageUrls;
    if (!entry.imageUrl) entry.imageUrl = item.imageUrls[0];
  } else if (entry.imageUrl) {
    entry.imageUrls = [entry.imageUrl];
  }
  return entry;
}

function sortEntries(entries: WikiEntry[]): WikiEntry[] {
  const sectionIndex = (id: string) => {
    const i = WIKI_SECTION_IDS.indexOf(id);
    return i === -1 ? WIKI_SECTION_IDS.length : i;
  };
  return entries.sort((a, b) => {
    const sa = sectionIndex(a.section);
    const sb = sectionIndex(b.section);
    if (sa !== sb) return sa - sb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

export function generateWikiId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

export async function listWikiEntries(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<WikiEntry[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
    }),
  );
  return sortEntries((res.Items ?? []).map(toEntry));
}

/**
 * Só os verbetes que descrevem o mundo.
 *
 * O motor de canon visual casa o texto de um pedido de imagem contra todo
 * verbete que receber. O guia de campanha fala de Fireball, spell slots e
 * níveis de classe — coisas que existem na mesa e não em Valdren — então pedir
 * "uma fogueira no acampamento" não pode arrastar regra nenhuma para dentro do
 * prompt como se fosse canon.
 */
export async function listCanonWikiEntries(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<WikiEntry[]> {
  const entries = await listWikiEntries(doc, tableName, campaignId);
  return entries.filter((entry) => isCanonWikiSection(entry.section));
}

export async function putWikiEntry(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  entry: WikiEntry,
): Promise<WikiEntry> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: wikiSk(entry.entryId), ...entry },
    }),
  );
  return entry;
}

export async function deleteWikiEntry(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  entryId: string,
): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: wikiSk(entryId) } }),
  );
}

/**
 * Populates the wiki with the default player-facing cosmology of Valdren, but
 * only when the wiki is currently empty. Returns how many entries were seeded
 * (0 if entries already exist), so seeding is safe to trigger more than once.
 */
export async function seedDefaultWiki(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<{ seeded: number }> {
  const existing = await listWikiEntries(doc, tableName, campaignId);
  if (existing.length > 0) return { seeded: 0 };

  const now = new Date().toISOString();
  for (const def of DEFAULT_WIKI_ENTRIES) {
    const imageUrls = def.imageUrls ?? (def.imageUrl ? [def.imageUrl] : undefined);
    const imageUrl = def.imageUrl ?? imageUrls?.[0];
    await putWikiEntry(doc, tableName, campaignId, {
      entryId: generateWikiId(),
      section: def.section,
      title: def.title,
      body: def.body,
      order: def.order,
      updatedAt: now,
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageUrls ? { imageUrls } : {}),
    });
  }
  return { seeded: DEFAULT_WIKI_ENTRIES.length };
}
