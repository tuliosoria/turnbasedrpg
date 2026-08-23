import { describe, expect, it } from "vitest";
import { construirDetector } from "./mencoes.js";

const elenco = [
  { id: "gloriandur", nome: "Faraó Gloriandur" },
  { id: "nima", nome: "Nima Olhos de Cinza" },
  { id: "kael", nome: "Ser Kael Rimerberg" },
];

function verbete(body: string, title = "Um verbete") {
  return { entryId: "a", title, body };
}

describe("construirDetector", () => {
  it("encontra o personagem citado pelo nome próprio", () => {
    const v = verbete("Gloriandur chegou ao porto.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).personagens).toEqual(["gloriandur"]);
  });

  it("descarta a palavra do nome que o corpus escreve em minúscula", () => {
    // "Nima Olhos de Cinza" casaria por "olhos", que é palavra comum. Quem
    // decide é o próprio texto de Valdren, não uma lista mantida à mão.
    const v = verbete("Os olhos da guarda não piscaram.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).personagens).toEqual([]);
  });

  it("descarta o termo que serviria a dois personagens", () => {
    // Mandar o leitor para a pessoa errada é pior do que não oferecer link.
    const doisKael = [
      { id: "kael-a", nome: "Ser Kael Rimerberg" },
      { id: "kael-b", nome: "Kael de Asterhall" },
    ];
    const v = verbete("Kael partiu ao amanhecer.");
    const d = construirDetector([v], doisKael);

    expect(d.mencoesEm(v).personagens).toEqual([]);
  });

  it("não casa pedaço de palavra", () => {
    const v = verbete("Kaelen partiu ao amanhecer.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).personagens).toEqual([]);
  });

  it("acha o nome no título do verbete, não só no corpo", () => {
    const v = verbete("Nada aqui.", "A queda de Gloriandur");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).personagens).toEqual(["gloriandur"]);
  });

  it("ignora acento e caixa", () => {
    const v = verbete("GLORIANDUR voltou.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).personagens).toEqual(["gloriandur"]);
  });

  it("verbete sem citação devolve listas vazias", () => {
    const v = verbete("A neve caiu por três dias.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v)).toEqual({ personagens: [], casas: [] });
  });

  it("encontra a Casa citada pelo nome", () => {
    const v = verbete("A Casa Vargen fechou as estradas.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).casas).toContain("casa-vargen");
  });

  it("encontra a Casa citada pela cidade-sede", () => {
    // O texto quase nunca diz "casa-rimerberg": diz o nome da cidade.
    const v = verbete("O silêncio de Rimewatch durou o inverno.");
    const d = construirDetector([v], elenco);

    expect(d.mencoesEm(v).casas).toContain("casa-rimerberg");
  });
});
