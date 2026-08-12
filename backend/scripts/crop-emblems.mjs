import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/**
 * Cuts the sixteen House shields out of the legend column of the canonical
 * Valdren map. The map is the authoritative heraldry: prose like "uma estrela
 * de oito pontas sobre um cavalo branco" is satisfied by countless drawings, so
 * only the shield image itself holds the arms steady across generations.
 *
 * Geometry measured from the 1536x1024 map: the column of shields starts at
 * y=210 and repeats every 42.5px, each shield about 34x40.
 */
const FIRST_CENTER_Y = 214;
const SPACING = 42.4;
const BOX = { left: 31, width: 42, height: 42 };

export const HOUSES = [
  "Casa Valerius", "Casa Vargen", "Casa Auremont", "Casa Rimerberg",
  "Casa do Ouro", "Casa Khazdrun", "Casa Solarion", "Irmandade dos Corvos",
  "Ordem do Sino", "Casa Ferrumor", "Ordem dos Três", "Casa Karasoy",
  "Casa Euralune", "Grande Casa Ulgar", "Clã Mandíbula de Osso", "Casa Drakorys",
];

export function slug(name) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const MAP = process.argv[2];
const OUT = process.argv[3];
await mkdir(OUT, { recursive: true });

const files = [];
for (let i = 0; i < HOUSES.length; i++) {
  const top = Math.round(FIRST_CENTER_Y + i * SPACING - BOX.height / 2);
  const file = `${OUT}/${slug(HOUSES[i])}.png`;
  await sharp(MAP)
    .extract({ left: BOX.left, top, width: BOX.width, height: BOX.height })
    // The source is only ~46px wide. Upscaling makes it usable as a reference
    // image without pretending to add detail that was never there.
    .resize({ width: 512, kernel: "lanczos3" })
    .png()
    .toFile(file);
  files.push(file);
}

// Contact sheet so the alignment can be eyeballed before anything is published.
const thumbs = await Promise.all(files.map((f) => sharp(f).resize(120, 130, { fit: "fill" }).toBuffer()));
await sharp({ create: { width: 120 * 8, height: 130 * 2, channels: 3, background: "#fff" } })
  .composite(thumbs.map((input, i) => ({ input, left: (i % 8) * 120, top: Math.floor(i / 8) * 130 })))
  .png()
  .toFile(`${OUT}/contact-sheet.png`);

console.log(`${files.length} brasões recortados + contact-sheet.png`);
