import { describe, it, expect } from "vitest";
import { parseRevisao, buildReviewUser, REVIEW_SYSTEM_PROMPT } from "./revisor";

const rascunho = "A".repeat(400);

describe("parseRevisao", () => {
  // A regra que sustenta todo o resto: o revisor pode melhorar uma carta, e
  // nunca pode fazê-la sumir. Carta pior é problema de qualidade; carta que
  // some é um jogador escrevendo no vazio, e isso já custou caro aqui.
  it("devolve null quando o revisor volta vazio, para valer o rascunho", () => {
    expect(parseRevisao("", rascunho)).toBeNull();
    expect(parseRevisao("   ", rascunho)).toBeNull();
  });

  it("devolve null com JSON quebrado", () => {
    expect(parseRevisao("{isto não é json", rascunho)).toBeNull();
  });

  it("devolve null quando falta a carta", () => {
    expect(parseRevisao(JSON.stringify({ veredito: "ok", motivos: [] }), rascunho)).toBeNull();
  });

  // Um revisor que devolve três linhas no lugar de trezentas palavras não
  // revisou: truncou. Preferir o rascunho é o menor dos dois danos.
  it("descarta carta truncada e preserva o rascunho", () => {
    const curta = JSON.stringify({ veredito: "corrigida", carta: "Aceito.", motivos: ["cortei"] });
    expect(parseRevisao(curta, rascunho)).toBeNull();
  });

  it("aceita a carta corrigida e os motivos", () => {
    const boa = JSON.stringify({
      veredito: "corrigida",
      carta: "B".repeat(380),
      motivos: ["tirei a afirmação sobre a aliança", "respondi o convite, não o contrato"],
    });
    const r = parseRevisao(boa, rascunho);
    expect(r?.carta).toHaveLength(380);
    expect(r?.motivos).toHaveLength(2);
  });

  it("aceita veredito ok sem motivos", () => {
    const r = parseRevisao(JSON.stringify({ veredito: "ok", carta: rascunho, motivos: [] }), rascunho);
    expect(r?.carta).toBe(rascunho);
    expect(r?.motivos).toEqual([]);
  });
});

describe("buildReviewUser", () => {
  // Sem o material do escritor, o revisor só consegue julgar estilo — e estilo
  // é o que menos importa. Para saber se um fato foi inventado é preciso ter a
  // lista do que é verdade.
  it("leva o material do escritor junto do rascunho", () => {
    const u = buildReviewUser({ materialDoEscritor: "O fio inteiro aqui", rascunho: "A carta" });
    expect(u).toContain("O fio inteiro aqui");
    expect(u).toContain("A carta");
  });
});

describe("REVIEW_SYSTEM_PROMPT", () => {
  it("cobre as falhas que motivaram o revisor", () => {
    for (const t of ["FATO QUE NÃO SE SUSTENTA", "RESPONDE OUTRA CARTA", "TERMOS QUE NINGUÉM PROPÔS", "ESCAMBO ONDE NÃO CABIA", "PESSOA QUE NÃO EXISTE", "VOZ DE QUALQUER UM"]) {
      expect(REVIEW_SYSTEM_PROMPT).toContain(t);
    }
  });

  it("trata comboio de comércio em tempo de cerco como o defeito de escambo", () => {
    expect(REVIEW_SYSTEM_PROMPT).toMatch(/cerco.*carroça e prazo|carroça e prazo.*cerco/);
  });
});
