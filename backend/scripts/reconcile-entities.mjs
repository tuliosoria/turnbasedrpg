import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Links existing visual entities to their wiki entry by setting `wikiEntryId`.
 *
 * That link is what the generation pipeline walks to go from "this request
 * mentions Karasoy" to "attach Karasoy's emblem as a reference image". The ten
 * seeded entities predate the field and have it null, so their canon never
 * reaches a prompt.
 *
 * Matching is deliberately strict — the same exact-head comparison the UI uses.
 * A wrong link silently attaches the wrong House's heraldry, which is worse
 * than no link at all, so anything ambiguous is left for a human.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const titleHead = (t) => t.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();
/** Strip a parenthetical: "Solarion (Sahra-Lun)" yields both keys. */
const nameKeys = (n) => {
  const keys = [n];
  const paren = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) keys.push(paren[1], paren[2]);
  return keys.map((k) => fold(titleHead(k))).filter(Boolean);
};

async function listByPrefix(prefix) {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": prefix },
    }),
  );
  return res.Items ?? [];
}

function match(entity, entries) {
  const keys = nameKeys(entity.canonicalName ?? "");
  const hits = entries.filter((e) => keys.includes(fold(titleHead(e.title))));
  // Ambiguity is a reason to stop, not to guess.
  return hits.length === 1 ? hits[0] : null;
}

async function main() {
  const [entities, entries] = await Promise.all([listByPrefix("VENTITY#"), listByPrefix("WIKI#")]);
  const pending = entities.filter((e) => !e.wikiEntryId);

  const linked = [];
  const skipped = [];
  for (const e of pending) {
    const hit = match(e, entries);
    if (hit) linked.push({ e, hit });
    else skipped.push(e);
  }

  console.log(`${entities.length} entidades, ${pending.length} sem vínculo\n`);
  console.log("VINCULARÁ:");
  for (const { e, hit } of linked) console.log(`  ${e.canonicalName.padEnd(26)} -> ${hit.title}`);
  console.log("\nDEIXARÁ PARA VOCÊ (sem correspondência exata):");
  for (const e of skipped) console.log(`  ${e.canonicalName} [${e.entityType}]`);

  if (!confirm) {
    console.log("\nRode novamente com --confirm para aplicar.");
    return;
  }

  for (const { e, hit } of linked) {
    await doc.send(
      new PutCommand({
        TableName: tableName,
        Item: { ...e, wikiEntryId: hit.entryId, version: (e.version ?? 1) + 1, updatedAt: new Date().toISOString() },
      }),
    );
  }
  console.log(`\n${linked.length} vínculo(s) aplicado(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
