import { describe, expect, it } from "vitest";
import { encurtar, escalaAbsurda } from "./escala";

describe("escalaAbsurda", () => {
  // A proposta que originou tudo: ficou PENDENTE na tela do jogador, com botão
  // de aceitar, por três semanas.
  it("pega a troca que abriu o problema", () => {
    expect(escalaAbsurda("8.000 sacas de trigo do Vale da Coroa por 300 toneladas de ferro")).toBeTruthy();
  });

  it("recusa 'toneladas' sempre, porque Valdren não pesa assim", () => {
    expect(escalaAbsurda("duzentas toneladas de ferro")).toBe("fala em toneladas");
    expect(escalaAbsurda("uma tonelada de grão")).toBe("fala em toneladas");
  });

  it("pega mercadoria em milhares, escrita com ponto ou com a palavra mil", () => {
    expect(escalaAbsurda("8.000 sacas de trigo")).toBe("8000 sacas");
    expect(escalaAbsurda("8 mil sacas de trigo")).toBe("8000 sacas");
    expect(escalaAbsurda("4000 barras de ferro")).toBe("4000 barras");
  });

  // Uma Casa move de dez a trinta carroças por comboio. Centenas é conta que
  // ninguém pode cumprir, e é justamente a que soa impressionante.
  it("pega comboio de centenas de carroças", () => {
    // Volta sem acento: é texto de log, não de tela.
    expect(escalaAbsurda("500 carroças de boi em dois comboios")).toBe("500 carrocas");
  });

  it("deixa passar o que a campanha já negociou de verdade", () => {
    // Todos saíram de pactos reais, aceitos pelo Mestre.
    expect(escalaAbsurda("40 barras de ferro de forja marcadas por guilda")).toBeNull();
    expect(escalaAbsurda("1.000 peles curtidas")).toBeNull();
    expect(escalaAbsurda("120 toras de carvalho e freixo de Arven, em 20 carroças")).toBeNull();
    expect(escalaAbsurda("18 fardos selados de ervas de altitude")).toBeNull();
    expect(escalaAbsurda("trezentos frascos de vidro")).toBeNull();
  });

  // Dinheiro não viaja em carroça de boi, e carta de crédito em milhares de
  // marcos é normal numa Casa que empresta.
  it("não confunde ouro com carga", () => {
    expect(escalaAbsurda("6.000 marcos de ouro cunhado em cartas de crédito")).toBeNull();
  });

  it("aguenta texto vazio", () => {
    expect(escalaAbsurda("")).toBeNull();
  });
});

describe("encurtar", () => {
  // O razão do jogador exibia "entregues em Raven's Cross por seis carroças e
  // doze mulas em o" — o corte caía no meio da palavra.
  it("corta na fronteira de palavra", () => {
    const cortado = encurtar("quarenta fardos de peles curtidas entregues na margem sul do Rio Bravio", 40);
    expect(cortado.endsWith("…")).toBe(true);
    expect(cortado).not.toMatch(/\bd…$/);
    expect("quarenta fardos de peles curtidas entregues na margem sul do Rio Bravio").toContain(cortado.slice(0, -1));
  });

  it("devolve igual o que já cabe", () => {
    expect(encurtar("40 barras de ferro", 40)).toBe("40 barras de ferro");
  });

  it("não deixa pontuação solta antes das reticências", () => {
    expect(encurtar("ferro de forja, madeira seca, carne defumada e peles", 20)).not.toMatch(/[,;:]…$/);
  });
});
