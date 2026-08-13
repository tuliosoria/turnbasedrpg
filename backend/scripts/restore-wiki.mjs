import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { readFile, readdir } from "node:fs/promises";

/**
 * Devolve os verbetes ao que eram num backup.
 *
 * Escrito junto com a reescrita, não depois dela: um caminho de volta que só
 * existe depois que der errado não é um caminho de volta.
 *
 *   node scripts/restore-wiki.mjs                      # lista os backups
 *   node scripts/restore-wiki.mjs <arquivo>            # mostra o que mudaria
 *   node scripts/restore-wiki.mjs <arquivo> --confirm  # restaura
 *   node scripts/restore-wiki.mjs <arquivo> --only=casa-vargen --confirm
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
const file = process.argv[2]?.startsWith("--") ? null : process.argv[2];
const DIR = new URL("../../backups/wiki/", import.meta.url);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

/** Desembrulha o formato do DynamoDB ({"S": "x"}) para valores simples. */
function plain(attr) {
  const [type, value] = Object.entries(attr)[0];
  if (type === "S" || type === "B") return value;
  if (type === "N") return Number(value);
  if (type === "BOOL") return value;
  if (type === "NULL") return null;
  if (type === "L") return value.map(plain);
  if (type === "M") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  throw new Error(`tipo não suportado: ${type}`);
}

async function main() {
  if (!file) {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort();
    console.log(files.length ? `Backups:\n${files.map((f) => `  ${f}`).join("\n")}` : "Nenhum backup.");
    return;
  }

  const raw = JSON.parse(await readFile(new URL(file, DIR), "utf-8"));
  const items = raw.Items.map((i) => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, plain(v)])));
  const targets = items.filter((i) => !only || only.some((k) => String(i.entryId ?? i.SK).includes(k)));

  if (!confirm) {
    console.log(`[dry-run] restauraria ${targets.length} de ${items.length} verbetes:`);
    for (const t of targets.slice(0, 20)) console.log(`  ${t.title} (${String(t.body ?? "").length} chars)`);
    if (targets.length > 20) console.log(`  … e mais ${targets.length - 20}`);
    console.log("\nRode com --confirm para restaurar.");
    return;
  }

  for (const item of targets) {
    await doc.send(new PutCommand({ TableName: tableName, Item: item }));
    console.log(`  restaurado: ${item.title}`);
  }
  console.log(`\n${targets.length} verbetes restaurados de ${file}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
