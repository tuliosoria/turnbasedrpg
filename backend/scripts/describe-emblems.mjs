import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";

/**
 * Records each emblem's actual palette on its asset, so the prompt can state
 * the House's real colours instead of a hypothetical example.
 *
 * The prompt used to say "se a estrela é prateada, ela permanece prateada" —
 * an illustration, not a fact about this House. Measured against a generated
 * banner, the silver held but the field drifted from #031d43 (saturated navy)
 * to #0c1e32 (grey slate), because nothing ever told the model what navy.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

/** Dominant colours, ignoring the flat off-white field the emblems sit on. */
async function palette(url) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const { data, info } = await sharp(buf).resize(96, 96, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 235 && g > 232 && b > 225) continue;
    const k = `${r >> 4},${g >> 4},${b >> 4}`;
    const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(k, e);
  }
  const hex = (e) =>
    "#" + [e.r / e.n, e.g / e.n, e.b / e.n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const dark = sorted.filter((e) => (e.r + e.g + e.b) / e.n < 380);
  const light = sorted.filter((e) => (e.r + e.g + e.b) / e.n >= 380);
  return {
    field: dark[0] ? hex(dark[0]) : null,
    charge: light[0] ? hex(light[0]) : null,
  };
}

async function main() {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "VASSET#emblem-" },
    }),
  );
  const assets = (res.Items ?? []).filter((a) => a.assetType === "EMBLEM");

  for (const a of assets) {
    const p = await palette(a.storageUrl);
    const blazon = a.extractedVisualDescription ?? "";
    // Keep the blazon, append the measured colours.
    const base = blazon.split(" | CORES:")[0];
    const desc = [
      base,
      p.field || p.charge
        ? `CORES: campo ${p.field ?? "?"}; carga ${p.charge ?? "?"}`
        : null,
    ].filter(Boolean).join(" | ");

    console.log(`  ${String(a.id).padEnd(34)} campo ${p.field}  carga ${p.charge}`);
    if (confirm) {
      await doc.send(new PutCommand({ TableName: tableName, Item: { ...a, extractedVisualDescription: desc } }));
    }
  }
  console.log(confirm ? `\n${assets.length} brasões descritos.` : `\n[dry-run] ${assets.length} brasões. Use --confirm.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
