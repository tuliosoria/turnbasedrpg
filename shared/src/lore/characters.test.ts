import { describe, expect, it } from "vitest";
import { HOUSE_CHARACTERS, characterFor, characterId, houseRoster } from "./characters.js";

describe("characterId", () => {
  it("faz um slug estável do nome", () => {
    expect(characterId("All Marifh")).toBe("all-marifh");
    expect(characterId("Selma Karasoy")).toBe("selma-karasoy");
  });

  it("descarta o cargo embutido depois da vírgula", () => {
    expect(characterId("Lorde Marcien Auremont, Comandante da Cavalaria e Herdeiro de Aurivale"))
      .toBe("lorde-marcien-auremont");
  });

  it("dobra acentos", () => {
    expect(characterId("Príncipe Sétimo")).toBe("principe-setimo");
  });
});

describe("roster e resolução", () => {
  it("resolve um personagem pela Casa e pelo id", () => {
    const c = characterFor("casa-valerius", "principe-alic-valerius");
    expect(c?.name).toBe("Príncipe Alic Valerius");
  });

  it("não resolve alguém de outra Casa", () => {
    // Alic é de Valerius; pedir por ele em Karasoy é engano.
    expect(characterFor("casa-karasoy", "principe-alic-valerius")).toBeNull();
  });

  // Solarion tem jogador e a corte dela vive no cânone aprovado, não aqui.
  it("devolve vazio para a Casa cujo elenco é todo do cânone", () => {
    expect(houseRoster("casa-solarion")).toEqual([]);
  });

  it("devolve vazio para Casa desconhecida", () => {
    expect(houseRoster("casa-inexistente")).toEqual([]);
  });

  // Dois personagens com o mesmo id numa Casa fazem a carta ir para o errado
  // sem erro nenhum — o pior tipo de defeito.
  it("não tem ids colidindo dentro de uma Casa", () => {
    for (const [houseKey, cast] of Object.entries(HOUSE_CHARACTERS)) {
      const ids = cast.map((c) => characterId(c.name));
      expect(new Set(ids).size, `colisão em ${houseKey}`).toBe(ids.length);
    }
  });
});
