import { describe, it, expect } from "vitest";
import { WORLD_LINKS } from "./navigation";

/**
 * O Livro é destino público do Mundo.
 *
 * Um filtro por token de mestre chegou a escondê-lo enquanto o romance estava
 * em rascunho. O romance foi publicado e nenhum link do Mundo se esconde, então
 * a lista em si é o que o menu mostra.
 */
describe("os destinos do Mundo", () => {
  it("O Livro é público", () => {
    expect(WORLD_LINKS.map((l) => l.label)).toEqual([
      "A crônica",
      "O Livro",
      "As Casas",
      "Personagens",
      "Histórias Contadas",
      "Galeria",
    ]);
  });
});
