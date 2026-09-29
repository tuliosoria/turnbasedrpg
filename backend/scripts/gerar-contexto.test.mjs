import { describe, it, expect } from "vitest";
import { pastaDaCasa, separarPorAudiencia, montarEstado, montarCronica, cartasAbertas, montarJson } from "./gerar-contexto.mjs";

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

  it("mantém os últimos resultados privados quando o turno seguinte já está aberto", () => {
    const proximo = { SK: "TURN#010", turnId: 10, status: "OPEN", publicEvent: "Uma nova ameaça.",
      privateInfo: { "khazdrun-wxey": "SEGREDO-NOVO: chegou um emissário." } };
    const f = separarPorAudiencia([...itens(), proximo], CASAS);
    const casa = montarEstado(f.casas["khazdrun"]);
    const mestre = montarEstado(f.mestre);
    expect(casa).toContain("O que Khazdrun viveu no turno 9");
    expect(casa).toContain("RESULTADO-ANAO");
    expect(casa).toContain("SEGREDO-NOVO");
    expect(mestre).toContain("O que cada Casa viveu no turno 9");
    expect(mestre).toContain("RESULTADO-ANAO");
    expect(mestre).toContain("RESULTADO-ELFO");
    expect(mestre).toContain("SEGREDO-NOVO");
  });

  it("não chama pedido ou recusa de pacto de pé", () => {
    const registros = [
      { SK: "CFACT#pedido", betweenA: "khazdrun-wxey", betweenB: "casa-vargen", kind: "PEDIDO", status: "ATIVO", summary: "PEDIDO-ABERTO" },
      { SK: "CFACT#acordo", betweenA: "khazdrun-wxey", betweenB: "casa-vargen", kind: "ACORDO", status: "ATIVO", summary: "ACORDO-FIRMADO" },
      { SK: "CFACT#revogado", betweenA: "khazdrun-wxey", betweenB: "casa-vargen", kind: "ACORDO", status: "REVOGADO", summary: "ACORDO-REVOGADO" },
    ];
    const texto = montarEstado(separarPorAudiencia([...itens(), ...registros], CASAS).casas["khazdrun"]);
    expect(secao(texto, "Pactos de pé")).toContain("ACORDO-FIRMADO");
    expect(secao(texto, "Pactos de pé")).not.toContain("PEDIDO-ABERTO");
    expect(secao(texto, "Pactos de pé")).not.toContain("ACORDO-REVOGADO");
    expect(secao(texto, "Outros fatos da correspondência")).toContain("PEDIDO-ABERTO");
    expect(secao(texto, "Outros fatos da correspondência")).toContain("ACORDO-REVOGADO");
  });
});

describe("crônica", () => {
  it("vai do primeiro turno ao corrente, em ordem", () => {
    const texto = montarCronica(fatias().mestre);
    expect(texto).toContain("Turno 9");
  });

  it("resume cada carta em uma linha com remetente e destino", () => {
    const texto = montarCronica(fatias().casas["khazdrun"]);
    expect(texto).toContain("casa-khazdrun → casa-euralune");
    expect(texto).toContain("casa-euralune → casa-khazdrun");
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

  // Fix 1: FAILED rodou o turno inteiro e foi julgada — não é "sem efeito"
  // como CANCELLED/REJECTED, que nunca rodaram.
  it("carta FAILED entra em Concluídos, com o veredito visível, ao lado de CANCELLED em Encerrados sem efeito", () => {
    const falha = { SK: "PROJECT#khazdrun-wxey#p-falha", id: "p-falha", houseId: "khazdrun-wxey",
      title: "Expedição às Minas Frias", status: "FAILED", outcome: "FAILURE",
      turnsCompleted: 3, durationTurns: 3, createdAtTurn: 6, lastProcessedTurnId: 9,
      completionEffects: { assets: [], attributeChanges: [], favors: [], unlocks: [], qualitativeEffects: [] } };
    const f = separarPorAudiencia([...itens(), ...PROJETOS, falha], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    const secaoProjetos = secao(texto, "Projetos");
    const concluidos = secaoProjetos.split("**Encerrados sem efeito**")[0].split("**Concluídos**")[1] ?? "";
    const semEfeito = secaoProjetos.split("**Encerrados sem efeito**")[1] ?? "";
    expect(concluidos).toContain("T9, FAILURE");
    expect(concluidos).toContain("`p-falha`");
    expect(semEfeito).not.toContain("p-falha");
    expect(semEfeito).toContain("`p-morto`");
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

  // O relato do turno 1 não é anúncio, e o segredo da Casa não vaza para o público.
  it("o arquivo público não declara morte que a crônica pública não anuncia", () => {
    const relato = {
      SK: "TURN#001", turnId: 1, status: "RESOLVED",
      publicEvent: "A assembleia começa.",
      privateInfo: {
        "khazdrun-wxey": "SEGREDO: Lady Celene Valerius foi encontrada morta no castelo.",
      },
      result: {
        publicResult: "Lady Celene apresentou mensagens preocupantes vindas do Norte: A cidade de Rimewatch deixou de responder, aldeias foram abandonadas e existem relatos de mortos deixando suas sepulturas.",
        houseResults: {
          "khazdrun-wxey": "Lady Celene Valerius foi encontrada morta no castelo.",
        },
        attributeDeltas: {}, discoveries: [],
      },
    };
    const f = separarPorAudiencia([...itens(), relato], CASAS);
    const publico = secao(montarEstado(f.publico), "Elenco");
    expect(publico).toMatch(/Lady Celene Valerius.*vivo/);
    expect(publico).not.toMatch(/Lady Celene Valerius.*morto/);
    expect(montarEstado(f.publico)).not.toContain("encontrada morta");
    expect(montarJson(f.publico).elenco.find((p) => p.nome === "Lady Celene Valerius")).toMatchObject({
      vivo: true, morreuNoTurno: null,
    });
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

  it("separa a direção da resposta do NPC e data a carta ainda aberta", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    const texto = montarEstado(f.casas["khazdrun"]);
    expect(texto).toContain("casa-vargen");
    expect(texto).toMatch(/Khazdrun → casa-vargen — 1 carta sem resposta vinculada desde T8/);
    expect(texto).toMatch(/casa-vargen → Khazdrun — 1 carta sem carta posterior do destinatário desde T9/);
  });

  // Fix 2: o remetente é a própria Casa lendo o arquivo — que ela se veja pelo
  // nome, não pelo id cru do banco.
  it("resolve o remetente para o nome da Casa, não o id do banco", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    const texto = secao(montarEstado(f.casas["khazdrun"]), "Cartas abertas");
    expect(texto).toContain("Khazdrun → casa-vargen");
    expect(texto).not.toContain("khazdrun-wxey");
  });

  it("não conta a carta que já foi respondida", () => {
    const abertas = cartasAbertas(FIO);
    const vargen = abertas.find((x) => x.de === "casa-khazdrun" && x.para === "casa-vargen");
    expect(vargen.quantas).toBe(1);
    expect(vargen.desdeTurno).toBe(8);
  });

  it("não mantém uma carta proativa do NPC aberta após uma carta posterior do jogador", () => {
    const fio = [
      { id: "a", turnNumber: 7, author: "AI", fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", createdAt: "2026-09-01T10:00:00.000Z" },
      { id: "b", turnNumber: 8, author: "PLAYER", fromHouseId: "khazdrun-wxey", toHouseKey: "casa-vargen", createdAt: "2026-09-02T10:00:00.000Z" },
    ];
    expect(cartasAbertas(fio)).toEqual([expect.objectContaining({
      de: "casa-khazdrun", para: "casa-vargen", criterio: "respostaVinculada",
    })]);
  });

  it("mostra carta recebida de outro jogador aos dois lados e só deixa aberta a última direção", () => {
    const conversa = [
      { SK: "DIPLMSG#0010#par#p1", id: "p1", turnNumber: 10, author: "PLAYER", fromHouseId: "khazdrun-wxey",
        fromPlayerHouseId: "khazdrun-wxey", toHouseKey: "casa-solarion", body: "PEDIDO-ANAO", createdAt: "2026-09-20T10:00:00.000Z" },
      { SK: "DIPLMSG#0010#par#p2", id: "p2", turnNumber: 10, author: "PLAYER", fromHouseId: "solarion-k0hc",
        fromPlayerHouseId: "solarion-k0hc", toHouseKey: "casa-khazdrun", body: "RESPOSTA-ELFA", createdAt: "2026-09-20T11:00:00.000Z" },
    ];
    const terceira = { ...CASAS[0], houseId: "do-ouro-g0gg", name: "Do Ouro" };
    const f = separarPorAudiencia([...itens(), { ...terceira, SK: "HOUSE#do-ouro-g0gg" },
      { SK: "TURN#010", turnId: 10, status: "OPEN", publicEvent: "" }, ...conversa], [...CASAS, terceira]);
    for (const casa of [f.casas["khazdrun"], f.casas["solarion"]]) {
      const cronica = montarCronica(casa);
      expect(cronica).toContain("casa-khazdrun → casa-solarion: PEDIDO-ANAO");
      expect(cronica).toContain("casa-solarion → casa-khazdrun: RESPOSTA-ELFA");
      const abertas = cartasAbertas(casa.cartas, casa.casas);
      expect(abertas.some((x) => x.de === "casa-khazdrun" && x.para === "casa-solarion")).toBe(false);
      expect(abertas).toContainEqual(expect.objectContaining({
        de: "casa-solarion", para: "casa-khazdrun", quantas: 1, desdeTurno: 10,
      }));
      expect(montarEstado(casa)).toContain("1 carta sem carta posterior do destinatário desde T10");
    }
    expect(montarCronica(f.casas["do-ouro"])).not.toContain("PEDIDO-ANAO");
    expect(montarCronica(f.publico)).not.toContain("PEDIDO-ANAO");
  });

  it("não expõe fio de uma Casa no arquivo da vizinha", () => {
    const f = separarPorAudiencia([...itens(), ...FIO], CASAS);
    expect(secao(montarEstado(f.casas["solarion"]), "Cartas abertas")).not.toContain("casa-vargen");
    expect(secao(montarEstado(f.casas["khazdrun"]), "Cartas abertas")).toContain("casa-vargen");
  });
});

describe("estado-atual.json", () => {
  function tudo() {
    return separarPorAudiencia([...itens(), ...PROJETOS, ...ENERGIA, ...RELACOES], CASAS);
  }

  it("traz o turno, as casas e os projetos sem prosa", () => {
    const j = montarJson(tudo().mestre);
    expect(j.turno.atual).toBe(9);
    expect(j.turno.status).toBe("RESOLVED");
    expect(j.casas.map((c) => c.houseId)).toContain("khazdrun-wxey");
    expect(j.projetos.find((p) => p.id === "p-ativo").grupo).toBe("Em andamento");
  });

  // O formato duplo só se justifica se os dois não puderem divergir.
  it("todo projeto do JSON aparece no MD e vice-versa", () => {
    const f = tudo().mestre;
    const j = montarJson(f);
    const md = montarEstado(f);
    const idsNoMd = [...secao(md, "Projetos").matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
    const idsNoJson = j.projetos.map((p) => p.id);
    expect([...idsNoMd].sort()).toEqual([...idsNoJson].sort());
  });

  it("obedece a mesma régua de sigilo do markdown", () => {
    const j = montarJson(tudo().publico);
    expect(j.relacoes).toEqual([]);
    expect(j.casas[0].atributos).toBeUndefined();

    // Fix 3: o corte perigoso é Casa contra Casa — o JSON de uma Casa não pode
    // carregar a relação nem a ficha de atributo de uma rival.
    expect(montarJson(tudo().casas["khazdrun"]).relacoes.every((r) => r.fromKey === "casa-khazdrun")).toBe(true);
    expect(montarJson(tudo().casas["solarion"]).casas.map((c) => c.nome)).toEqual(["Solarion"]);
  });

  // Review Focus 5: campanha sem turno nenhum.
  it("não quebra com partição sem turno", () => {
    const f = separarPorAudiencia(CASAS.map((c) => ({ ...c, SK: `HOUSE#${c.houseId}` })), CASAS);
    expect(() => montarJson(f.mestre)).not.toThrow();
    expect(() => montarEstado(f.mestre)).not.toThrow();
    expect(montarJson(f.mestre).turno.atual).toBe(null);

    // Fix 4: sem turno, o elenco não pode divergir entre os dois formatos —
    // o JSON já emitia o elenco inteiro vivo; o .md tinha um guarda que
    // devolvia nada. Os dois têm que concordar que o elenco existe.
    const j = montarJson(f.mestre);
    expect(j.elenco.length).toBeGreaterThan(0);
    expect(j.elenco.every((p) => p.vivo === true)).toBe(true);
    expect(montarEstado(f.mestre)).toContain("## Elenco");
  });
});
