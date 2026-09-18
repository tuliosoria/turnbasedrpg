import { readdir, readFile, writeFile } from "node:fs/promises";

/**
 * Compila o manuscrito de livro/ para shared/src/defaultBook.ts.
 *
 * O manuscrito em Markdown é a fonte durável; este script o traduz para o
 * módulo gerado que o backend semeia no DynamoDB. Determinístico de propósito:
 * o mesmo livro/ produz sempre o mesmo defaultBook.ts.
 *
 *   node scripts/compile-book.mjs        # lê livro/**\/*.md e escreve defaultBook.ts
 */

const PARTS = ["prologo", "parte-1", "parte-2", "parte-3"];
const STATUSES = ["rascunho", "publicado"];

/** Lê o frontmatter simples (uma chave por linha) e o corpo Markdown. */
export function parseChapterFile(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("frontmatter ausente ou malformado");
  const [, front, rest] = match;

  const fields = {};
  for (const line of front.split("\n")) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) throw new Error(`linha de frontmatter inválida: ${line}`);
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }

  const chapterId = fields.chapterId;
  const title = fields.title;
  const part = fields.part;
  const status = fields.status;
  if (!chapterId) throw new Error("chapterId ausente");
  if (!title) throw new Error("title ausente");
  if (!PARTS.includes(part)) throw new Error(`parte inválida: ${part}`);
  if (!STATUSES.includes(status)) throw new Error(`status inválido: ${status}`);
  const order = Number(fields.order);
  if (!Number.isFinite(order)) throw new Error(`order inválido: ${fields.order}`);

  return { chapterId, part, order, title, body: rest.trim(), status };
}

/** Ordena por parte (ordem de leitura) e depois por order dentro da parte. */
export function sortChapters(chapters) {
  return [...chapters].sort((a, b) => {
    const pa = PARTS.indexOf(a.part);
    const pb = PARTS.indexOf(b.part);
    if (pa !== pb) return pa - pb;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

/** Emite o módulo TS gerado com DEFAULT_BOOK_CHAPTERS. */
export function renderDefaultBook(chapters) {
  const sorted = sortChapters(chapters);
  const header =
    "// GERADO por scripts/compile-book.mjs — não edite à mão.\n" +
    "// A fonte durável é o manuscrito em livro/*.md.\n";
  const iface =
    "export interface DefaultBookChapter {\n" +
    "  chapterId: string;\n" +
    "  part: string;\n" +
    "  order: number;\n" +
    "  title: string;\n" +
    "  body: string;\n" +
    '  status: "rascunho" | "publicado";\n' +
    "}\n";
  const data =
    "export const DEFAULT_BOOK_CHAPTERS: DefaultBookChapter[] = " +
    JSON.stringify(sorted, null, 2) +
    ";\n";
  return `${header}\n${iface}\n${data}`;
}

async function readChapterFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) {
      out.push(...(await readChapterFiles(child)));
    } else if (entry.name.endsWith(".md")) {
      const text = await readFile(child, "utf-8");
      // Só compila arquivos de capítulo: os que abrem com frontmatter. Assim
      // README.md e notas de manuscrito convivem em livro/ sem virar capítulo.
      if (text.replace(/\r\n/g, "\n").startsWith("---\n")) out.push(text);
    }
  }
  return out;
}

async function main() {
  const livroDir = new URL("../../livro/", import.meta.url);
  const texts = await readChapterFiles(livroDir);
  const chapters = texts.map(parseChapterFile);

  const seen = new Set();
  for (const ch of chapters) {
    if (seen.has(ch.chapterId)) throw new Error(`chapterId duplicado: ${ch.chapterId}`);
    seen.add(ch.chapterId);
  }

  const outUrl = new URL("../../shared/src/defaultBook.ts", import.meta.url);
  await writeFile(outUrl, renderDefaultBook(chapters), "utf-8");
  console.log(`Compilados ${chapters.length} capítulos para shared/src/defaultBook.ts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
