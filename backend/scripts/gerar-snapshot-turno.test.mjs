import { describe, it, expect } from "vitest";
import {
  separarOrdens, conferirOrdem, agruparPorCorpo,
  extrairPrazo, extrairPedido, indicePrimeiraMencao, semMudancaDesde,
  montarBriefing,
} from "./gerar-snapshot-turno.mjs";

describe("separarOrdens", () => {
  it("quebra por numeração do jogador e guarda o corpo de cada item", () => {
    const o = separarOrdens("1. Audiência\nsem ata\n2 — Alinhamentos\n3. Trabuco de 600 mm");
    expect(o.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(o[0].texto).toBe("Audiência\nsem ata");
  });

  it("sem numeração devolve um bloco só, e não dez pedaços inventados", () => {
    expect(separarOrdens("bloco corrido de ordens").length).toBe(1);
  });
});

describe("agruparPorCorpo", () => {
  it("carta aberta a três potências é um texto com três destinos", () => {
    const g = agruparPorCorpo([
      { author: "PLAYER", body: "x", toHouseKey: "a" },
      { author: "PLAYER", body: "x", toHouseKey: "b" },
      { author: "AI", body: "y", toHouseKey: "a" },
    ]);
    expect(g.length).toBe(2);
    expect(g[0].destinos).toEqual(["a", "b"]);
  });
});

/**
 * O relógio é a parte que pode falhar em silêncio: prazo não reconhecido some,
 * e um relógio incompleto dá falsa segurança. Por isso os casos vêm do turno 10
 * de verdade, e o "sem prazo" é um caso de teste, não um descuido.
 */
describe("extrairPrazo", () => {
  it("reconhece ordinal escrito", () => {
    expect(extrairPrazo("prontos a partir do sexto dia após o recebimento")).toContain("a partir do sexto dia");
  });

  it("reconhece ordinal composto", () => {
    expect(extrairPrazo("chegam ao moinho alto no décimo segundo dia")).toContain("no décimo segundo dia");
  });

  it("reconhece dígito com 'em até'", () => {
    expect(extrairPrazo("entregues em até 16 dias")).toContain("em até 16 dias");
  });

  it("reconhece duração, que também é relógio", () => {
    expect(extrairPrazo("mantidos ali por vinte dias")).toContain("por vinte dias");
  });

  it("reconhece marco sem número", () => {
    expect(extrairPrazo("na Porta Leste no próximo pouso de correio")).toContain("próximo pouso de correio");
    expect(extrairPrazo("sai de Ordu-Yildiz na próxima vigília")).toContain("próxima vigília");
  });

  it("acha os dois prazos de um compromisso que tem dois", () => {
    const p = extrairPrazo("prontos do sexto dia, mantidos por vinte dias");
    expect(p.length).toBe(2);
  });

  it("devolve vazio quando não há prazo, para o item cair na lista dos sem prazo", () => {
    expect(extrairPrazo("Ulgar aceita aliança limitada contra o Vórtice Branco")).toEqual([]);
  });

  it("não confunde quantidade com prazo", () => {
    expect(extrairPrazo("entrega 40 barras de ferro e 200 peles")).toEqual([]);
  });
});

describe("extrairPedido", () => {
  it("pega a frase do pedido, não a saudação", () => {
    const r = extrairPedido("Patriarca,\n\nEscrevo antes de ter certeza.\n\nPedimos 36 barras de ferro bom, marcadas por guilda.");
    expect(r.pedido).toContain("36 barras");
    expect(r.achouMarcador).toBe(true);
  });

  it("marca quando não achou verbo de pedido, para o briefing não afirmar demais", () => {
    const r = extrairPedido("Patriarca,\n\nA montanha resistiu ao inverno e nada mais houve.");
    expect(r.achouMarcador).toBe(false);
    expect(r.pedido.length).toBeGreaterThan(0);
  });
});

describe("indicePrimeiraMencao", () => {
  const textos = [
    { turno: 6, texto: "O ourives do Patriarca pesou a moeda de cunho da Casa do Ouro." },
    { turno: 7, texto: "Tomas Três-Pontes contou as moedas sem olhar." },
    { turno: 10, texto: "Hraki falou, e Tomas Três-Pontes não foi citado por Hraki." },
  ];
  it("dá o turno da primeira aparição de cada nome", () => {
    const i = indicePrimeiraMencao(textos);
    expect(i.find((x) => x.nome === "Tomas Três-Pontes").turno).toBe(7);
    expect(i.find((x) => x.nome === "Hraki").turno).toBe(10);
  });

  it("junta nome composto com conector minúsculo", () => {
    const i = indicePrimeiraMencao(textos);
    expect(i.some((x) => x.nome === "Casa do Ouro")).toBe(true);
  });

  it("mantém apóstrofo interno num nome só", () => {
    const i = indicePrimeiraMencao([{ turno: 6, texto: "A cópia que Mok'Thar guardou fala de Nah'Korah." }]);
    expect(i.some((x) => x.nome === "Nah'Korah")).toBe(true);
    expect(i.some((x) => x.nome === "Nah'")).toBe(false);
  });

  it("não cola nomes que estão em linhas diferentes", () => {
    const i = indicePrimeiraMencao([{ turno: 1, texto: "sobre a Casa dos Anões\n\nVocê não gosta de Asterhall" }]);
    expect(i.some((x) => /\n/.test(x.nome))).toBe(false);
    expect(i.some((x) => x.nome.includes("Você"))).toBe(false);
  });

  it("descarta pronome, artigo e palavra comum de uma só palavra", () => {
    const i = indicePrimeiraMencao([{ turno: 1, texto: "sobre Você e sobre Ele, e sobre os Recursos da Coroa e a Casa" }]);
    const nomes = i.map((x) => x.nome);
    expect(nomes).not.toContain("Você");
    expect(nomes).not.toContain("Ele");
    expect(nomes).not.toContain("Recursos");
    expect(nomes).not.toContain("Casa");
  });

  it("mas o nome composto sobrevive mesmo começando por palavra comum", () => {
    const i = indicePrimeiraMencao([{ turno: 6, texto: "a moeda de cunho da Casa do Ouro pesada pelo ourives" }]);
    expect(i.some((x) => x.nome === "Casa do Ouro")).toBe(true);
  });

  it("descarta sigla de duas letras que vem de marcação", () => {
    const i = indicePrimeiraMencao([{ turno: 3, texto: "no relatório A D e também S P foram citados" }]);
    expect(i.map((x) => x.nome).filter((n) => n.length <= 3)).toEqual([]);
  });

  it("tira palavra comum que o conector puxou para dentro do nome", () => {
    const i = indicePrimeiraMencao([{ turno: 5, texto: "esperar Até Alic ordenar a marcha, e depois Sua Casa responder" }]);
    const nomes = i.map((x) => x.nome);
    expect(nomes).toContain("Alic");
    expect(nomes).not.toContain("Até Alic");
    expect(nomes).not.toContain("Sua Casa");
  });

  it("não inventa nome a partir de palavra que só abre frase", () => {
    const i = indicePrimeiraMencao([{ turno: 1, texto: "Depois disso ele não falou mais." }]);
    expect(i.some((x) => x.nome === "Depois")).toBe(false);
  });
});

describe("semMudancaDesde", () => {
  const trilha = [
    { motivo: "resolução do turno 9", antes: { riqueza: 2, recursos: 2 }, depois: { riqueza: 2, recursos: 2 } },
    { motivo: "resolução do turno 10", antes: { riqueza: 2, recursos: 2 }, depois: { riqueza: 2, recursos: 5 } },
  ];
  it("diz em que turno cada atributo mudou por último", () => {
    const m = semMudancaDesde(trilha);
    expect(m.recursos).toBe(10);
    expect(m.riqueza).toBe(null);
  });
});

describe("montarBriefing", () => {
  const base = {
    turno: 10, ultimo: true,
    casa: { name: "Khazdrun", houseId: "khazdrun-wxey", attributes: { riqueza: 2, recursos: 5, soldados: 3, controle: 3 }, stability: 4, assets: ["Aqueduto"] },
    ordens: [{ numero: 1, texto: "Audiência com o prisioneiro" }],
    resultado: "Durgan desceu sozinho e Hraki falou.", privado: "Os leitores ficaram.",
    pactos: [
      { turnNumber: 10, status: "ATIVO", summary: "Vargen aceita três navios prontos a partir do sexto dia, mantidos por vinte dias." },
      { turnNumber: 10, status: "ATIVO", summary: "Ulgar aceita aliança limitada contra o Vórtice Branco." },
      { turnNumber: 4, status: "ATIVO", summary: "Pacto velho que não entra no relógio." },
      { turnNumber: 10, status: "REVOGADO", summary: "Pacto morto." },
    ],
    semResposta: [{ turnNumber: 10, toHouseKey: "casa-drakorys", body: "Patriarca,\n\nMandem um capitão de túnel a Akrathos." }],
    projetos: [{ title: "Trabuco", status: "FAILED", outcome: "FAILURE", lastProcessedTurnId: 9, createdAtTurn: 9 }],
    favores: [{ status: "PENDING", fromHouseId: "casa-euralune", reason: "18 fardos por 36 barras", createdAt: "2026-09-18" }],
    fatos: [{ turnNumber: 9, summary: "SEGREDO: as runas batem." }],
    trilha: [{ motivo: "resolução do turno 10", antes: { recursos: 2 }, depois: { recursos: 5 } }],
    textosAnteriores: [{ turno: 7, texto: "Tomas Três-Pontes recebeu a bolsa." }],
  };

  it("cabe em poucos kB, que é a razão de existir", () => {
    expect(montarBriefing(base).length).toBeLessThan(8000);
  });

  it("separa compromisso com prazo de compromisso sem prazo, e conta o que ficou no arquivo", () => {
    const t = montarBriefing(base);
    expect(t).toContain("a partir do sexto dia");
    expect(t).toMatch(/sem prazo reconhecido/i);
    expect(t).toContain("Ulgar aceita aliança limitada");
    expect(t).toMatch(/1 (pacto|compromisso)[^\n]*arquivo/i);
  });

  it("não leva pacto revogado para o relógio", () => {
    expect(montarBriefing(base)).not.toContain("Pacto morto");
  });

  it("marca projeto que falhou em outro turno", () => {
    expect(montarBriefing(base)).toMatch(/Trabuco[\s\S]{0,120}turno 9/);
  });

  it("corta compromisso longo, porque a íntegra é do arquivo", () => {
    const longo = "Vargen aceita " + "pedra talhada e peles curtidas ".repeat(40) + " a partir do sexto dia.";
    const t = montarBriefing({ ...base, pactos: [{ turnNumber: 10, status: "ATIVO", summary: longo }] });
    expect(t).toContain("a partir do sexto dia");   // o prazo sobrevive ao corte
    expect(t).not.toContain(longo);                 // a íntegra não
    const linha = t.split("\n").find((l) => l.includes("Vargen aceita"));
    expect(linha.length).toBeLessThan(260);
  });

  it("aponta para o arquivo grande em vez de repeti-lo", () => {
    expect(montarBriefing(base)).toContain("khazdrun-turn10-context.md");
  });
});
