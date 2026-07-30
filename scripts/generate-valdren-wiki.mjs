import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const encyclopediaPath = "/Users/jessicarosa/Downloads/VALDREN_MEGA_ENCICLOPEDIA_PUBLICA_CANONICA_V2.md";
const atlasPath = "/Users/jessicarosa/Downloads/ATLAS_GEOGRAFICO_DE_VALDREN_CANONICO_V2.md";
const censusPath = "/Users/jessicarosa/Downloads/POPULACAO_E_DEMOGRAFIA_DE_VALDREN_CANONICA.md";
const mapSourcePath = "/Users/jessicarosa/Downloads/ChatGPT Image Jul 28, 2026, 10_54_45 PM.png";
const houseImages = [
  {
    title: "Clã Mandíbula de Osso — O Povo que Quebrou as Correntes",
    files: [["/Users/jessicarosa/Downloads/Mandibula.JPG", "mandibula.jpg"]],
  },
  {
    title: "Casa Karasoy — As Filhas da Estrela",
    files: [["/Users/jessicarosa/Downloads/Karasoy.JPG", "karasoy.jpg"]],
  },
  {
    title: "Casa Euralune — Os Senhores do Céu",
    files: [
      ["/Users/jessicarosa/Downloads/Euralune.JPG", "euralune.jpg"],
      ["/Users/jessicarosa/Downloads/Euralune-2.JPG", "euralune-2.jpg"],
    ],
  },
  {
    title: "Grande Casa Ulgar — Os Sobreviventes de Nah'Korah",
    files: [["/Users/jessicarosa/Downloads/Ulgar.JPG", "ulgar.jpg"]],
  },
];

const SKIP_HEADINGS = new Set(["Perfil de poder", "Conflito central", "Facções internas"]);

const SECTION_RULES = [
  [/^Descrição geral/i, "visao-geral"],
  [/^Povos, idiomas/i, "povos"],
  [/^Cosmologia pública/i, "cosmologia"],
  [/^Calendário/i, "calendario"],
  [/^Geografia/i, "geografia"],
  [/^Cidades e lugares/i, "cidades"],
  [/^A Coroa e o governo/i, "governo"],
  [/^Tributos/i, "tributos"],
  [/^As Casas e facções/i, "casas"],
  [/^Política e intrigas/i, "governo"],
  [/^A ameaça do Norte/i, "crise-atual"],
  [/^Situação atual/i, "crise-atual"],
  [/^Glossário/i, "visao-geral"],
];

function stripFrontMatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/, "");
}

function cleanHeading(raw) {
  return raw
    .replace(/^#+\s*/, "")
    .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
    .trim();
}

function titleCaseKnown(title) {
  if (title === "Um reino cercado") return "Valdren, o reino-ilha";
  return title;
}

function topSectionFor(title) {
  for (const [pattern, section] of SECTION_RULES) {
    if (pattern.test(title)) return section;
  }
  return "visao-geral";
}

function entrySectionFor(topTitle, title) {
  const combined = `${topTitle} ${title}`;
  if (/Brumas/i.test(title) && !/Costa das Brumas/i.test(title)) return "brumas";
  if (/Magia|Trino/i.test(combined)) return "magia";
  if (/Igreja|Ordem do Sino|Religi/i.test(combined)) return "religioes";
  if (/A ameaça do Norte|Situação atual|cadáveres|mortos/i.test(combined)) return "crise-atual";
  return topSectionFor(topTitle);
}

function trimBlank(lines) {
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines;
}

function filterPublicLines(lines) {
  const out = [];
  let skipLevel = null;
  let skipAttributeTable = false;

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = cleanHeading(line);
      if (skipLevel !== null && level <= skipLevel) skipLevel = null;
      if (SKIP_HEADINGS.has(title)) {
        skipLevel = level;
        continue;
      }
    }
    if (skipLevel !== null) continue;

    const isTableLine = /^\s*\|/.test(line);
    if (isTableLine && /Riqueza|Recursos|Soldados|Controle/i.test(line)) {
      skipAttributeTable = true;
      continue;
    }
    if (skipAttributeTable) {
      if (isTableLine) continue;
      skipAttributeTable = false;
    }

    if (/^Os atributos de jogo/i.test(line)) continue;
    out.push(line);
  }

  return trimBlank(out).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseMarkdownEntries(text) {
  const lines = stripFrontMatter(text).split(/\r?\n/);
  const entries = [];
  let topTitle = "";
  let current = null;

  function flush() {
    if (!current) return;
    const body = filterPublicLines(current.lines);
    if (body.length >= 80) {
      entries.push({
        section: entrySectionFor(current.topTitle, current.title),
        title: titleCaseKnown(current.title),
        body,
      });
    }
    current = null;
  }

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) {
      if (current) current.lines.push(line);
      continue;
    }

    const level = heading[1].length;
    const title = cleanHeading(line);
    if (title === "VALDREN" || title === "Enciclopédia Pública do Reino" || title === "Sumário") {
      continue;
    }
    if (level === 1) {
      flush();
      topTitle = title;
      current = { topTitle, title, lines: [] };
      continue;
    }
    if (level === 2) {
      flush();
      current = { topTitle, title, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return entries;
}

function parseAtlasEntries(text) {
  return parseMarkdownEntries(`# Geografia do reino\n${text}`)
    .filter((entry) => entry.section === "geografia" || entry.section === "cidades")
    .map((entry) => ({ ...entry, body: entry.body.replace(/^# ATLAS GEOGRÁFICO CANÔNICO DE VALDREN — V2\s*/i, "").trim() }));
}

function extractTopLevelEntry(text, titlePattern, nextTitlePattern, section, title) {
  const lines = stripFrontMatter(text).split(/\r?\n/);
  const start = lines.findIndex((line) => titlePattern.test(line));
  if (start === -1) return null;
  const next = lines.findIndex((line, index) => index > start && nextTitlePattern.test(line));
  const bodyLines = lines.slice(start + 1, next === -1 ? undefined : next);
  const body = filterPublicLines(bodyLines);
  return body ? { section, title, body } : null;
}

function parseCensusEntry(text) {
  const body = stripFrontMatter(text)
    .replace(/^#\s+População e Demografia de Valdren\s*/i, "")
    .replace(/\*\*aproximadamente 2\.000\.000 de habitantes\*\*/i, "aproximadamente **2.000.000 de habitantes**")
    .trim();
  return {
    section: "censo",
    title: "Censo Canônico de Valdren",
    body,
  };
}

function dedupe(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const key = `${entry.section}::${entry.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function withOrders(entries) {
  const counters = new Map();
  return entries.map((entry) => {
    const next = counters.get(entry.section) ?? 0;
    counters.set(entry.section, next + 1);
    return { ...entry, order: next };
  });
}

function attachHouseImages(entries) {
  const byTitle = new Map(houseImages.map((house) => [
    house.title,
    house.files.map(([, fileName]) => `/houses/${fileName}`),
  ]));
  return entries.map((entry) => {
    const imageUrls = byTitle.get(entry.title);
    return imageUrls ? { ...entry, imageUrls } : entry;
  });
}

function tsString(value) {
  return JSON.stringify(value);
}

function renderDefaultWiki(entries) {
  const rendered = entries.map((entry) => {
    const imageLine = entry.imageUrl ? `\n    imageUrl: ${tsString(entry.imageUrl)},` : "";
    const imageUrlsLine = entry.imageUrls ? `\n    imageUrls: ${tsString(entry.imageUrls)},` : "";
    return `  {\n    section: ${tsString(entry.section)},\n    title: ${tsString(entry.title)},\n    order: ${entry.order},${imageLine}${imageUrlsLine}\n    body: ${tsString(entry.body)},\n  }`;
  }).join(",\n");

  return `export interface DefaultWikiEntry {\n  section: string;\n  title: string;\n  body: string;\n  order: number;\n  imageUrl?: string;\n  imageUrls?: string[];\n}\n\n/**\n * Canonical player-facing public encyclopedia of Valdren. Generated from the\n * public V2 encyclopedia and atlas documents. Mechanical power profiles,\n * attribute tables and GM-only material are intentionally excluded.\n */\nexport const DEFAULT_WIKI_ENTRIES: DefaultWikiEntry[] = [\n${rendered},\n];\n`;
}

const encyclopediaEntries = parseMarkdownEntries(readFileSync(encyclopediaPath, "utf8"));
const encyclopediaText = readFileSync(encyclopediaPath, "utf8");
const atlasEntries = parseAtlasEntries(readFileSync(atlasPath, "utf8"));
const censusEntry = parseCensusEntry(readFileSync(censusPath, "utf8"));
const northernThreat = extractTopLevelEntry(
  encyclopediaText,
  /^#\s+11\.\s+A ameaça do Norte/i,
  /^#\s+12\./i,
  "crise-atual",
  "A ameaça do Norte",
);

const entries = attachHouseImages(withOrders(dedupe([
  {
    section: "geografia",
    title: "Atlas de Valdren",
    body: "Mapa público do reino-ilha de Valdren, reunindo as grandes regiões, rotas, cidades e fronteiras conhecidas pelas Casas.",
    imageUrl: "/valdren-map.png",
    imageUrls: ["/valdren-map.png"],
  },
  censusEntry,
  ...encyclopediaEntries,
  ...(northernThreat ? [northernThreat] : []),
  ...atlasEntries,
])));

writeFileSync(resolve(root, "shared/src/defaultWiki.ts"), renderDefaultWiki(entries));
mkdirSync(resolve(root, "frontend/public"), { recursive: true });
mkdirSync(resolve(root, "frontend/public/houses"), { recursive: true });
copyFileSync(mapSourcePath, resolve(root, "frontend/public/valdren-map.png"));
for (const house of houseImages) {
  for (const [source, fileName] of house.files) {
    copyFileSync(source, resolve(root, "frontend/public/houses", fileName));
  }
}

console.log(`Generated ${entries.length} public wiki entries.`);
