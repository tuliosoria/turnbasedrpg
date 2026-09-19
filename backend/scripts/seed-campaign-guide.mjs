import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_GUIDE_ENTRIES, CAMPAIGN_GUIDE_SECTION } from "../../shared/dist/index.js";

/**
 * Publica o guia de campanha como verbetes da wiki.
 *
 * O texto é autorado em shared/src/lore/dnd, revisável em diff, e este script
 * o grava no DynamoDB — de onde o site o serve e onde o Acervo pode editá-lo
 * depois. O seedWiki do backend não serve aqui: ele desiste se a campanha já
 * tem verbetes, e esta tem mais de cem.
 *
 * A identidade de um verbete é seção + título. Rodar duas vezes atualiza o
 * corpo do que já existe em vez de criar cópia, então o script pode ser rodado
 * de novo a cada mudança no texto — mas edições feitas pelo Acervo naquele
 * verbete são sobrescritas, que é o preço de manter a fonte em git.
 *
 *   node scripts/seed-campaign-guide.mjs            # mostra o que faria
 *   node scripts/seed-campaign-guide.mjs --confirm  # grava
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";

const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

export function planCampaignGuideSeed(existing, entries = CAMPAIGN_GUIDE_ENTRIES) {
  const bySectionTitle = new Map(existing.map((e) => [`${e.section}::${e.title}`, e]));

  const planned = entries.map((def) => {
    const found = bySectionTitle.get(`${def.section}::${def.title}`);
    return { def, existing: found, action: found ? "atualiza" : "cria" };
  });

  // Verbetes que já estão na seção e saíram do guia: renomeados ou removidos
  // na fonte. O script não apaga nada, mas avisar evita duplicata silenciosa.
  const plannedTitles = new Set(entries.map((d) => d.title));
  const orphans = existing.filter(
    (e) => e.section === CAMPAIGN_GUIDE_SECTION && !plannedTitles.has(e.title),
  );

  return { planned, orphans };
}

export async function loadExistingWiki(doc, { table = tableName, campaign = campaignId } = {}) {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaign), ":sk": "WIKI#" },
  }));
  return res.Items ?? [];
}

export async function writeCampaignGuide(doc, planned, { table = tableName, campaign = campaignId, now = new Date().toISOString() } = {}) {
  for (const { def, existing: found } of planned) {
    const entryId = found?.entryId ?? randomUUID();
    await doc.send(new PutCommand({
      TableName: table,
      Item: {
        PK: campaignPk(campaign),
        SK: `WIKI#${entryId}`,
        entryId,
        section: def.section,
        title: def.title,
        body: def.body,
        order: def.order,
        updatedAt: now,
        ...(found?.imageUrl ? { imageUrl: found.imageUrl } : {}),
        ...(found?.imageUrls ? { imageUrls: found.imageUrls } : {}),
      },
    }));
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  const existing = await loadExistingWiki(doc);
  const { planned, orphans } = planCampaignGuideSeed(existing);

  for (const p of planned) {
    console.log(`  ${p.action.padEnd(8)} ${p.def.title} (${p.def.body.length} chars)`);
  }
  if (orphans.length) {
    console.warn(`\naviso: ${orphans.length} verbete(s) na seção fora do guia, deixados como estão:`);
    for (const o of orphans) console.warn(`  ${o.title}`);
  }

  const creating = planned.filter((p) => p.action === "cria").length;
  console.log(`\n${creating} a criar, ${planned.length - creating} a atualizar.`);

  if (!confirm) {
    console.log("Rode com --confirm para gravar.");
    return;
  }

  await writeCampaignGuide(doc, planned);
  for (const { def } of planned) console.log(`  gravado: ${def.title}`);
  console.log(`\n${planned.length} verbetes do guia publicados.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
