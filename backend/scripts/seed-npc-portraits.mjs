import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fullCodex } from "@ravenloft/content";

/**
 * Publica os retratos dos Major NPCs (gerados fora, na pasta de retratos) como
 * entidades visuais CHARACTER canônicas, uma por personagem, com um asset
 * PORTRAIT. É o que faz cada personagem aparecer no Acervo e ficar buscável por
 * id para a página /personagens/:id.
 *
 * Celene e Alic já têm entidade canônica (do seed original). Para eles NÃO
 * recriamos a entidade — apenas anexamos o novo retrato de corpo inteiro como
 * asset e o marcamos como retrato de referência, preservando o resto.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.IMAGES_BUCKET ?? "ravenloft-images-825081952316";
const portraitsDir = process.env.PORTRAITS_DIR ?? join(homedir(), "Desktop", "valdren-npc-retratos");
const confirm = process.argv.includes("--confirm");
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });

const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const base = `https://${bucket}.s3.${region}.amazonaws.com`;

// O único id do Codex que não bate com a entidade canônica já existente.
const ENTITY_ALIAS = { "lady-celene-valerius": "celene-valerius" };
const entityIdFor = (codexId) => ENTITY_ALIAS[codexId] ?? codexId;

async function getEntity(id) {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `VENTITY#${id}` } }));
  return res.Item ?? null;
}

async function uploadImages(entityId, png) {
  const thumb = await sharp(png).resize(640).png().toBuffer();
  const key = `visual/npc-${entityId}/original.png`;
  const thumbKey = `visual/npc-${entityId}/thumb.png`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: "image/png" }));
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbKey, Body: thumb, ContentType: "image/png" }));
  return { key, thumbKey };
}

function assetItem(entityId, npc, keys, now) {
  const assetId = `${entityId}-portrait`;
  return {
    PK: campaignPk(campaignId), SK: `VASSET#${assetId}`,
    id: assetId, campaignId, entityId, assetType: "PORTRAIT",
    storageKey: keys.key, storageUrl: `${base}/${keys.key}?v=${Date.now()}`,
    thumbnailStorageKey: keys.thumbKey, thumbnailUrl: `${base}/${keys.thumbKey}?v=${Date.now()}`,
    mimeType: "image/png", width: 1024, height: 1536, aspectRatio: "2:3", checksum: "",
    status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 2, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: ["IDENTITY"],
    cameraAngle: "corpo inteiro", viewType: "portrait",
    description: `Retrato de ${npc.name}${npc.role ? ` — ${npc.role}` : ""}`,
    extractedVisualDescription: "", consistencyScore: null, consistencyReport: null,
    tags: ["personagem", "retrato"], createdAt: now,
  };
}

function newEntity(entityId, npc, assetId, now) {
  const desc = [npc.role, npc.personality].filter(Boolean).join(". ");
  return {
    PK: campaignPk(campaignId), SK: `VENTITY#${entityId}`,
    id: entityId, campaignId, entityType: "CHARACTER", canonicalName: npc.name,
    aliases: [], slug: entityId, publicDescription: desc,
    immutableTraits: [], flexibleTraits: [], prohibitedChanges: [],
    visualKeywords: [], negativeInstructions: [], scaleDescription: "", culturalContext: "",
    houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
    wikiEntryId: null, status: "CANONICAL",
    canonicalAssetIds: [assetId], supportingAssetIds: [],
    referenceSheetAssetId: null, mapAssetId: null, version: 1, profile: null,
    createdAt: now, updatedAt: now,
  };
}

async function publish(npc) {
  const entityId = entityIdFor(npc.id);
  const file = join(portraitsDir, `portrait-${npc.id}.png`);
  if (!existsSync(file)) throw new Error(`arquivo ausente: ${file}`);
  const png = readFileSync(file);
  const keys = await uploadImages(entityId, png);
  const now = new Date().toISOString();
  const asset = assetItem(entityId, npc, keys, now);
  await doc.send(new PutCommand({ TableName: tableName, Item: asset }));

  const existing = await getEntity(entityId);
  if (existing) {
    // Preserva a entidade canônica; só garante o novo retrato como referência.
    const canonical = Array.from(new Set([...(existing.canonicalAssetIds ?? []), asset.id]));
    const merged = { ...existing, canonicalAssetIds: canonical, referenceSheetAssetId: asset.id, updatedAt: now };
    await doc.send(new PutCommand({ TableName: tableName, Item: merged }));
    return { entityId, url: asset.storageUrl, mode: "anexado" };
  }
  await doc.send(new PutCommand({ TableName: tableName, Item: newEntity(entityId, npc, asset.id, now) }));
  return { entityId, url: asset.storageUrl, mode: "criado" };
}

async function main() {
  let majors = fullCodex().filter((n) => n.tier === "MAJOR");
  if (only) majors = majors.filter((n) => n.id.includes(only));

  console.log(`Pasta de retratos: ${portraitsDir}`);
  const missing = majors.filter((n) => !existsSync(join(portraitsDir, `portrait-${n.id}.png`)));
  if (missing.length) console.log(`AVISO: ${missing.length} sem arquivo: ${missing.map((n) => n.id).join(", ")}`);

  if (!confirm) {
    console.log(`\n[dry-run] ${majors.length} personagens seriam publicados como CHARACTER canônico:`);
    for (const n of majors) console.log(`  ${entityIdFor(n.id).padEnd(28)} ← ${n.name}`);
    console.log("\nRode de novo com --confirm para publicar.");
    return;
  }

  let ok = 0;
  for (const [i, n] of majors.entries()) {
    try {
      const r = await publish(n);
      ok++;
      console.log(`  [${i + 1}/${majors.length}] ${n.name} (${r.mode})\n      ${r.url}`);
    } catch (e) {
      console.error(`  [${i + 1}/${majors.length}] ${n.name} FALHOU: ${e?.message ?? e}`);
    }
  }
  console.log(`\n${ok}/${majors.length} personagens publicados no canônico.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
