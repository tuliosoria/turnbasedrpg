import { describe, it, expect } from "vitest";
import { BOOK_PARTS, BOOK_PART_IDS, bookPartLabel, reancorar, paragrafosDe } from "./book";

describe("book parts", () => {
  it("has prologue plus three parts, in reading order", () => {
    expect(BOOK_PART_IDS).toEqual(["prologo", "parte-1", "parte-2", "parte-3"]);
  });
  it("labels a part and falls back to the id", () => {
    expect(bookPartLabel("parte-1")).toBe("Parte I — O Norte Morto");
    expect(bookPartLabel("desconhecida")).toBe("desconhecida");
  });
  it("BOOK_PART_IDS mirrors BOOK_PARTS", () => {
    expect(BOOK_PART_IDS).toEqual(BOOK_PARTS.map((p) => p.id));
  });
});

/**
 * Um comentário tem de sobreviver à reescrita do capítulo.
 *
 * Este livro vai de dezoito capítulos para trinta e cinco, e cada capítulo vai
 * de setecentas palavras para quatro mil. Se o comentário guardasse só o
 * índice do parágrafo, toda revisão apontaria o recado do autor para o
 * parágrafo errado, que é pior do que perdê-lo: ele passaria a criticar um
 * texto que não é o criticado.
 *
 * Por isso o comentário guarda o trecho como ele era, e a reancoragem tenta o
 * índice, depois o texto, e no fim declara órfão. Nada some em silêncio.
 */
describe("reancorar", () => {
  const com = (paragrafo: number, trecho: string, texto = "comentário") =>
    ({ id: `c${paragrafo}`, paragrafo, trecho, texto, criadoEm: "" });

  it("mantém o comentário onde ele está quando nada mudou", () => {
    const paragrafos = ["Meu mestre chamava-se Halden.", "O aço negro não perdoa."];
    const [r] = reancorar([com(1, "O aço negro não perdoa.")], paragrafos);
    expect(r).toMatchObject({ paragrafo: 1, orfao: false });
  });

  it("segue o parágrafo que mudou de lugar", () => {
    const paragrafos = ["Parágrafo novo inserido antes.", "Meu mestre chamava-se Halden.", "O aço negro não perdoa."];
    const [r] = reancorar([com(1, "O aço negro não perdoa.")], paragrafos);
    expect(r).toMatchObject({ paragrafo: 2, orfao: false });
  });

  // Reancorar pelo começo do trecho: eu reescrevo o fim do parágrafo muito
  // mais do que o começo dele.
  it("reconhece o parágrafo que foi ampliado", () => {
    const paragrafos = ["O aço negro não perdoa o ferreiro apressado, e esfria diferente do comum."];
    const [r] = reancorar([com(0, "O aço negro não perdoa.")], paragrafos);
    expect(r).toMatchObject({ paragrafo: 0, orfao: false });
  });

  it("declara órfão o comentário cujo trecho desapareceu", () => {
    const [r] = reancorar([com(0, "Uma frase que eu apaguei inteira.")], ["Texto completamente outro."]);
    expect(r.orfao).toBe(true);
    expect(r.trecho).toBe("Uma frase que eu apaguei inteira.");
  });

  // Dois comentários no mesmo parágrafo é o caso normal de revisão.
  it("mantém vários comentários no mesmo parágrafo", () => {
    const paragrafos = ["O aço negro não perdoa."];
    const r = reancorar([com(0, "O aço negro não perdoa.", "um"), com(0, "O aço negro não perdoa.", "dois")], paragrafos);
    expect(r.map((x) => x.paragrafo)).toEqual([0, 0]);
    expect(r.every((x) => !x.orfao)).toBe(true);
  });

  it("não quebra com capítulo sem comentário nenhum", () => {
    expect(reancorar([], ["um parágrafo"])).toEqual([]);
  });
});

describe("paragrafosDe", () => {
  it("separa por linha em branco e descarta o vazio", () => {
    expect(paragrafosDe("um\n\ndois\n\n\n\ntrês\n")).toEqual(["um", "dois", "três"]);
  });
});
