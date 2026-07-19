import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SEED_LORE, SEED_VISUAL_DIRECTIVES } from "./world-bible-seed.mjs";

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");
const force = process.argv.includes("--force");

function campaignPk(id) {
  return `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
}

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const Key = { PK: campaignPk(campaignId), SK: "WORLDBIBLE" };

async function main() {
  const existing = await doc.send(new GetCommand({ TableName: tableName, Key }));
  const has = Boolean(existing.Item);

  if (!confirm) {
    console.log(`[dry-run] Table: ${tableName}, Campaign: ${campaignId}`);
    console.log(`[dry-run] WORLDBIBLE currently ${has ? "EXISTS" : "is MISSING"}.`);
    if (has && !force) {
      console.log(`[dry-run] Would SKIP (already present). Pass --force to overwrite.`);
    } else {
      console.log(`[dry-run] Would write WORLDBIBLE (lore ${SEED_LORE.length} chars, visualDirectives ${SEED_VISUAL_DIRECTIVES.length} chars).`);
    }
    console.log(`Re-run with --confirm to apply.`);
    return;
  }

  if (has && !force) {
    console.log(`WORLDBIBLE already exists; skipping. Pass --force to overwrite.`);
    return;
  }

  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { ...Key, lore: SEED_LORE, visualDirectives: SEED_VISUAL_DIRECTIVES, updatedAt: new Date().toISOString() },
    }),
  );
  console.log(`WORLDBIBLE ${has ? "overwritten" : "seeded"} for ${campaignId}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
