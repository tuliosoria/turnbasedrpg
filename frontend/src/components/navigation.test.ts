import { describe, it, expect } from "vitest";
import { WORLD_LINKS, worldLinksPara } from "./navigation";
import type { NavLink } from "./NavMenu";

/**
 * O mecanismo de esconder destino por token, e o que ele esconde hoje.
 *
 * Nasceu para tirar O Livro do menu do jogador enquanto o romance estava em
 * rascunho. O romance foi publicado e o link voltou, mas o mecanismo fica: é
 * onde qualquer destino futuro do Mundo se esconde, e a regra de esconder não
 * deve ser reinventada na próxima vez.
 *
 * Esconder link nunca trancou porta nenhuma. Quem tranca é o servidor.
 */
describe("worldLinksPara", () => {
  const fixos: NavLink[] = [
    { label: "Aberto", to: "/aberto" },
    { label: "Do mestre", to: "/mestre", somenteMestre: true },
  ];

  it("tira do menu do jogador o destino marcado como do mestre", () => {
    expect(worldLinksPara(false, fixos).map((l) => l.label)).toEqual(["Aberto"]);
  });

  it("mostra tudo ao mestre", () => {
    expect(worldLinksPara(true, fixos)).toHaveLength(2);
  });

  // Hoje nada do Mundo está escondido, e O Livro em particular é público.
  it("não esconde nenhum destino do Mundo neste momento", () => {
    expect(worldLinksPara(false)).toHaveLength(WORLD_LINKS.length);
    expect(worldLinksPara(false).map((l) => l.label)).toContain("O Livro");
  });
});
