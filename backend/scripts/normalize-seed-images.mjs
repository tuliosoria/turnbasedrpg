// Normalizes the 10 canonical Valdren source images into the exact filenames
// expected by SEED_ITEMS (backend/src/visual/seed.ts), converting every source
// (mixed .jpg/.JPG/.PNG) to PNG and capping size to 1536x1024 (fit inside).
//
// Usage: node scripts/normalize-seed-images.mjs <srcDir> <outDir>
import sharp from "sharp";
import { join } from "node:path";

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT) {
  console.error("Usage: node normalize-seed-images.mjs <srcDir> <outDir>");
  process.exit(1);
}

// [ sourceFileName, targetFileName (must match SEED_ITEMS.file) ]
const MAP = [
  ["Principe Alic Valerius.png", "Principe Alic Valerius.png"],
  ["Lady Celene Valerius.png", "Lady Celene Valerius.png"],
  ["Mapa Oficial.png", "Mapa Oficial.png"],
  ["Khar-Durak, a Cidade da Montanha Viva.jpg", "Khar-Durak.png"],
  ["Euralune Cidade - Ninho Alto.JPG", "Euralune Cidade - Ninho Alto.png"],
  ["Solarion Sahra-Lun.PNG", "Solarion Sahra-Lun.png"],
  ["Elfos de Solarion.PNG", "Elfos de Solarion.png"],
  ["Elfos em Sahra-Lun.PNG", "Elfos de Sahra-Lun.png"],
  ["Gnomos de Euralune.jpg", "Gnomos de Euralune.png"],
  ["Mandibula de Osso.JPG", "Mandibula de Osso.png"],
];

for (const [src, dst] of MAP) {
  const buf = await sharp(join(SRC, src))
    .resize({ width: 1536, height: 1024, fit: "inside", withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();
  await sharp(buf).toFile(join(OUT, dst));
  console.log(`    ${dst}  (${(buf.length / 1024).toFixed(0)} KB)`);
}
console.log(`    ${MAP.length} images normalized`);
