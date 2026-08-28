import { describe, expect, it } from "vitest";
import { construirDetector, corpusDoCanone } from "./mencoes.js";
import { fold, nameKey } from "./mortality.js";
import { fullCodex } from "../npc/codex.js";

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
  describe("os enganos que o corpus real revelou", () => {
    it("não confunde a Casa do Ouro com couro nem tesouro", () => {
      // Sem borda de palavra, "ouro" casava dentro de couro, tesouro e vulgar.
      // No corpus real isso fazia o verbete da Grande Casa Ulgar afirmar que
      // citava a Casa do Ouro, porque o texto fala em couro.
      const v = verbete("Trabalhavam o couro e guardavam o tesouro da Coroa.");
      const d = construirDetector([v], elenco);

      expect(d.mencoesEm(v).casas).not.toContain("casa-do-ouro");
    });

    it("não confunde a Grande Casa Ulgar com vulgar", () => {
      const v = verbete("O gesto foi vulgar.");
      const d = construirDetector([v], elenco);

      expect(d.mencoesEm(v).casas).toEqual([]);
    });

    it("descarta o termo de Casa que o corpus usa como palavra comum", () => {
      // "ouro" identifica a Casa do Ouro, mas também é o metal.
      const v = verbete("Pagaram em ouro e prata.");
      const d = construirDetector([v], elenco);

      expect(d.mencoesEm(v).casas).not.toContain("casa-do-ouro");
    });

    it("não identifica a pessoa pelo sobrenome que também nomeia um lugar", () => {
      // "Torre de Véspera" é um lugar. Maelor Véspera era o personagem mais
      // citado do corpus, e quatro dos seis achados eram a torre.
      const gente = [{ id: "maelor", nome: "Maelor Véspera" }];
      const v = verbete("A Torre de Véspera fica ao sul, e o mestre a evitava.");
      const d = construirDetector([v], gente);

      expect(d.mencoesEm(v).personagens).toEqual([]);
    });

    it("não identifica a pessoa pelo sobrenome de outra pessoa", () => {
      // No verbete dos vinte e sete magos, "Alaric Venn" oferecia um link que
      // levava a Liora Venn: o leitor ia parar na pessoa errada.
      const gente = [{ id: "liora", nome: "Mestra Liora Venn" }];
      const v = verbete("Alaric Venn falou por último, e a mestra calou-se.");
      const d = construirDetector([v], gente);

      expect(d.mencoesEm(v).personagens).toEqual([]);
    });
  });
});

describe("trechos para virar link", () => {
  const detector = construirDetector(corpusDoCanone());
  const pessoas = (t: string) =>
    detector.trechos(t).filter((p) => p.tipo === "pessoa").map((p) => `${p.valor}:${(p as { id: string }).id}`);

  it("acha quem o leitor não lembra quem é", () => {
    // A pergunta que originou tudo: "eu não lembrava quem era Dama Elara".
    expect(pessoas("A Dama Elara Voss selou os portões.")).toEqual(["Elara:dama-elara-voss"]);
  });

  it("linka só a primeira menção de cada pessoa", () => {
    const t = "Elara mandou aviso. Elara não esperou resposta. Elara fechou a estrada.";
    expect(pessoas(t)).toEqual(["Elara:dama-elara-voss"]);
  });

  it("devolve o texto inteiro, sem perder nem duplicar um caractere", () => {
    const t = "Selma escreveu a Elara sobre Alic, e ninguém respondeu.";
    expect(detector.trechos(t).map((p) => p.valor).join("")).toBe(t);
  });

  it("não confunde a Casa com a pessoa", () => {
    // "Karasoy" nomeia a Casa inteira; linkar para uma pessoa seria mentira.
    expect(pessoas("A Casa Karasoy recusou o tributo.")).toEqual([]);
  });

  it("junta os registros duplicados da mesma pessoa em vez de descartá-la", () => {
    // Alic aparece no codex pela Casa e pela Coroa. Antes disso, o nome saía
    // como disputado e o personagem central do enredo ficava sem link.
    expect(pessoas("Alic desceu a escadaria.")).toEqual(["Alic:alic-valerius"]);
  });

  it("não linka dentro de outra palavra", () => {
    expect(pessoas("O selmar do porto range.")).toEqual([]);
  });

  it("aguenta texto vazio", () => {
    expect(detector.trechos("")).toEqual([]);
  });
});

describe("título não é nome", () => {
  const detector = construirDetector(corpusDoCanone());
  const termo = (nome: string) => {
    const p = detector.trechos(nome).find((t) => t.tipo === "pessoa");
    return p ? p.valor : null;
  };

  it.each([
    ["Dama Elara Voss", "Elara"],
    ["Lord Aelric Roderic", "Aelric"],
    ["Duquesa Isolde Auremont", "Isolde"],
    ["Padre Jeren Eco-Manso", "Jeren"],
    ["Padre-Contador Remy Hal", "Remy"],
  ])("procura %s pelo nome próprio, não pelo título", (nome, esperado) => {
    expect(termo(nome)).toBe(esperado);
  });

  it("não deixa a palavra 'Lord' solta virar link para alguém", () => {
    // Só existe um "Lord" no elenco, então nada acusava a colisão: a palavra
    // em qualquer frase levava a Aelric Roderic.
    expect(detector.trechos("O Lord chegou tarde ao conselho.")).toEqual([
      { tipo: "texto", valor: "O Lord chegou tarde ao conselho." },
    ]);
  });

  it("nenhum título usado pelo elenco sobrevive como termo de busca", () => {
    // Guarda estrutural: uma palavra que abre o nome de duas pessoas
    // diferentes é título, não nome. Foi assim que "dama" passou despercebido.
    const porPrimeiraPalavra = new Map<string, Set<string>>();
    for (const npc of fullCodex()) {
      const primeira = fold(npc.name).split(/\s+/)[0];
      if (!porPrimeiraPalavra.has(primeira)) porPrimeiraPalavra.set(primeira, new Set());
      porPrimeiraPalavra.get(primeira)!.add(nameKey(npc.name));
    }
    const titulos = [...porPrimeiraPalavra].filter(([, pessoas]) => pessoas.size > 1).map(([p]) => p);

    for (const titulo of titulos) {
      const achados = detector.trechos(`Assim falou ${titulo} naquela noite.`);
      expect(achados.filter((t) => t.tipo === "pessoa")).toEqual([]);
    }
  });

  it("recusa o nome que duas pessoas de verdade dividem", () => {
    // O Patriarca Durgan Khazdrun e Durgan Ferrosalto são dois anões distintos
    // da mesma Casa. Sem link é o resultado certo: link errado seria pior.
    expect(termo("Durgan cruzou o salão.")).toBeNull();
  });
});
