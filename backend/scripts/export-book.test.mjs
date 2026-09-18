import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chapterToMarkdown,
  fileNameFor,
  relativePathFor,
  isChapterFile,
  clearChapterFiles,
  findPathCollisions,
  plain,
} from "./export-book.mjs";
import { parseChapterFile } from "./compile-book.mjs";

const prologo = {
  chapterId: "prologo",
  part: "prologo",
  order: 0,
  title: "A mão que ainda lembra",
  body: "Eu escrevo isto já velho.",
  status: "publicado",
};

const capitulo = {
  chapterId: "p1-c01-a-forja-e-a-leva",
  part: "parte-1",
  order: 1,
  title: "A forja e a leva",
  body: "Meu mestre chamava-se Halden.",
  status: "publicado",
};

describe("export-book helpers", () => {
  it("chapterToMarkdown gera frontmatter + corpo", () => {
    const md = chapterToMarkdown(capitulo);
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain("chapterId: p1-c01-a-forja-e-a-leva");
    expect(md).toContain("part: parte-1");
    expect(md).toContain("order: 1");
    expect(md).toContain('title: "A forja e a leva"');
    expect(md).toContain("status: publicado");
    expect(md).toContain("\n---\n\nMeu mestre chamava-se Halden.\n");
  });

  it("chapterToMarkdown faz round-trip com o corpo", () => {
    const md = chapterToMarkdown(prologo);
    expect(md).toContain("Eu escrevo isto já velho.");
  });

  it("fileNameFor usa ordem com dois dígitos e slug do título", () => {
    expect(fileNameFor(capitulo)).toBe("01-a-forja-e-a-leva.md");
  });

  it("relativePathFor coloca o prólogo na raiz de livro/", () => {
    expect(relativePathFor(prologo)).toBe("00-prologo.md");
  });

  it("relativePathFor coloca capítulos na pasta da parte", () => {
    expect(relativePathFor(capitulo)).toBe("parte-1/01-a-forja-e-a-leva.md");
  });

  it("plain desembrulha valores do DynamoDB", () => {
    expect(plain({ S: "texto" })).toBe("texto");
    expect(plain({ N: "3" })).toBe(3);
    expect(plain({ BOOL: true })).toBe(true);
  });

  it("isChapterFile só reconhece arquivos com frontmatter", () => {
    expect(isChapterFile("---\nchapterId: x\n---\n\ncorpo")).toBe(true);
    expect(isChapterFile("# README\n\nnotas do manuscrito")).toBe(false);
  });

  it("findPathCollisions acusa capítulos que mapeiam para o mesmo arquivo", () => {
    const a = { ...capitulo, chapterId: "a" };
    const b = { ...capitulo, chapterId: "b" }; // mesma parte, ordem e título
    const collisions = findPathCollisions([a, b]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0][0]).toBe("parte-1/01-a-forja-e-a-leva.md");
    expect(findPathCollisions([capitulo, prologo])).toHaveLength(0);
  });
});

describe("export-book round-trip idempotente", () => {
  it("apaga o arquivo antigo ao renomear/reordenar, sem duplicar chapterId", async () => {
    const dir = await mkdtemp(join(tmpdir(), "livro-"));
    await mkdir(join(dir, "parte-1"), { recursive: true });

    // Estado antigo em disco: capítulo em order 6 (nome 06-...), mais um README
    // que NÃO pode ser apagado.
    const oldChapter = { ...capitulo, order: 6, title: "Título antigo" };
    await writeFile(join(dir, relativePathFor(oldChapter)), chapterToMarkdown(oldChapter), "utf-8");
    await writeFile(join(dir, "README.md"), "# Manuscrito\n\nNotas.", "utf-8");
    await writeFile(join(dir, "parte-1", "DECISOES_E_PENDENCIAS.md"), "notas soltas", "utf-8");

    // Limpa e reescreve com o MESMO chapterId, mas título e ordem novos.
    await clearChapterFiles(new URL(`file://${dir}/`));
    const renamed = { ...capitulo, order: 1, title: "Título novo" };
    await writeFile(join(dir, relativePathFor(renamed)), chapterToMarkdown(renamed), "utf-8");

    // Só deve existir um arquivo de capítulo; o README e as notas sobrevivem.
    const rootFiles = await readdir(dir);
    expect(rootFiles).toContain("README.md");
    const parteFiles = await readdir(join(dir, "parte-1"));
    expect(parteFiles).toContain("DECISOES_E_PENDENCIAS.md");
    const chapterFiles = parteFiles.filter((f) => f.endsWith(".md") && f !== "DECISOES_E_PENDENCIAS.md");
    expect(chapterFiles).toEqual(["01-titulo-novo.md"]);

    // E o compile-book leria isso de volta sem "chapterId duplicado".
    const text = await readFile(join(dir, "parte-1", chapterFiles[0]), "utf-8");
    const parsed = parseChapterFile(text);
    expect(parsed.chapterId).toBe(capitulo.chapterId);
    expect(parsed.title).toBe("Título novo");
    expect(parsed.order).toBe(1);
  });
});
