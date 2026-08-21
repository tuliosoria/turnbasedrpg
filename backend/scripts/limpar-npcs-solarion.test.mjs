import { describe, expect, it } from "vitest";
import { A_REMOVER, verificarSemeado } from "./limpar-npcs-solarion.mjs";

describe("verificarSemeado", () => {
  it("deixa passar o que a semeadura criou", () => {
    const item = { SK: "VENTITY#lady-samira-solarion", canonicalName: "Lady Samira Solarion" };
    expect(verificarSemeado(item)).toBe(item);
  });

  // O retrato e o texto de um personagem aprovado são trabalho do jogador; um
  // erro de digitação na lista não pode custar isso.
  it("recusa apagar quem tem verbete aprovado", () => {
    const item = { SK: "VENTITY#mt2ci0g0-1fqaxz", canonicalName: "Faraó Gloriandur", wikiEntryId: "m3hbhtntl9" };
    expect(() => verificarSemeado(item)).toThrow(/cânone do jogador/);
  });

  it("trata wikiEntryId nulo como semeado", () => {
    const item = { SK: "VENTITY#lady-samira-solarion", wikiEntryId: null };
    expect(verificarSemeado(item)).toBe(item);
  });
});

describe("A_REMOVER", () => {
  it("leva junto o retrato, senão ele fica órfão no acervo", () => {
    expect(A_REMOVER).toContain("VENTITY#lady-samira-solarion");
    expect(A_REMOVER).toContain("VASSET#lady-samira-solarion-portrait");
  });

  it("não toca em nenhuma entidade do cânone do jogador", () => {
    const doJogador = ["mt2ci0g0-1fqaxz", "mt0ssnn6-znts2u", "mt0sslfs-i4w3tr", "mt2ci4x6-rermzf", "mt0ssin8-4gmhp7"];
    for (const id of doJogador) {
      expect(A_REMOVER.some((sk) => sk.includes(id))).toBe(false);
    }
  });
});
