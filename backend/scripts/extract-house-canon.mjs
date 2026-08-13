import { readFile, writeFile } from "node:fs/promises";

/**
 * Extrai o dossiê de cada Casa dos documentos canônicos.
 *
 * Este material já existia e nunca foi publicado: `04_POPULACAO` traz uma seção
 * por Casa com região, cidade principal, estrutura social, capacidade militar e
 * pressão demográfica. Publicar o que o autor já escreveu vale mais do que
 * gerar prosa nova por cima — e não corre o risco de contradizer o cânone.
 *
 * Nada aqui é inventado. Se um campo não está no documento, sai vazio.
 */

const ROOT = new URL("../../valdren-context/", import.meta.url);
const OUT = new URL("../../shared/src/lore/houseCanon.ts", import.meta.url);

const slugify = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const clean = (s) =>
  s.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();

/** Um número escrito como 395.000 ou 1.500. */
function parseNumber(text) {
  const m = text.match(/([\d]{1,3}(?:\.\d{3})+|\d{3,})/);
  return m ? Number(m[1].replace(/\./g, "")) : null;
}

/** Divide um documento em blocos por cabeçalho de nível `level`. */
function sections(doc, level) {
  const re = new RegExp(`^#{${level}}\\s+(.+)$`, "gm");
  const out = [];
  let m;
  const marks = [];
  while ((m = re.exec(doc))) marks.push({ title: m[1].trim(), start: m.index, after: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    out.push({ title: marks[i].title, body: doc.slice(marks[i].after, marks[i + 1]?.start ?? doc.length) });
  }
  return out;
}

function subsection(body, titleRe) {
  for (const s of sections(body, 2)) if (titleRe.test(s.title)) return clean(s.body);
  return "";
}

async function main() {
  const pop = await readFile(new URL("PUBLICO/04_POPULACAO_DEMOGRAFIA_E_CAPACIDADE_MILITAR.md", ROOT), "utf-8");

  const houses = {};
  for (const s of sections(pop, 1)) {
    // As seções por Casa são numeradas: "4. Casa Valerius".
    const m = s.title.match(/^\d+\.\s+(.+)$/);
    if (!m) continue;
    const name = m[1].trim();
    if (!/^(Casa|Clã|Grande Casa|Ordem|Irmandade)/.test(name)) continue;

    // Poderes territoriais dizem "População territorial: 395.000"; os
    // institucionais, como a Casa do Ouro, dizem "População diretamente ligada
    // à Casa: cerca de 16.000". São a mesma informação em formas diferentes.
    const popTitle = sections(s.body, 2).find((x) => /Popula[çc][ãa]o (territorial|diretamente)/i.test(x.title));
    const military = subsection(s.body, /Capacidade militar/i);

    houses[slugify(name)] = {
      name,
      population: popTitle ? parseNumber(popTitle.title) : null,
      region: subsection(s.body, /^(Região|Território soberano)/i),
      mainCity: subsection(s.body, /Principal cidade|Principais cidades|Sede/i),
      society: subsection(s.body, /Quem vive|Estrutura social|Composição|Rede econômica|Composição interna/i),
      military,
      // Os dois números que o GM realmente usa ao resolver um turno.
      sustainableTroops: parseNumber(military.match(/sustentável[^;\n]*/i)?.[0] ?? ""),
      emergencyTroops: parseNumber(military.match(/emerg[êe]ncia[^;\n]*/i)?.[0] ?? ""),
      demographicPressure: subsection(s.body, /Pressão demográfica/i),
    };
  }

  const file = `/**
 * Dossiê demográfico e territorial de cada Casa.
 *
 * Extraído de valdren-context/PUBLICO/04_POPULACAO_DEMOGRAFIA_E_CAPACIDADE_MILITAR.md
 * por backend/scripts/extract-house-canon.mjs. Nada é inventado aqui: o
 * documento já trazia uma seção por Casa que nunca chegou ao site.
 *
 * Cânone do mundo, não estado de partida — vale para qualquer campanha.
 */
export interface HouseCanon {
  name: string;
  /** Habitantes do território, do censo canônico. */
  population: number | null;
  region: string;
  mainCity: string;
  society: string;
  military: string;
  /** Soldados que a Casa sustenta numa campanha longa. */
  sustainableTroops: number | null;
  /** Mobilização máxima, com custo econômico. */
  emergencyTroops: number | null;
  demographicPressure: string;
}

export const HOUSE_CANON: Record<string, HouseCanon> = ${JSON.stringify(houses, null, 2)};

export function houseCanonFor(key: string): HouseCanon | null {
  return HOUSE_CANON[key] ?? null;
}
`;
  await writeFile(OUT, file, "utf-8");

  console.log(`${Object.keys(houses).length} Casas extraídas:`);
  for (const [k, h] of Object.entries(houses)) {
    console.log(
      `  ${k.padEnd(24)} pop=${String(h.population ?? "?").padStart(7)} tropas=${h.sustainableTroops ?? "?"}/${h.emergencyTroops ?? "?"}` +
        ` campos=${["region", "mainCity", "society", "military", "demographicPressure"].filter((f) => h[f]).length}/5`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
