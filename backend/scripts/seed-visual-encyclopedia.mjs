import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { makeDocClient } from "../src/db/dynamo";
import { makeImageStore } from "../src/storage/images";
import { getActiveStyleBible, putStyleBible } from "../src/db/visual/styleBible";
import { getEntity, putEntity } from "../src/db/visual/entities";
import { putAsset } from "../src/db/visual/assets";
import { seedVisualEncyclopedia, SEED_ITEMS } from "../src/visual/seed";

/**
 * Grava as 10 imagens canônicas da enciclopédia visual.
 *
 * Antes isto era POST /api/admin/visual/seed no gateway de 30s, o que puxava
 * Sharp e o layer de imagens para cada requisição HTTP. O seed continua no
 * mesmo módulo (`src/visual/seed.ts`); só o caminho mudou. LOCKED no mapa
 * oficial permanece — é nível de dado, não verbo de API.
 *
 *   npm run seed-visual --workspace backend            # mostra o que faria
 *   npm run seed-visual --workspace backend -- --confirm
 *
 * Imagens: SEED_IMAGE_DIR, ou normaliza valdren-context/valdren-images.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// The npm script bundles this file to backend/.seed-visual.mjs; the source
// itself lives in backend/scripts/. Either way we need the backend root.
const BACKEND = HERE.endsWith("scripts") ? join(HERE, "..") : HERE;
const REPO = join(BACKEND, "..");
const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.IMAGES_BUCKET ?? "ravenloft-images-825081952316";
const confirm = process.argv.includes("--confirm");

async function prepareImageDir() {
  if (process.env.SEED_IMAGE_DIR) return { dir: process.env.SEED_IMAGE_DIR, ephemeral: false };
  const src = join(REPO, "valdren-context/valdren-images");
  const dir = await mkdtemp(join(tmpdir(), "valdren-seed-"));
  const result = spawnSync(
    process.execPath,
    [join(BACKEND, "scripts/normalize-seed-images.mjs"), src, dir],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("Falha ao normalizar as imagens de seed.");
  }
  return { dir, ephemeral: true };
}

async function main() {
  console.log(`campanha: ${campaignId}`);
  console.log(`tabela:   ${tableName}`);
  console.log(`bucket:   ${bucket}`);
  console.log("itens:");
  for (const item of SEED_ITEMS) {
    console.log(`  ${item.canonicalLevel.padEnd(10)} ${item.file}  →  ${item.name}`);
  }

  if (!confirm) {
    console.log("\nDry-run. Passe --confirm para gravar.");
    return;
  }

  const prepared = await prepareImageDir();
  let counter = 0;
  try {
    const doc = makeDocClient(region);
    const store = makeImageStore(
      bucket,
      `https://${bucket}.s3.${region}.amazonaws.com`,
      region,
    );
    const summary = await seedVisualEncyclopedia(
      {
        getActiveStyleBible: (c) => getActiveStyleBible(doc, tableName, c),
        putStyleBible: (c, b) => putStyleBible(doc, tableName, c, b),
        getEntity: (c, id) => getEntity(doc, tableName, c, id),
        putEntity: (c, e) => putEntity(doc, tableName, c, e),
        putAsset: (c, a) => putAsset(doc, tableName, c, a),
        loadSeedImage: (file) => readFile(join(prepared.dir, file)),
        uploadAsset: async (assetId, original) => {
          const { default: sharp } = await import("sharp");
          const thumb = await sharp(original).resize(512).png().toBuffer();
          return store.uploadVisualAsset(assetId, original, thumb);
        },
        newId: () => `${Date.now().toString(36)}-${(counter++).toString(36)}`,
        now: () => new Date().toISOString(),
      },
      campaignId,
    );
    console.log("\nresumo:", summary);
  } finally {
    if (prepared.ephemeral) await rm(prepared.dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
