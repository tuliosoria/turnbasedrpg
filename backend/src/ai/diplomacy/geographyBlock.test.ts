import { describe, expect, it } from "vitest";
import { buildGeographyBlock, cidadesNoMeioDoCaminho, tutelaDe } from "./geographyBlock";

/**
 * A carta que originou estes testes: o jogador de Khazdrun escreveu a Karasoy, e
 * Karasoy respondeu mandando os batedores anões "entrarem por Ferrum", enviando
 * a própria emissária a Ferrum e prometendo pagar "por nomes em Ferrum".
 *
 * Ferrum é a capital da Casa Ferrumor. Karasoy não manda lá.
 *
 * O modelo não inventou: o bloco de geografia entregava Ferrum sob o título
 * "Chão de ninguém entre as duas". O revisor também não pegou, porque recebe o
 * mesmo material — a premissa falsa vinha junto.
 */
describe("de quem é o lugar", () => {
  it("capital de Casa é terra dessa Casa, e precisa da licença dela", () => {
    expect(tutelaDe("casa-ferrumor", "Casa Ferrumor")).toMatch(/licença/i);
    expect(tutelaDe("casa-ferrumor", "Casa Ferrumor")).toMatch(/Casa Ferrumor/);
  });

  // Cânone: "A Irmandade não governa uma província. Sua sede é Raven's Cross,
  // mas a cidade permanece legalmente sob magistratura real."
  it("Raven's Cross é o único lugar que o cânone não dá a uma Casa", () => {
    expect(tutelaDe("irmandade-dos-corvos", "Irmandade dos Corvos")).toMatch(/magistratura real/i);
  });

  it("sede de ordem é de ordem, e não responde por estrada", () => {
    expect(tutelaDe("ordem-dos-tres", "Ordem dos Três")).toMatch(/ordem/i);
    expect(tutelaDe("ordem-dos-tres", "Ordem dos Três")).not.toMatch(/licença dela/i);
  });
});

describe("o mapa que entra na carta", () => {
  const karasoyKhazdrun = () =>
    buildGeographyBlock("casa-karasoy", "casa-khazdrun", "Casa Karasoy", "Casa Khazdrun");

  it("não chama a capital de uma terceira Casa de chão de ninguém", () => {
    const bloco = karasoyKhazdrun();
    expect(bloco).toContain("Ferrum");
    expect(bloco.toLowerCase()).not.toContain("chão de ninguém entre as duas");
  });

  it("nomeia o dono de cada cidade do meio do caminho", () => {
    const bloco = karasoyKhazdrun();
    expect(bloco).toMatch(/Ferrum \(Casa Ferrumor\)/);
    expect(bloco).toMatch(/[Tt]erra da Casa Ferrumor/);
  });

  it("diz que prometer passagem em terra alheia não se cumpre", () => {
    expect(karasoyKhazdrun()).toMatch(/terra que não é sua/i);
  });

  // O que o bloco resolveu quando nasceu continua valendo: Euralune pediu "chão
  // de ninguém" e ninguém soube dizer onde ficava. Lugar nomeado, com distância.
  it("continua nomeando lugar e distância", () => {
    const bloco = karasoyKhazdrun();
    expect(bloco).toMatch(/Ordu-Yildiz e Khar-Durak, a \d+ km/);
    expect(bloco).toMatch(/\d+ km de Casa Karasoy/);
  });

  it("ordena por equilíbrio entre as duas, como antes", () => {
    const meio = cidadesNoMeioDoCaminho("casa-karasoy", "casa-khazdrun");
    expect(meio).toHaveLength(3);
    const desequilibrio = meio.map((m) => Math.abs(m.fromA - m.fromB));
    expect([...desequilibrio].sort((a, b) => a - b)).toEqual(desequilibrio);
    expect(meio.map((m) => m.key)).not.toContain("casa-karasoy");
    expect(meio.map((m) => m.key)).not.toContain("casa-khazdrun");
  });
});
