import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";

/**
 * Exporta o livro do DynamoDB de volta para livro/ como Markdown.
 *
 * O caminho de ida é compile-book.mjs (livro/ → defaultBook.ts → banco). Este é
 * o caminho de volta: o que o Mestre editou no site vira de novo manuscrito
 * durável, no mesmo formato de frontmatter, para poder ser versionado e
 * recompilado. Escrito junto com o editor, não depois: um round-trip que só
 * existe depois que der errado não é round-trip.
 *
 *   node scripts/export-book.mjs            # mostra o que seria escrito
 *   node scripts/export-book.mjs --confirm  # escreve livro/**\/*.md
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const region = process.env.AWS_REGION ?? "us-east-1";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const confirm = process.argv.includes("--confirm");
const DIR = new URL("../../livro/", import.meta.url);

const PARTS = ["prologo", "parte-1", "parte-2", "parte-3"];

function campaignPk(id) {
  return `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
}

/** Desembrulha o formato do DynamoDB ({"S": "x"}) para valores simples. */
export function plain(attr) {
  const [type, value] = Object.entries(attr)[0];
  if (type === "S" || type === "B") return value;
  if (type === "N") return Number(value);
  if (type === "BOOL") return value;
  if (type === "NULL") return null;
  if (type === "L") return value.map(plain);
  if (type === "M") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  throw new Error(`tipo não suportado: ${type}`);
}

/** Slug do título: sem acento, minúsculo, hifens no lugar do resto. */
function slugify(title) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "capitulo"
  );
}

/** Emite o Markdown com frontmatter, no mesmo formato que compile-book lê. */
export function chapterToMarkdown(chapter) {
  const front = [
    `chapterId: ${chapter.chapterId}`,
    `part: ${chapter.part}`,
    `order: ${chapter.order}`,
    `title: "${chapter.title}"`,
    `status: ${chapter.status}`,
  ].join("\n");
  return `---\n${front}\n---\n\n${chapter.body.trim()}\n`;
}

/** Nome do arquivo: ordem com dois dígitos + slug do título. */
export function fileNameFor(chapter) {
  return `${String(chapter.order).padStart(2, "0")}-${slugify(chapter.title)}.md`;
}

/** Caminho relativo a livro/: o prólogo na raiz, o resto na pasta da parte. */
export function relativePathFor(chapter) {
  if (chapter.part === "prologo") return "00-prologo.md";
  return `${chapter.part}/${fileNameFor(chapter)}`;
}

/**
 * Um arquivo é de capítulo se abre com frontmatter — o mesmo critério que o
 * compile-book usa. README.md e DECISOES_E_PENDENCIAS.md ficam de fora, e por
 * isso são preservados na limpeza.
 */
export function isChapterFile(text) {
  return text.replace(/\r\n/g, "\n").startsWith("---\n");
}

function sortChapters(chapters) {
  return [...chapters].sort((a, b) => {
    const pa = PARTS.indexOf(a.part);
    const pb = PARTS.indexOf(b.part);
    if (pa !== pb) return pa - pb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Dois capítulos com o mesmo destino se apagariam ao exportar (mesma parte,
 * mesma ordem e mesmo título viram o mesmo arquivo). É raro, mas silencioso:
 * o segundo sobrescreveria o primeiro e um capítulo sumiria do manuscrito.
 * Melhor falhar alto do que perder texto.
 */
export function findPathCollisions(chapters) {
  const byPath = new Map();
  for (const c of chapters) {
    const rel = relativePathFor(c);
    byPath.set(rel, [...(byPath.get(rel) ?? []), c.chapterId]);
  }
  return [...byPath.entries()].filter(([, ids]) => ids.length > 1);
}

/**
 * Apaga os arquivos de capítulo existentes sob livro/ antes de reescrever.
 *
 * Sem isto, editar o título ou a ordem de um capítulo no painel e exportar
 * deixaria o arquivo antigo para trás — dois arquivos com o mesmo chapterId, e
 * o compile-book seguinte quebraria com "chapterId duplicado". A limpeza só
 * remove arquivos de capítulo (os que abrem com frontmatter); README.md e as
 * notas de manuscrito ficam intactos.
 */
export async function clearChapterFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // pasta ainda não existe
  }
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) {
      await clearChapterFiles(child);
    } else if (entry.name.endsWith(".md")) {
      const text = await readFile(child, "utf-8");
      if (isChapterFile(text)) await unlink(child);
    }
  }
}

async function fetchChapters(doc) {
  const chapters = [];
  let ExclusiveStartKey;
  do {
    const result = await doc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "BOOK#" },
        ExclusiveStartKey,
      }),
    );
    for (const item of result.Items ?? []) {
      chapters.push({
        chapterId: item.chapterId,
        part: item.part,
        order: item.order,
        title: item.title,
        body: item.body,
        status: item.status,
      });
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return sortChapters(chapters);
}

async function main() {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  const chapters = await fetchChapters(doc);

  if (chapters.length === 0) {
    console.log("Nenhum capítulo no banco. Nada a exportar.");
    return;
  }

  const collisions = findPathCollisions(chapters);
  if (collisions.length > 0) {
    for (const [rel, ids] of collisions) {
      console.error(`  colisão: ${rel} ← ${ids.join(", ")}`);
    }
    throw new Error(
      "Capítulos diferentes mapeiam para o mesmo arquivo. Ajuste título ou ordem para desempatar antes de exportar.",
    );
  }

  if (!confirm) {
    console.log(`[dry-run] exportaria ${chapters.length} capítulos para livro/:`);
    for (const c of chapters) {
      console.log(`  ${relativePathFor(c)}  (${String(c.body ?? "").length} chars, ${c.status})`);
    }
    console.log("\nRode com --confirm para escrever os arquivos.");
    return;
  }

  for (const part of PARTS) {
    if (part === "prologo") continue;
    await mkdir(new URL(`${part}/`, DIR), { recursive: true });
  }

  // Limpa os capítulos antigos primeiro: título ou ordem editados no painel
  // mudam o nome do arquivo, e sem a limpeza o antigo viraria órfão.
  await clearChapterFiles(DIR);

  for (const chapter of chapters) {
    const rel = relativePathFor(chapter);
    await writeFile(new URL(rel, DIR), chapterToMarkdown(chapter), "utf-8");
    console.log(`  escrito: livro/${rel}`);
  }
  console.log(`\n${chapters.length} capítulos exportados para livro/`);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
