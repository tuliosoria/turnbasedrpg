import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { pathToFileURL } from "node:url";
import { DEFAULT_WIKI_ENTRIES } from "../../shared/dist/index.js";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "entrada";
}

export function entryIdFor(entry) {
  return `${entry.section}-${String(entry.order).padStart(3, "0")}-${slugify(entry.title)}`;
}

export function validateDefaultWikiEntries(entries) {
  if (entries.length < 80) throw new Error(`Expected at least 80 canonical wiki entries, found ${entries.length}.`);
  const atlas = entries.find((entry) => entry.title === "Atlas de Valdren");
  if (!atlas) throw new Error("Expected canonical defaults to include Atlas de Valdren.");
  const atlasImages = atlas.imageUrls ?? (atlas.imageUrl ? [atlas.imageUrl] : []);
  if (!atlasImages.includes("/valdren-map.png")) {
    throw new Error("Expected Atlas de Valdren to include /valdren-map.png.");
  }
  if (!entries.some((entry) => entry.title === "Casa Khazdrun — A Montanha e a Maré")) {
    throw new Error("Expected canonical defaults to include Casa Khazdrun.");
  }
  if (!entries.some((entry) => entry.title === "A ameaça do Norte")) {
    throw new Error("Expected canonical defaults to include A ameaça do Norte.");
  }
}

export async function listExistingWikiKeys(doc, tableName, pk) {
  const keys = [];
  let ExclusiveStartKey;
  do {
    const result = await doc.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": pk, ":sk": "WIKI#" },
      ExclusiveStartKey,
    }));
    for (const item of result.Items ?? []) keys.push({ PK: item.PK, SK: item.SK });
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return keys;
}

export async function batchWriteAll(doc, tableName, requests, options = {}) {
  const maxAttempts = options.maxAttempts ?? 8;
  const baseDelayMs = options.baseDelayMs ?? 100;

  for (let i = 0; i < requests.length; i += 25) {
    let pending = requests.slice(i, i + 25);
    for (let attempt = 1; pending.length > 0 && attempt <= maxAttempts; attempt++) {
      const result = await doc.send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
      pending = result.UnprocessedItems?.[tableName] ?? [];
      if (pending.length > 0 && attempt < maxAttempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
    if (pending.length > 0) {
      throw new Error(`DynamoDB left ${pending.length} unprocessed wiki write requests after ${maxAttempts} attempts.`);
    }
  }
}

export function buildPutRequests(entries, pk, now = new Date().toISOString()) {
  return entries.map((entry) => {
    const entryId = entryIdFor(entry);
    const imageUrls = entry.imageUrls ?? (entry.imageUrl ? [entry.imageUrl] : undefined);
    const imageUrl = entry.imageUrl ?? imageUrls?.[0];
    return {
      PutRequest: {
        Item: {
          PK: pk,
          SK: `WIKI#${entryId}`,
          entryId,
          section: entry.section,
          title: entry.title,
          body: entry.body,
          order: entry.order,
          updatedAt: now,
          ...(imageUrl ? { imageUrl } : {}),
          ...(imageUrls ? { imageUrls } : {}),
        },
      },
    };
  });
}

export async function replaceWiki(doc, { tableName = TABLE_NAME, pk = PK, entries = DEFAULT_WIKI_ENTRIES } = {}) {
  validateDefaultWikiEntries(entries);
  const existingKeys = await listExistingWikiKeys(doc, tableName, pk);
  const putRequests = buildPutRequests(entries, pk);
  await batchWriteAll(doc, tableName, putRequests);
  const canonicalKeys = new Set(putRequests.map((request) => request.PutRequest.Item.SK));
  const staleKeys = existingKeys.filter((key) => !canonicalKeys.has(key.SK));
  await batchWriteAll(doc, tableName, staleKeys.map((Key) => ({ DeleteRequest: { Key } })));
  return { deleted: staleKeys.length, inserted: putRequests.length };
}

async function main() {
  if (process.env.CONFIRM_REPLACE_WIKI !== "yes") {
    console.error("Refusing to replace live wiki. Set CONFIRM_REPLACE_WIKI=yes to continue.");
    process.exit(1);
  }

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const result = await replaceWiki(doc);
  console.log(`Deleted ${result.deleted} old wiki entries.`);
  console.log(`Inserted ${result.inserted} canonical wiki entries.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
