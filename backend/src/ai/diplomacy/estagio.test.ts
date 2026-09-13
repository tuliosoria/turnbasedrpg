import { describe, it, expect } from "vitest";
import { STAGE_RULES } from "./estagio";
import { HOUSE_REPLY_SYSTEM_PROMPT } from "./housePrompt";
import { OUTREACH_SYSTEM_PROMPT } from "./outreachPrompt";

/**
 * A regra viveu primeiro só no prompt de resposta.
 *
 * Por isso a carta seguinte de Ferrumor — que saiu pelo caminho da carta
 * proativa — repetiu exatamente o erro que a regra existia para impedir, e
 * terminou em barris de peixe salgado. Este teste é o que impede a regra de
 * voltar a morar num caminho só.
 */
describe("regras de estágio", () => {
  it("chegam nos DOIS caminhos de carta", () => {
    for (const regra of STAGE_RULES) {
      expect(HOUSE_REPLY_SYSTEM_PROMPT).toContain(regra);
      expect(OUTREACH_SYSTEM_PROMPT).toContain(regra);
    }
  });

  it("proíbem devolver minuta a quem só propôs conversar", () => {
    const texto = STAGE_RULES.join("\n");
    expect(texto).toContain("NÃO escreva a minuta");
    expect(texto).toContain("não fixe preço");
  });
});

/**
 * O escambo era obrigatório por construção: o formato de saída exigia os campos
 * "oferta" e "pedido", então toda carta precisava ser uma nota de mercadoria
 * para ter o que declarar — não sobrava forma para aviso, ameaça ou luto.
 */
describe("a carta deixou de ser obrigatoriamente um negócio", () => {
  it("a troca é opcional no formato de saída", () => {
    expect(OUTREACH_SYSTEM_PROMPT).toContain('"troca": null');
    expect(OUTREACH_SYSTEM_PROMPT).toContain("tem \"troca\": null, e isso é o certo");
  });

  it("o prompt oferece assuntos que não são mercadoria", () => {
    for (const assunto of ["aviso", "ameaça", "cobrança de dívida", "acusação", "condolência"]) {
      expect(OUTREACH_SYSTEM_PROMPT).toContain(assunto);
    }
  });

  // A regra 7 listava "uma oferta com quantidade e prazo" primeiro, e o que vem
  // primeiro numa lista é o que o modelo escolhe.
  it("o movimento concreto não lidera com mercadoria", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toContain("Mercadoria é UM dos movimentos possíveis");
  });
});
