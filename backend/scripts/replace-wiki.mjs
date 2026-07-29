import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_WIKI_ENTRIES } from "../../shared/dist/index.js";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;

if (process.env.CONFIRM_REPLACE_WIKI !== "yes") {
  console.error("Refusing to replace live wiki. Set CONFIRM_REPLACE_WIKI=yes to continue.");
  process.exit(1);
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "entrada";
}

function entryIdFor(entry) {
  return `${entry.section}-${String(entry.order).padStart(3, "0")}-${slugify(entry.title)}`;
}

async function batchWrite(doc, requests) {
  for (let i = 0; i < requests.length; i += 25) {
    await doc.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: requests.slice(i, i + 25),
      },
    }));
  }
}

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const existing = await doc.send(new QueryCommand({
  TableName: TABLE_NAME,
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: { ":pk": PK, ":sk": "WIKI#" },
}));

const deleteRequests = (existing.Items ?? []).map((item) => ({
  DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
}));
await batchWrite(doc, deleteRequests);

const now = new Date().toISOString();
const putRequests = DEFAULT_WIKI_ENTRIES.map((entry) => {
  const entryId = entryIdFor(entry);
  return {
    PutRequest: {
      Item: {
        PK,
        SK: `WIKI#${entryId}`,
        entryId,
        section: entry.section,
        title: entry.title,
        body: entry.body,
        order: entry.order,
        updatedAt: now,
        ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
      },
    },
  };
});
await batchWrite(doc, putRequests);

console.log(`Deleted ${deleteRequests.length} old wiki entries.`);
console.log(`Inserted ${putRequests.length} canonical wiki entries.`);
