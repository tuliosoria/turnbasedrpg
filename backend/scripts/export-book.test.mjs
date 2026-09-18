import { describe, it, expect } from "vitest";
import { chapterToMarkdown, fileNameFor, relativePathFor, plain } from "./export-book.mjs";

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
});
