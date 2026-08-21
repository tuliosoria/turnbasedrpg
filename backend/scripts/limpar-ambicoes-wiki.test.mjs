import { describe, expect, it } from "vitest";
import { limpar } from "./limpar-ambicoes-wiki.mjs";

const texto = (body) => limpar(body).filter((l) => l !== null).join("\n");

describe("limpar-ambicoes-wiki", () => {
  it("corta o rótulo e tudo que vem depois dele", () => {
    const antes = "- **Ortiz:** servo e negociador. Quer: uma rede de influência. Esconde: sua ambição real.";
    expect(texto(antes)).toBe("- **Ortiz:** servo e negociador.");
  });

  it("corta o rótulo em negrito", () => {
    const antes = "- **Irmã Fea:** curadora. **Quer:** reformular os ritos. **Esconde:** teme o rompimento.";
    expect(texto(antes)).toBe("- **Irmã Fea:** curadora.");
  });

  it("remove a linha inteira quando a ambição é o item", () => {
    expect(limpar("- **Busca:** garantir a prosperidade de Khar-Durak.")).toEqual([null]);
  });

  it("corta a ambição dissolvida em prosa, preservando o resto da figura", () => {
    const antes = "- **Tobren:** Mestre das Águias. Homem de poucas palavras. Quer mudar a estratégia. Esconde: sente-se culpado.";
    expect(texto(antes)).toBe("- **Tobren:** Mestre das Águias. Homem de poucas palavras.");
  });

  it("preserva a recusa, que é pública", () => {
    const antes = "- **Aylin:** Mãe da Planície. Busca parcerias de mitril. Recusa acordos que arrisquem a autonomia.";
    expect(texto(antes)).toBe("- **Aylin:** Mãe da Planície. Recusa acordos que arrisquem a autonomia.");
  });

  it("para em vez de apagar quando a recusa vem depois do rótulo", () => {
    expect(() => limpar("- **X:** algo. Quer: poder. Recusa: humilhação.")).toThrow(/Recusa/);
  });

  it("corta a ambição pendurada na vírgula sem levar o temperamento", () => {
    const antes = "- **Miriel:** diplomata. Orgulhosa, desconfiada e decidida, busca reconhecimento da Casa. Ela recusa propostas humilhantes.";
    expect(texto(antes)).toBe("- **Miriel:** diplomata. Orgulhosa, desconfiada e decidida. Ela recusa propostas humilhantes.");
  });

  it("pega o verbo em minúscula depois do pronome", () => {
    const antes = "- **Sarya:** arquiteta. Admirada por sua visão. Ela quer ver Ferrum como exemplo, mas teme a rejeição.";
    expect(texto(antes)).toBe("- **Sarya:** arquiteta. Admirada por sua visão.");
  });

  it("não toca a linha que não vaza nada", () => {
    const antes = "Pátios internos escondem jardins. A ilha depende de grãos de Valdren.  ";
    expect(limpar(antes)).toEqual([antes]);
  });

  it("poupa a posição pública de uma Casa, que não tem sujeito pessoal", () => {
    const antes = "Deseja financiar a Coroa e oferecer minério.";
    expect(limpar(antes)).toEqual([antes]);
  });

  it("corta a ambição de uma pessoa mesmo fora da lista", () => {
    const antes = "Leônidas administra os celeiros. Ele busca aumentar as reservas de grãos.";
    expect(texto(antes)).toBe("Leônidas administra os celeiros.");
  });

  it("devolve a quebra de linha do Markdown que a linha já tinha", () => {
    const antes = "- **Ysara Bel:** líder cautelosa. Deseja que todos os nomes sejam respeitados.  ";
    expect(texto(antes)).toBe("- **Ysara Bel:** líder cautelosa.  ");
  });
});
