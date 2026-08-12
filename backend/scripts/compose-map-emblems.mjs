import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/**
 * Paints the canonical House emblems into the legend of the Valdren map.
 *
 * The map's own shields are decorative filler that contradicts the written
 * blazons, but the map's cartography — geography, city placement, the Five
 * Royal Roads, the Portuguese labels — is correct and expensive to reproduce.
 * So the map is edited rather than regenerated: only the sixteen legend slots
 * change, everything else is untouched.
 *
 * Geometry measured from the 1536x1024 map: the legend column of shields starts
 * at y=214 and repeats every 42.4px, each slot about 42x42 at x=31.
 */
const FIRST_CENTER_Y = 214;
const SPACING = 42.4;
const SLOT = { centerX: 52, width: 36, height: 39 };

/** Legend order, top to bottom. Must match the map exactly. */
const LEGEND = [
  "casa-valerius", "casa-vargen", "casa-auremont", "casa-rimerberg",
  "casa-do-ouro", "casa-khazdrun", "casa-solarion", "irmandade-dos-corvos",
  "ordem-do-sino", "casa-ferrumor", "ordem-dos-tres", "casa-karasoy",
  "casa-euralune", "grande-casa-ulgar", "cla-mandibula-de-osso", "casa-drakorys",
];

const MAP = process.argv[2];
const EMBLEM_DIR = process.argv[3];
const OUT_DIR = process.argv[4];
await mkdir(OUT_DIR, { recursive: true });

/**
 * Knocks the flat off-white field out of a generated emblem.
 *
 * A plain brightness threshold would also erase Karasoy's white horse and
 * Rimerberg's snowflakes, so instead this flood-fills inward from the border:
 * only background actually connected to the edge becomes transparent, and any
 * light shape enclosed by the shield survives.
 */
async function knockOutBackground(file, size = 256) {
  const { data, info } = await sharp(file)
    .resize(size, size, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: c } = info;
  const isPale = (i) => data[i] > 225 && data[i + 1] > 220 && data[i + 2] > 210;

  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }

  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    const i = p * c;
    if (!isPale(i)) continue;
    seen[p] = 1;
    data[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  return sharp(data, { raw: { width: w, height: h, channels: c } }).png().toBuffer();
}

async function prepare(file) {
  const cut = await knockOutBackground(file);
  const trimmed = await sharp(cut).trim({ threshold: 1 }).toBuffer();
  return sharp(trimmed)
    .resize(SLOT.width, SLOT.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

const composites = [];
const missing = [];
for (let i = 0; i < LEGEND.length; i++) {
  const file = `${EMBLEM_DIR}/emblem-${LEGEND[i]}.png`;
  try {
    const input = await prepare(file);
    composites.push({
      input,
      left: Math.round(SLOT.centerX - SLOT.width / 2),
      top: Math.round(FIRST_CENTER_Y + i * SPACING - SLOT.height / 2),
    });
  } catch {
    missing.push(LEGEND[i]);
  }
}

if (missing.length) console.log(`aviso: ${missing.length} brasão(ões) ausente(s): ${missing.join(", ")}`);

await sharp(MAP).composite(composites).png().toFile(`${OUT_DIR}/mapa-brasoes-novos.png`);

// Legend-only preview, magnified, so the result can be judged before the full
// map is adopted anywhere.
await sharp(`${OUT_DIR}/mapa-brasoes-novos.png`)
  .extract({ left: 0, top: 150, width: 240, height: 780 })
  .resize({ width: 480, kernel: "lanczos3" })
  .toFile(`${OUT_DIR}/preview-legenda.png`);

console.log(`${composites.length}/${LEGEND.length} brasões compostos`);
console.log(`  ${OUT_DIR}/mapa-brasoes-novos.png`);
console.log(`  ${OUT_DIR}/preview-legenda.png`);
