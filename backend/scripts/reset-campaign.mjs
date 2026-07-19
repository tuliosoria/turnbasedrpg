import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SEED_LORE, SEED_VISUAL_DIRECTIVES } from "./world-bible-seed.mjs";

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

function campaignPk(id) {
  return `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
}
function padTurn(n) {
  return String(n).padStart(3, "0");
}

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

async function listCampaignItems() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": campaignPk(campaignId) },
        ExclusiveStartKey,
      }),
    );
    for (const it of res.Items ?? []) items.push({ PK: it.PK, SK: it.SK });
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function listPlayerItems() {
  // PLAYER# items are keyed by their own PK; a Scan is needed. Kept minimal.
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :p)",
        ExpressionAttributeValues: { ":p": "PLAYER#" },
        ExclusiveStartKey,
      }),
    );
    for (const it of res.Items ?? []) items.push({ PK: it.PK, SK: it.SK });
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function deleteAll(keys) {
  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((Key) => ({ DeleteRequest: { Key } })),
        },
      }),
    );
  }
}

async function seedFirstTurn() {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: campaignPk(campaignId),
        SK: `TURN#${padTurn(1)}`,
        turnId: 1,
        status: "DRAFT",
        publicEvent: "",
        privateInfo: {},
        cards: [],
        createdAt: new Date().toISOString(),
      },
    }),
  );
}

async function seedWorldBible() {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: campaignPk(campaignId),
        SK: "WORLDBIBLE",
        lore: SEED_LORE,
        visualDirectives: SEED_VISUAL_DIRECTIVES,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}

async function main() {
  const campaignItems = await listCampaignItems();
  const playerItems = await listPlayerItems();
  const all = [...campaignItems, ...playerItems];

  if (!confirm) {
    console.log(`[dry-run] Table: ${tableName}, Campaign: ${campaignId}`);
    console.log(`[dry-run] Would delete ${all.length} item(s):`);
    for (const k of all) console.log(`  - ${k.PK} / ${k.SK}`);
    console.log(`[dry-run] Would seed TURN#001 as DRAFT.`);
    console.log(`[dry-run] Would seed WORLDBIBLE (lore + visualDirectives).`);
    console.log(`Re-run with --confirm to apply.`);
    return;
  }

  await deleteAll(all);
  await seedFirstTurn();
  await seedWorldBible();
  console.log(`Reset complete: deleted ${all.length} item(s), seeded TURN#001 (DRAFT) and WORLDBIBLE.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
