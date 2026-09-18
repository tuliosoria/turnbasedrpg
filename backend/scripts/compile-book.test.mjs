import { describe, it, expect } from "vitest";
import { parseChapterFile, renderDefaultBook } from "./compile-book.mjs";

const sample = `---\nchapterId: prologo\npart: prologo\norder: 0\ntitle: "A mão que ainda lembra"\nstatus: publicado\n---\n\nEu era jovem quando o Norte calou.`;

describe("compile-book", () => {
  it("parses frontmatter and body", () => {
    const ch = parseChapterFile(sample);
    expect(ch).toMatchObject({
      chapterId: "prologo",
      part: "prologo",
      order: 0,
      title: "A mão que ainda lembra",
      status: "publicado",
    });
    expect(ch.body).toBe("Eu era jovem quando o Norte calou.");
  });
  it("rejects an unknown part", () => {
    expect(() => parseChapterFile(sample.replace("part: prologo", "part: parte-9"))).toThrow(/parte/i);
  });
  it("rejects an unknown status", () => {
    expect(() => parseChapterFile(sample.replace("status: publicado", "status: talvez"))).toThrow(/status/i);
  });
  it("renders a TS module with DEFAULT_BOOK_CHAPTERS", () => {
    const out = renderDefaultBook([parseChapterFile(sample)]);
    expect(out).toContain("export const DEFAULT_BOOK_CHAPTERS");
    expect(out).toContain('"chapterId": "prologo"');
  });
});
