import { describe, expect, it } from "vitest";
import { houseShortName, houseTerms, mentionsHouse } from "./houseAssets";

describe("houseShortName", () => {
  it("remove o prefixo que as Casas dividem entre si", () => {
    expect(houseShortName("Casa Vargen")).toBe("vargen");
    expect(houseShortName("Clã Mandíbula de Osso")).toBe("mandibula de osso");
    expect(houseShortName("Grande Casa Ulgar")).toBe("ulgar");
    expect(houseShortName("Casa do Ouro")).toBe("ouro");
  });

  // Podar "Ordem do" deixaria "sino", que aparece em "Os Dias sem Sino" e na
  // Abadia Branca sem que nada disso seja a Ordem.
  it("preserva nomes que só se distinguem por inteiro", () => {
    expect(houseShortName("Ordem do Sino")).toBe("ordem do sino");
    expect(houseShortName("Irmandade dos Corvos")).toBe("irmandade dos corvos");
  });
});

describe("mentionsHouse", () => {
  it("reconhece a Casa pelo nome", () => {
    expect(mentionsHouse("Brasão — Casa Vargen", "casa-vargen")).toBe(true);
    expect(mentionsHouse("Solarion (Sahra-Lun)", "casa-solarion")).toBe(true);
  });

  // A imagem mais reconhecível de uma Casa costuma ser a sede, e a entidade
  // dela leva o nome da cidade, não o da Casa.
  it("reconhece a Casa pela cidade-sede", () => {
    expect(mentionsHouse("Khar-Durak", "casa-khazdrun")).toBe(true);
    expect(mentionsHouse("Euralune (Ninho Alto)", "casa-euralune")).toBe(true);
    expect(mentionsHouse("A muralha de Rimewatch", "casa-rimerberg")).toBe(true);
  });

  // Solarion tem duas cidades, e "Elfos de Sahra-Lun" é a única peça do acervo
  // que não traz o nome da Casa. Ela some da página se a sede virar o único
  // termo aceito.
  it("reconhece a Casa por uma cidade que não é a sede", () => {
    expect(mentionsHouse("Elfos de Sahra-Lun", "casa-solarion")).toBe(true);
    expect(mentionsHouse("Solythar", "casa-solarion")).toBe(true);
  });

  it("é indiferente a acento e caixa", () => {
    expect(mentionsHouse("CLÃ MANDÍBULA DE OSSO", "cla-mandibula-de-osso")).toBe(true);
  });

  it("não confunde Casas diferentes", () => {
    expect(mentionsHouse("Brasão — Casa Vargen", "casa-valerius")).toBe(false);
    expect(mentionsHouse("Khar-Durak", "casa-karasoy")).toBe(false);
    expect(mentionsHouse("Os Dias sem Sino", "ordem-do-sino")).toBe(false);
  });

  it("aceita texto vazio e chave desconhecida", () => {
    expect(mentionsHouse("", "casa-vargen")).toBe(false);
    expect(mentionsHouse(null, "casa-vargen")).toBe(false);
    expect(mentionsHouse("Casa Vargen", "casa-inexistente")).toBe(false);
    expect(houseTerms("casa-inexistente")).toEqual([]);
  });
});
