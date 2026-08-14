import { describe, expect, it } from "vitest";
import { WIKI_GROUPS, WIKI_SECTIONS, WIKI_SECTION_IDS, wikiGroupOf } from "./wiki.js";

describe("grupos da wiki", () => {
  // Uma seção fora de grupo desaparece do índice sem quebrar nada, que é o
  // pior tipo de defeito: silencioso.
  it("cobrem todas as seções", () => {
    const grouped = WIKI_GROUPS.flatMap((g) => g.sections).sort();
    expect(grouped).toEqual([...WIKI_SECTION_IDS].sort());
  });

  it("não repetem nenhuma seção entre grupos", () => {
    const grouped = WIKI_GROUPS.flatMap((g) => g.sections);
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("só apontam para seções que existem", () => {
    for (const group of WIKI_GROUPS) {
      for (const id of group.sections) {
        expect(WIKI_SECTION_IDS).toContain(id);
      }
    }
  });

  it("têm rótulo e uma frase de apoio", () => {
    for (const group of WIKI_GROUPS) {
      expect(group.label.trim()).not.toBe("");
      expect(group.blurb.trim().length).toBeGreaterThan(20);
    }
  });

  it("resolvem o grupo de uma seção", () => {
    expect(wikiGroupOf("campanha-dnd")?.id).toBe("mesa");
    expect(wikiGroupOf("governo")?.id).toBe("reino");
    expect(wikiGroupOf("secao-inexistente")).toBeNull();
  });

  it("mantêm a ordem das seções dentro do grupo estável", () => {
    const reino = WIKI_GROUPS.find((g) => g.id === "reino");
    expect(reino?.sections[0]).toBe("visao-geral");
  });

  it("não deixam seção órfã quando uma nova é adicionada", () => {
    const orphans = WIKI_SECTIONS.filter((s) => wikiGroupOf(s.id) === null);
    expect(orphans.map((s) => s.id)).toEqual([]);
  });
});
