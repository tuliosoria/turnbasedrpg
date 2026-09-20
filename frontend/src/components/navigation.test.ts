import { describe, it, expect } from "vitest";
import { WORLD_LINKS, worldLinksPara } from "./navigation";

/**
 * O Livro não é do reino ainda.
 *
 * O romance está semeado e editável no painel, mas os dezoito capítulos estão
 * em rascunho e o autor ainda não os leu por inteiro. Um link no menu do
 * jogador levaria a uma página vazia e anunciaria uma coisa que não existe.
 */
describe("worldLinksPara", () => {
  it("esconde O Livro de quem não é mestre", () => {
    const rotulos = worldLinksPara(false).map((l) => l.label);
    expect(rotulos).not.toContain("O Livro");
    expect(rotulos).toContain("A crônica");
  });

  it("mostra O Livro ao mestre", () => {
    expect(worldLinksPara(true).map((l) => l.label)).toContain("O Livro");
  });

  // Esconder um link não tranca uma porta: o resto do mundo segue aberto.
  it("não esconde mais nada além do que foi marcado", () => {
    expect(worldLinksPara(false)).toHaveLength(WORLD_LINKS.length - 1);
  });
});
