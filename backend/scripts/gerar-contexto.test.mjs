import { describe, it, expect } from "vitest";
import { pastaDaCasa, separarPorAudiencia, montarEstado, montarCronica, turnosCumulativos, blocoDeElenco, cartasAbertas } from "./gerar-contexto.mjs";

const CASAS = [
  { houseId: "khazdrun-wxey", name: "Khazdrun", attributes: { riqueza: 2, recursos: 5, soldados: 3, controle: 3 }, stability: 3, assets: ["Poleiro de Euralune"] },
  { houseId: "solarion-k0hc", name: "Solarion", attributes: { riqueza: 2, recursos: 5, soldados: 2, controle: 5 }, stability: 3, assets: [] },
];

/** Um turno resolvido com privado por Casa, que é onde mora o risco de vazar. */
const TURNO = {
  SK: "TURN#009", turnId: 9, status: "RESOLVED",
  publicEvent: "O sol parou no céu.",
  privateInfo: {
    "khazdrun-wxey": "SEGREDO-ANAO: o prisioneiro falou.",
    "solarion-k0hc": "SEGREDO-ELFO: a duble voltou.",
  },
  result: {
    publicResult: "O reino esperou o amanhecer.",
    houseResults: {
      "khazdrun-wxey": "RESULTADO-ANAO: a oitava galeria foi lacrada.",
      "solarion-k0hc": "RESULTADO-ELFO: as estufas partiram.",
    },
    attributeDeltas: {}, discoveries: [],
  },
};

const FATOS = [
  { SK: "WFACT#a", id: "a", turnNumber: 9, visibility: "PUBLICO", status: "ATIVO", kind: "MILITAR", parties: [], summary: "Rimewatch caiu e nao respondeu." },
  { SK: "WFACT#b", id: "b", turnNumber: 9, visibility: "casa-khazdrun", status: "ATIVO", kind: "MILITAR", parties: ["casa-khazdrun"], summary: "SEGREDO-MOEDA: Hraki confessou." },
  { SK: "WFACT#c", id: "c", turnNumber: 8, visibility: "casa-solarion", status: "ATIVO", kind: "MILITAR", parties: ["casa-solarion"], summary: "SEGREDO-LENTE: Solarion calou o aviso." },
];

const CARTAS = [
  { SK: "DIPLMSG#0009#khazdrun-wxey~casa-euralune#out-9-x", id: "out-9-x", turnNumber: 9, author: "AI", fromHouseId: "khazdrun-wxey", toHouseKey: "casa-euralune", body: "CARTA-DO-MUNDO: as aves precisam de ferro.", createdAt: "2026-09-13T10:00:00.000Z" },
  { SK: "DIPLMSG#0009#khazdrun-wxey~casa-euralune#p1", id: "p1", turnNumber: 9, author: "PLAYER", fromHouseId: "khazdrun-wxey", toHouseKey: "casa-euralune", body: "CARTA-ANA: mandamos as barras.", createdAt: "2026-09-13T11:00:00.000Z" },
  { SK: "DIPLMSG#0009#solarion-k0hc~casa-karasoy#p2", id: "p2", turnNumber: 9, author: "PLAYER", fromHouseId: "solarion-k0hc", toHouseKey: "casa-karasoy", body: "CARTA-ELFA: os registros seguem.", createdAt: "2026-09-13T12:00:00.000Z" },
];

const NPCS = [
  { SK: "NPCDYN#casa-karasoy#selma-karasoy", id: "selma-karasoy", mood: "desconfiada", objective: "SEGREDO-NPC: descobrir quem entregou Aylin." },
];

function itens() {
  return [...CASAS.map((c) => ({ ...c, SK: `HOUSE#${c.houseId}` })), TURNO, ...FATOS, ...CARTAS, ...NPCS];
}

function fatias() {
  return separarPorAudiencia(itens(), CASAS);
}

/** O corpo de uma seção do estado, para asserção que não deve varrer o documento todo. */
const secao = (texto, titulo) => texto.split(`## ${titulo}`)[1]?.split("\n## ")[0] ?? "";

describe("pastaDaCasa", () => {
  it("usa o nome curto em slug, decidido pelo autor", () => {
    expect(pastaDaCasa("Do Ouro")).toBe("do-ouro");
    expect(pastaDaCasa("Khazdrun")).toBe("khazdrun");
  });

  it("normaliza acento e pontuação", () => {
    expect(pastaDaCasa("Casa Órfã d'Água")).toBe("casa-orfa-d-agua");
  });
});

/**
 * O desenho inteiro existe por causa destas três garantias.
 *
 * Com pasta por audiência, vazar segredo deixa de ser julgamento de um modelo e
 * passa a ser asserção de teste. Verificamos no TEXTO RENDERIZADO, não na fatia:
 * é o arquivo que vaza, não a estrutura intermediária.
 */
describe("sigilo entre audiências", () => {
  it("fato de uma Casa não aparece no público nem na Casa vizinha", () => {
    const f = fatias();
    expect(montarEstado(f.publico)).not.toContain("SEGREDO-MOEDA");
    expect(montarEstado(f.casas["solarion"])).not.toContain("SEGREDO-MOEDA");
    expect(montarEstado(f.casas["khazdrun"])).toContain("SEGREDO-MOEDA");
  });

  it("o privado de uma Casa não aparece no público nem na Casa vizinha", () => {
    const f = fatias();
    for (const texto of [montarEstado(f.publico), montarCronica(f.publico), montarEstado(f.casas["solarion"]), montarCronica(f.casas["solarion"])]) {
      expect(texto).not.toContain("SEGREDO-ANAO");
      expect(texto).not.toContain("RESULTADO-ANAO");
    }
    expect(montarCronica(f.casas["khazdrun"])).toContain("RESULTADO-ANAO");
  });

  it("memória viva de NPC só existe no arquivo do Mestre", () => {
    const f = fatias();
    expect(montarEstado(f.mestre)).toContain("SEGREDO-NPC");
    expect(montarEstado(f.publico)).not.toContain("SEGREDO-NPC");
    expect(montarEstado(f.casas["khazdrun"])).not.toContain("SEGREDO-NPC");
  });

  it("o Mestre enxerga o segredo de todas as Casas", () => {
    const texto = montarEstado(fatias().mestre) + montarCronica(fatias().mestre);
    expect(texto).toContain("SEGREDO-MOEDA");
    expect(texto).toContain("SEGREDO-LENTE");
    expect(texto).toContain("SEGREDO-ANAO");
    expect(texto).toContain("SEGREDO-ELFO");
  });

  it("carta que o mundo escreveu fica fora do público", () => {
    const f = fatias();
    expect(montarCronica(f.mestre)).toContain("CARTA-DO-MUNDO");
    expect(montarCronica(f.publico)).not.toContain("CARTA-DO-MUNDO");
  });
});

describe("estado", () => {
  it("traz o que o reino sabe: evento, resultado e fato público", () => {
    const texto = montarEstado(fatias().publico);
    expect(texto).toContain("O sol parou no céu.");
    expect(texto).toContain("Rimewatch caiu");
  });

  // Número de ficha não é coisa que uma Casa saiba da outra.
  it("não põe atributo de Casa no arquivo público", () => {
    const texto = montarEstado(fatias().publico);
    expect(texto).not.toMatch(/recursos/i);
  });

  it("põe os atributos no arquivo da própria Casa", () => {
    expect(montarEstado(fatias().casas["khazdrun"])).toMatch(/recursos/i);
  });
});

describe("crônica", () => {
  it("vai do primeiro turno ao corrente, em ordem", () => {
    const texto = montarCronica(fatias().mestre);
    expect(texto).toContain("Turno 9");
  });

  it("resume cada carta em uma linha com remetente e destino", () => {
    const texto = montarCronica(fatias().casas["khazdrun"]);
    expect(texto).toContain("casa-euralune");
    expect(texto).toContain("CARTA-ANA");
  });

  // Uma Casa criada agora não tem turno resolvido nenhum.
  it("não quebra com Casa sem turno resolvido", () => {
    const nova = { houseId: "nova-aaaa", name: "Nova", attributes: { riqueza: 1, recursos: 1, soldados: 1, controle: 1 }, stability: 3, assets: [] };
    const f = separarPorAudiencia([...itens(), { ...nova, SK: "HOUSE#nova-aaaa" }], [...CASAS, nova]);
    expect(() => montarCronica(f.casas["nova"])).not.toThrow();
    expect(montarEstado(f.casas["nova"])).toContain("Nova");
  });

  it("dá pasta a uma Casa nova sem editar código", () => {
    const nova = { houseId: "nova-aaaa", name: "Nova", attributes: { riqueza: 1, recursos: 1, soldados: 1, controle: 1 }, stability: 3, assets: [] };
    const f = separarPorAudiencia([...itens(), { ...nova, SK: "HOUSE#nova-aaaa" }], [...CASAS, nova]);
    expect(Object.keys(f.casas).sort()).toEqual(["khazdrun", "nova", "solarion"]);
  });
});

const PROJETOS = [
  { SK: "PROJECT#khazdrun-wxey#p-ativo", id: "p-ativo", houseId: "khazdrun-wxey",
    title: "Estabelecer uma Rota de Caravanas", status: "ACTIVE",
    turnsCompleted: 1, durationTurns: 3, createdAtTurn: 7, lastProcessedTurnId: 9,
    completionEffects: { assets: [], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
  { SK: "PROJECT#khazdrun-wxey#p-morto", id: "p-morto", houseId: "khazdrun-wxey",
    title: "Estabelecer uma Rota de Caravanas", status: "CANCELLED",
    turnsCompleted: 0, durationTurns: 3, createdAtTurn: 5, lastProcessedTurnId: 8,
    completionEffects: { assets: [], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
  { SK: "PROJECT#solarion-k0hc#p-feito", id: "p-feito", houseId: "solarion-k0hc",
    title: "Desenvolvimento dos Balões de Vento", status: "COMPLETED", outcome: "SUCCESS",
    turnsCompleted: 1, durationTurns: 1, createdAtTurn: 9, lastProcessedTurnId: 9,
    completionEffects: { assets: ["Balão de Vento"], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } },
];

describe("projetos", () => {
  function comProjetos() {
    return separarPorAudiencia([...itens(), ...PROJETOS], CASAS);
  }

  // O caso real: três "Rota de Caravanas" saíam em três linhas idênticas menos
  // o status, e não havia como dizer qual era qual.
  it("separa cartas homônimas por situação e por id", () => {
    const texto = montarEstado(comProjetos().casas["khazdrun"]);
    expect(texto).toContain("**Em andamento**");
    expect(texto).toContain("**Encerrados sem efeito**");
    expect(texto).toContain("1/3 turnos");
    expect(texto).toContain("`p-ativo`");
    expect(texto).toContain("`p-morto`");
  });

  it("agrupa por Casa e diz o efeito de uma carta concluída", () => {
    const texto = montarEstado(comProjetos().mestre);
    expect(texto).toContain("### Khazdrun");
    expect(texto).toContain("### Solarion");
    expect(texto).toMatch(/Balões de Vento — T9, SUCCESS → ativo "Balão de Vento"/);
  });

  // Review Focus 1: status desconhecido não pode engolir a carta.
  it("não some com carta de status desconhecido", () => {
    const estranha = { ...PROJETOS[0], id: "p-raro", status: "INVENTADO" };
    const f = separarPorAudiencia([...itens(), estranha], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    expect(texto).toContain("`p-raro`");
    expect(texto).toContain("**Esperando decisão**");
  });

  // Review Focus 2: carta gravada antes do campo existir.
  it("não quebra com carta sem completionEffects", () => {
    const velha = { SK: "PROJECT#khazdrun-wxey#p-velho", id: "p-velho", houseId: "khazdrun-wxey",
      title: "Carta antiga", status: "COMPLETED", outcome: "SUCCESS", lastProcessedTurnId: 4 };
    const f = separarPorAudiencia([...itens(), velha], CASAS);
    expect(() => montarEstado(f.casas["khazdrun"])).not.toThrow();
    expect(montarEstado(f.casas["khazdrun"])).toContain("`p-velho`");
  });
});

const ENERGIA = [
  { SK: "ENERGY#009#khazdrun-wxey", turnId: 9, houseId: "khazdrun-wxey",
    porProjeto: { "p-ativo": 2, "p-sumido": 1 } },
];

describe("energia", () => {
  function comEnergia() {
    return separarPorAudiencia([...itens(), ...PROJETOS, ...ENERGIA], CASAS);
  }

  it("resolve o id do projeto para o título e soma os pontos", () => {
    const texto = montarEstado(comEnergia().casas["khazdrun"]);
    expect(texto).toContain("3 de 3 pontos");
    expect(texto).toContain("Estabelecer uma Rota de Caravanas 2");
  });

  // Ausência silenciosa é indistinguível de bug de leitura.
  it("diz que a Casa não alocou em vez de omitir a linha", () => {
    const texto = montarEstado(comEnergia().mestre);
    expect(texto).toContain("**Solarion** (T9) — não alocou");
  });

  it("marca id de projeto que não existe em vez de sumir com ele", () => {
    const texto = montarEstado(comEnergia().mestre);
    expect(texto).toContain("p-sumido (projeto não encontrado) 1");
  });

  it("não põe alocação de uma Casa no arquivo da vizinha nem no público", () => {
    const f = comEnergia();
    expect(montarEstado(f.casas["solarion"])).not.toContain("Rota de Caravanas 2");
    expect(montarEstado(f.publico)).not.toMatch(/Energia do turno/);
  });

  // Casa com zero ENERGY# items deve renderizar "não alocou", não sumir.
  it("renderiza 'não alocou' no arquivo da Casa mesmo com zero ENERGY# items", () => {
    const f = comEnergia();
    const texto = montarEstado(f.casas["solarion"]);
    expect(texto).toContain("**Solarion** (T9) — não alocou");
  });
});

const RELACOES = [
  { SK: "HRELATION#casa-khazdrun#casa-solarion", fromKey: "casa-khazdrun", toKey: "casa-solarion",
    amizade: 58, comercio: 70, favores: 55, note: "SENTIMENTO-ANAO: pagaram o ferro." },
  { SK: "HRELATION#casa-solarion#casa-khazdrun", fromKey: "casa-solarion", toKey: "casa-khazdrun",
    amizade: 40, comercio: 30, favores: 20, note: "SENTIMENTO-ELFO: demoraram a responder." },
];

describe("relações entre Casas", () => {
  function comRelacoes() {
    return separarPorAudiencia([...itens(), ...RELACOES], CASAS);
  }

  it("o Mestre vê as duas direções", () => {
    const texto = montarEstado(comRelacoes().mestre);
    expect(texto).toContain("SENTIMENTO-ANAO");
    expect(texto).toContain("SENTIMENTO-ELFO");
    expect(texto).toContain("amizade 58");
  });

  // O que sentem de você não é coisa que você saiba.
  it("uma Casa vê o que sente, nunca o que sentem dela", () => {
    const texto = montarEstado(comRelacoes().casas["khazdrun"]);
    expect(texto).toContain("SENTIMENTO-ANAO");
    expect(texto).not.toContain("SENTIMENTO-ELFO");
  });

  it("o arquivo público não tem relação nenhuma", () => {
    const texto = montarEstado(comRelacoes().publico);
    expect(texto).not.toContain("SENTIMENTO-ANAO");
    expect(texto).not.toContain("SENTIMENTO-ELFO");
    expect(texto).not.toMatch(/Relações entre Casas/);
  });
});

describe("elenco", () => {
  // Lady Celene Valerius está no elenco canônico de casa-valerius.
  const MORTE = {
    SK: "TURN#010", turnId: 10, status: "RESOLVED",
    publicEvent: "As máquinas chegaram ao alcance.",
    privateInfo: {},
    result: { publicResult: "Lady Celene Valerius foi encontrada morta no castelo.",
      houseResults: {}, attributeDeltas: {}, discoveries: [] },
  };

  it("marca quem morreu, com o turno, e deixa os outros vivos", () => {
    const f = separarPorAudiencia([...itens(), MORTE], CASAS);
    const texto = montarEstado(f.mestre);
    expect(texto).toContain("Lady Celene Valerius");
    expect(texto).toMatch(/Lady Celene Valerius.*morto no T10/);
  });

  it("junta humor e objetivo só no arquivo do Mestre", () => {
    const f = separarPorAudiencia([...itens(), MORTE], CASAS);
    expect(montarEstado(f.mestre)).toContain("SEGREDO-NPC");
    expect(montarEstado(f.casas["khazdrun"])).not.toContain("SEGREDO-NPC");
    expect(montarEstado(f.casas["khazdrun"])).toContain("Lady Celene Valerius");
  });

  // Review Focus 4: casa-solarion tem elenco canônico vazio.
  it("não emite cabeçalho órfão para chave de elenco vazia", () => {
    const texto = montarEstado(separarPorAudiencia(itens(), CASAS).mestre);
    expect(texto).not.toMatch(/casa-solarion\)\s*—\s*;/);
  });
});

describe("cartas abertas", () => {
  const FIO = [
    { SK: "DIPLMSG#0007#khazdrun-wxey~casa-vargen#a1", id: "a1", turnNumber: 7, author: "PLAYER",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Primeira.", createdAt: "2026-09-01T10:00:00.000Z" },
    { SK: "DIPLMSG#0008#khazdrun-wxey~casa-vargen#a2", id: "a2", turnNumber: 8, author: "PLAYER",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Segunda.", createdAt: "2026-09-02T10:00:00.000Z" },
    { SK: "DIPLMSG#0009#khazdrun-wxey~casa-vargen#r1", id: "r1", turnNumber: 9, author: "AI", replyToId: "a1",
      fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", body: "Resposta à primeira.", createdAt: "2026-09-03T10:00:00.000Z" },
  ];

  it("conta só a carta que ninguém citou, e data pelo fio mais antigo", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    expect(texto).toContain("casa-vargen");
    expect(texto).toMatch(/2 cartas sem resposta registrada desde T8/);
  });

  it("não conta a carta que já foi respondida", () => {
    const abertas = cartasAbertas(FIO);
    const vargen = abertas.find((x) => x.para === "casa-vargen");
    expect(vargen.quantas).toBe(2);
    expect(vargen.desdeTurno).toBe(8);
  });

  it("não expõe fio de uma Casa no arquivo da vizinha", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    expect(secao(montarEstado(f.casas["solarion"]), "Cartas abertas")).not.toContain("casa-vargen");
    expect(secao(montarEstado(f.casas["khazdrun"]), "Cartas abertas")).toContain("casa-vargen");
  });
});
