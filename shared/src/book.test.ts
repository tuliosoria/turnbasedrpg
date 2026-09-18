import { describe, it, expect } from "vitest";
import { BOOK_PARTS, BOOK_PART_IDS, bookPartLabel } from "./book";

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
