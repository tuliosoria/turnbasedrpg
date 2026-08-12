import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import sharp from "sharp";

/**
 * Generates one canonical emblem per House from the blazon written in its wiki
 * entry, and registers each as a LOCKED visual entity.
 *
 * Why not crop the map: the shields drawn on the canonical map are decorative
 * filler, not heraldry. Eleven of the sixteen are the same radiating starburst
 * in different colours, and they contradict the written blazons — Vargen's grey
 * wolf, Rimerberg's black tower and Karasoy's white horse are all absent. The
 * written `Símbolo:` line is the real canon, so that is what gets drawn.
 *
 * Emblems deliberately do NOT use the campaign style bible. That bible
 * describes cinematic scene painting; an insignia needs flat, legible heraldic
 * treatment that stays readable when shrunk onto a banner in another image.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.IMAGES_BUCKET ?? "ravenloft-images-825081952316";
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const quality = process.env.OPENAI_IMAGE_QUALITY ?? "high";
const confirm = process.argv.includes("--confirm");
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });
const openai = apiKey ? new OpenAI({ apiKey, timeout: 600000, maxRetries: 0 }) : null;

const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const slugify = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const titleHead = (t) => t.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();

function emblemPrompt(house, blazon) {
  return [
    `Brasão heráldico da ${house}, do reino de fantasia de Valdren.`,
    "",
    `BLASÃO (desenhe exatamente isto): ${blazon}.`,
    "",
    "APRESENTAÇÃO OBRIGATÓRIA:",
    "- Um único escudo heráldico medieval (heater shield), visto de frente, centralizado.",
    "- Fundo liso e neutro, sem cenário, sem paisagem, sem personagens.",
    "- Heráldica pintada à mão para livro de cenário de RPG: formas sólidas, silhueta legível, contraste alto.",
    "- A carga central deve ser reconhecível mesmo reduzida ao tamanho de um estandarte distante.",
    "- Moldura simples do escudo; nenhuma borda decorativa ao redor da imagem.",
    "",
    "NUNCA inclua: texto, letras, números, marca d'água, moldura externa, múltiplos escudos, estilo anime ou cartoon.",
  ].join("\n");
}

async function loadHouses() {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
    }),
  );
  const out = [];
  for (const item of res.Items ?? []) {
    const m = String(item.body ?? "").slice(0, 1200).match(/\*\*S[íi]mbolo:\*\*\s*(.+)/);
    if (!m) continue;
    out.push({
      entryId: item.entryId,
      title: item.title,
      house: titleHead(item.title),
      blazon: m[1].replace(/[*_]/g, "").trim().replace(/[.;]$/, ""),
    });
  }
  return out.sort((a, b) => a.house.localeCompare(b.house));
}

async function generate(prompt) {
  const res = await openai.images.generate({ model, prompt, size: "1024x1024", quality, n: 1 });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("sem imagem na resposta");
  return Buffer.from(b64, "base64");
}

async function publish(h, png) {
  const id = `emblem-${slugify(h.house)}`;
  const thumb = await sharp(png).resize(512).png().toBuffer();
  const key = `visual/${id}/original.png`;
  const thumbKey = `visual/${id}/thumb.png`;
  for (const [Key, Body] of [[key, png], [thumbKey, thumb]]) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType: "image/png" }));
  }
  const now = new Date().toISOString();
  const base = `https://${bucket}.s3.${region}.amazonaws.com`;

  const entity = {
    PK: campaignPk(campaignId), SK: `VENTITY#${id}`,
    id, campaignId, entityType: "SYMBOL", canonicalName: `Brasão — ${h.house}`,
    aliases: [h.house], slug: id,
    publicDescription: `Brasão canônico da ${h.house}: ${h.blazon}.`,
    immutableTraits: [{ id: `${id}-t1`, text: h.blazon, source: "LORE", originAssetId: null, createdAt: now }],
    flexibleTraits: [], prohibitedChanges: ["a carga e as cores do brasão não podem mudar"],
    visualKeywords: [], negativeInstructions: [], scaleDescription: "", culturalContext: "",
    houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
    // Linked to the House's own wiki entry, which is how the pipeline walks
    // from "a request mentions Karasoy" to "attach Karasoy's emblem".
    wikiEntryId: h.entryId,
    status: "LOCKED", canonicalAssetIds: [`${id}-a`], supportingAssetIds: [],
    referenceSheetAssetId: null, mapAssetId: null, version: 1, profile: null,
    createdAt: now, updatedAt: now,
  };

  const asset = {
    PK: campaignPk(campaignId), SK: `VASSET#${id}-a`,
    id: `${id}-a`, campaignId, entityId: id, assetType: "EMBLEM",
    storageKey: key, storageUrl: `${base}/${key}?v=${Date.now()}`,
    thumbnailStorageKey: thumbKey, thumbnailUrl: `${base}/${thumbKey}?v=${Date.now()}`,
    mimeType: "image/png", width: 1024, height: 1024, aspectRatio: "1:1", checksum: "",
    status: "READY", canonicalLevel: "LOCKED", styleBibleVersion: 0, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: ["SYMBOL"],
    cameraAngle: "frontal", viewType: "emblem", description: `Brasão da ${h.house}`,
    extractedVisualDescription: h.blazon, consistencyScore: null, consistencyReport: null,
    tags: ["brasao", "heraldica"], createdAt: now,
  };

  await doc.send(new PutCommand({ TableName: tableName, Item: entity }));
  await doc.send(new PutCommand({ TableName: tableName, Item: asset }));
  return asset.storageUrl;
}

async function main() {
  let houses = await loadHouses();
  if (only) houses = houses.filter((h) => slugify(h.house).includes(slugify(only)));

  if (!confirm) {
    console.log(`[dry-run] ${houses.length} brasões seriam gerados com ${model} @ ${quality}`);
    for (const h of houses) console.log(`  ${h.house.padEnd(30)} ${h.blazon}`);
    console.log("\nRode novamente com --confirm para gerar.");
    return;
  }
  if (!openai) throw new Error("OPENAI_API_KEY ausente");

  let ok = 0;
  for (const [i, h] of houses.entries()) {
    const t0 = Date.now();
    try {
      const png = await generate(emblemPrompt(h.house, h.blazon));
      const url = await publish(h, png);
      ok++;
      console.log(`  [${i + 1}/${houses.length}] ${h.house} — ${Math.round((Date.now() - t0) / 1000)}s\n      ${url}`);
    } catch (e) {
      console.error(`  [${i + 1}/${houses.length}] ${h.house} FALHOU: ${e?.message ?? e}`);
    }
  }
  console.log(`\n${ok}/${houses.length} brasões publicados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
