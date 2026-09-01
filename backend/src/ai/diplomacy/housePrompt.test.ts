import { houseProfileFor } from "@ravenloft/content";
import { emptyHouseRelation, type HouseRelation } from "@ravenloft/content";
import { describe, it, expect } from "vitest";
import { personaFor, fullCodex, type WikiEntry, type WorldFact } from "@ravenloft/content";
import { HOUSE_REPLY_SYSTEM_PROMPT, buildHouseReplyUser, relationsBetween, parseReply } from "./housePrompt";
import { OUTREACH_SYSTEM_PROMPT } from "./outreachPrompt";

const karasoy: WikiEntry = {
  entryId: "w1", section: "casas", order: 0, updatedAt: "",
  title: "Casa Karasoy — As Filhas da Estrela",
  body: "> **Lema:** \"Não guardamos um tesouro.\"\n> **Sede:** Ordu-Yildiz, cidade móvel.\n\nConfederação de cavalaria das Planícies da Estrela.",
};

// Trecho real de 10_RELACOES_RIVALIDADES_E_FERIDAS_HISTORICAS.md
const RELATIONS = `# Karasoy e Auremont

Auremont entende a terra por meio de títulos, cercas e produtividade. Karasoy entende as Planícies da Estrela por rotas sazonais e memória oral. A ferida mais conhecida é a Marcha dos Cascos Vazios, quando proprietários dos Campos Dourados cercaram uma rota durante uma seca e cavalos e cavaleiras morreram tentando alcançar água.

# Khazdrun e Ferrumor

Khazdrun e Ferrumor são rivais porque realizam funções semelhantes com filosofias opostas.`;

describe("HOUSE_REPLY_SYSTEM_PROMPT", () => {
  it("manda escrever na voz da Casa, não como narrador", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/NA VOZ da Casa destinatária/);
  });

  it("diz que cordialidade não é o padrão quando há mágoa", () => {
    // Sem isto toda Casa responde igual e a diplomacia perde o sentido.
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/cordial não é o padrão/);
  });

  it("proíbe insinuar que existe segredo ao não saber algo", () => {
    // Uma esquiva suspeita confirma o segredo tão bem quanto revelá-lo.
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/sem insinuar que existe algo escondido/);
  });

  it("permite blefe e recusa, que são jogo político e não contradição", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/blefar/);
  });
});

describe("relationsBetween", () => {
  it("encontra a ferida histórica entre as duas Casas citadas", () => {
    const r = relationsBetween(RELATIONS, "Casa Karasoy", "Casa Auremont");
    expect(r.join(" ")).toMatch(/Marcha dos Cascos Vazios/);
  });

  it("traz a seção inteira, não só o parágrafo que nomeia as duas", () => {
    // O parágrafo que explica o Tempo sem Nomes cita "Mandíbula de Osso" e
    // "dinastias élficas", mas não "Solarion" — casando por parágrafo, a
    // relação mais carregada do cânone ficava de fora.
    const doc = `# Mandíbula de Osso, Solarion e o Tempo sem Nomes\n\nDurante gerações, os ancestrais do Clã Mandíbula de Osso foram escravizados por antigas dinastias élficas do Deserto de Sahr. Entre os orcs, esse período é chamado de Tempo sem Nomes.`;
    const r = relationsBetween(doc, "Clã Mandíbula de Osso", "Solarion");
    expect(r.join(" ")).toMatch(/escravizados/);
  });

  it("descarta seção panorâmica que cita meia dúzia de Casas", () => {
    // "Nenhuma Casa vota apenas sobre a idade de Alic..." casa com qualquer par
    // e não diz nada sobre este.
    const doc = `# Consequência para a coroação\n\nNenhuma Casa vota apenas sobre a idade de Alic. Vargen pensa em promessas, Auremont em grãos, Casa do Ouro em contratos, Khazdrun em autonomia, Solarion em tradição, Karasoy em fronteiras, Euralune em justiça.`;
    expect(relationsBetween(doc, "Casa Karasoy", "Solarion")).toEqual([]);
  });

  it("não traz a rivalidade de outras Casas", () => {
    const r = relationsBetween(RELATIONS, "Casa Karasoy", "Casa Auremont");
    expect(r.join(" ")).not.toMatch(/Ferrumor/);
  });

  it("devolve vazio quando não há história registrada entre elas", () => {
    expect(relationsBetween(RELATIONS, "Casa Karasoy", "Casa Drakorys")).toEqual([]);
  });
});

describe("buildHouseReplyUser", () => {
  const base = {
    toHouseName: "Casa Karasoy",
    fromHouseName: "Casa Auremont",
    fromHouseKey: "casa-auremont",
    houseEntry: karasoy,
    character: null,
    relations: ["A ferida mais conhecida é a Marcha dos Cascos Vazios."],
    publicEvent: "O Rei ordena que cada Casa envie tropas a Asterhall.",
    chronicle: "## Turno 2\nAsterhall foi atacada durante a votação.\nO que se seguiu: a Asteria afundou na Curva dos Salgueiros.",
    persona: null as never,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Propomos uma aliança." }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  it("dá à Casa a sua própria identidade e a carta recebida", () => {
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/Ordu-Yildiz/);
    expect(u).toMatch(/Propomos uma aliança/);
  });

  it("coloca a mágoa histórica no contexto", () => {
    expect(buildHouseReplyUser(base)).toMatch(/Cascos Vazios/);
  });

  it("diz explicitamente quando não há história entre as Casas", () => {
    // O silêncio seria ambíguo: a IA poderia inventar uma rivalidade.
    expect(buildHouseReplyUser({ ...base, relations: [] })).toMatch(/não tem mágoa nem aliança registrada/);
  });

  it("inclui o que está acontecendo agora", () => {
    expect(buildHouseReplyUser(base)).toMatch(/envie tropas a Asterhall/);
  });

  it("inclui a crônica dos turnos anteriores", () => {
    // Sem ela a Casa responde como quem acabou de acordar: sabe do chamado de
    // tropas, mas não que Asterhall foi atacada nem que a Asteria afundou.
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/você viveu isto/);
    expect(u).toMatch(/Asteria afundou/);
  });

  it("funciona sem verbete e sem evento", () => {
    const u = buildHouseReplyUser({ ...base, houseEntry: null, publicEvent: "", chronicle: "" });
    expect(u).toMatch(/Propomos uma aliança/);
  });

  // Fase 2: a situação da própria Casa entra como conhecimento interno, com o
  // sigilo de que a Casa decide o quanto revela — não como crônica pública.
  it("injeta a situação da Casa como conhecimento interno", () => {
    const u = buildHouseReplyUser({ ...base, houseSituation: "Vocês romperam com a Coroa em segredo." });
    expect(u).toMatch(/SUA Casa está fazendo/);
    expect(u).toMatch(/romperam com a Coroa/);
    expect(u).toMatch(/você decide o quanto revela/);
  });

  it("não fala da situação interna quando não há nenhuma", () => {
    expect(buildHouseReplyUser(base)).not.toMatch(/SUA Casa está fazendo/);
  });

});

describe("postura política na carta", () => {
  const orcPersona = personaFor("cla-mandibula-de-osso")!;
  const base = {
    toHouseName: "Clã Mandíbula de Osso",
    houseEntry: null,
    character: null,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: orcPersona,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Proponho uma aliança." }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  it("sempre traz a postura com a Coroa e os interesses", () => {
    const u = buildHouseReplyUser({ ...base, fromHouseName: "Casa Vargen", fromHouseKey: "casa-vargen" });
    expect(u).toMatch(/postura com a Coroa/);
    expect(u).toMatch(/Interesses e favores agora|interesses e favores agora/i);
  });

  // O ponto todo do recorte: a desconfiança dos orcs com Solarion não pode
  // vazar para uma carta de Khazdrun, em quem eles confiam.
  it("injeta a desconfiança só quando é a Casa desconfiada que escreve", () => {
    const deSolarion = buildHouseReplyUser({ ...base, fromHouseName: "Casa Solarion", fromHouseKey: "casa-solarion" });
    expect(deSolarion).toMatch(/DESCONFIA de Casa Solarion/);

    const deKhazdrun = buildHouseReplyUser({ ...base, fromHouseName: "Casa Khazdrun", fromHouseKey: "casa-khazdrun" });
    expect(deKhazdrun).not.toMatch(/DESCONFIA/);
    expect(deKhazdrun).toMatch(/CONFIA em Casa Khazdrun/);
  });

  it("não inventa confiança nem desconfiança para uma Casa sem registro", () => {
    const u = buildHouseReplyUser({ ...base, fromHouseName: "Casa Rimerberg", fromHouseKey: "casa-rimerberg" });
    expect(u).not.toMatch(/DESCONFIA/);
    expect(u).not.toMatch(/CONFIA em/);
  });
});

describe("carta a um indivíduo", () => {
  const marifh = {
    name: "All Marifh",
    role: "Conselheiro",
    description: "Estudioso quase inteiramente dedicado à leitura do céu.",
    wants: "Provas antes de qualquer aliança.",
    hides: "Duvida em segredo da versão oficial de Solarion sobre o passado.",
  };
  const base = {
    toHouseName: "Casa Solarion",
    fromHouseName: "Casa Vargen",
    fromHouseKey: "casa-vargen",
    houseEntry: null,
    character: marifh,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: personaFor("casa-solarion")!,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Escrevo a você diretamente." }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  it("encarna a pessoa, com o que ela quer e o que esconde", () => {
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/Você é All Marifh/);
    expect(u).toMatch(/Provas antes de qualquer aliança/);
    expect(u).toMatch(/Duvida em segredo/);
    expect(u).toMatch(/pode divergir da linha oficial da Casa/);
  });

  // Living Characters: com estado vivo, a carta reconstrói a relação com quem
  // escreve e as memórias — não responde só do último texto.
  it("reconstrói a partir do estado vivo quando ele existe", () => {
    const u = buildHouseReplyUser({
      ...base,
      npcDynamic: {
        affiliation: "casa-solarion",
        id: "all-marifh",
        mood: "cauteloso",
        objective: "confirmar se Vargen é confiável",
        concerns: "",
        loyalty: "",
        location: "",
        relations: { "casa-vargen": { trust: 30, respect: 55, fear: 20, resentment: 40, obligation: 5, summary: "Gente de fronteira, direta demais." } },
        memory: [{ turnNumber: 3, description: "Vargen ignorou um alerta da Ordem.", impact: "-confiança" }],
        updatedAt: "",
      },
    });
    expect(u).toMatch(/Como você está agora/);
    expect(u).toMatch(/direta demais/);
    expect(u).toMatch(/Vargen ignorou um alerta/);
  });

  it("sem estado vivo, não inventa camada viva", () => {
    expect(buildHouseReplyUser(base)).not.toMatch(/Como você está agora/);
  });

  // O indivíduo é da Casa: herda a postura política dela, mas não a identidade
  // do líder — quem responde é ele.
  it("mantém a postura política da Casa mas não a persona do líder", () => {
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/postura com a Coroa/);
    expect(u).not.toMatch(/Você é Faraó Gloriandur/);
  });

  it("sem indivíduo, a chancelaria responde como antes", () => {
    const u = buildHouseReplyUser({ ...base, character: null });
    expect(u).toMatch(/Você é Faraó Gloriandur/);
    expect(u).not.toMatch(/Você é All Marifh/);
  });
});

describe("carta a um NPC do Codex", () => {
  const arquimago = {
    id: "maelor-vespera",
    name: "Maelor Véspera",
    role: "O Trino da Ordem dos Três",
    tier: "MAJOR" as const,
    affiliation: "ordem-dos-tres",
    location: "Vale da Coroa",
    personality: "Metódico, calmo, reservado.",
    speechStyle: "Frases curtas, vocabulário preciso.",
    values: "Ordem, conhecimento, estabilidade.",
    fears: "Magia fora de controle.",
    ambitions: "Manter a Ordem unida.",
    redLines: "Não aceita ameaças à Ordem.",
    secrets: "As três vozes discordam entre si.",
    roleplayGuidance: "Raramente demonstra surpresa.",
  };
  const base = {
    toHouseName: "Ordem dos Três",
    fromHouseName: "Casa Solarion",
    fromHouseKey: "casa-solarion",
    houseEntry: null,
    character: null,
    codexIdentity: arquimago,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: null as never,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "A Ordem aceitaria estudiosos de Solarion?" }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
  };

  it("encarna o NPC pela ficha do Codex, com voz e linhas vermelhas", () => {
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/Você é Maelor Véspera/);
    expect(u).toMatch(/vocabulário preciso/);
    expect(u).toMatch(/Não aceita ameaças à Ordem/);
    expect(u).toMatch(/na sua voz — não como a chancelaria/);
  });

  it("protege o segredo do NPC, mandando nunca revelá-lo", () => {
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/NUNCA revela numa carta: As três vozes/);
  });

  it("reconstrói o estado vivo do NPC de organização, como para qualquer um", () => {
    const u = buildHouseReplyUser({
      ...base,
      npcDynamic: {
        affiliation: "ordem-dos-tres", id: "maelor-vespera", mood: "preocupado", objective: "medir a ameaça de Alic",
        concerns: "", loyalty: "", location: "", relations: { "casa-solarion": { trust: 72, respect: 81, fear: 12, resentment: 8, obligation: 20, summary: "Casa sofisticada." } },
        memory: [{ turnNumber: 3, description: "Solarion ajudou a Ordem.", impact: "+confiança" }], updatedAt: "",
      },
    });
    expect(u).toMatch(/Como você está agora/);
    expect(u).toMatch(/Casa sofisticada/);
  });
});

describe("parseReply", () => {
  it("tira aspas que o modelo às vezes coloca em volta da carta", () => {
    expect(parseReply('"Não aceitamos."').text).toBe("Não aceitamos.");
  });

  it("trata resposta vazia", () => {
    expect(parseReply("").text).toBe("");
  });
});

describe("memória entre turnos", () => {
  const base = {
    toHouseName: "Casa Karasoy", fromHouseName: "Solarion", fromHouseKey: "casa-solarion", houseEntry: null,
    relations: [], publicEvent: "", chronicle: "", persona: null as never, leaderDied: false,
    character: null,
    priorLetters: [
      { turnNumber: 2, author: "PLAYER" as const, body: "Ofereço grãos pela passagem." },
      { turnNumber: 2, author: "AI" as const, body: "Aceitamos, mas queremos escolta." },
    ],
    thread: [{ author: "PLAYER" as const, body: "E quanto ao chamado do Rei?" }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  it("lembra o que foi dito em turnos passados", () => {
    // Sem isto cada turno recomeça do zero e a Casa responde como quem nunca
    // falou com você — que é o oposto de correspondência.
    const u = buildHouseReplyUser(base);
    expect(u).toMatch(/você lembra disto/);
    expect(u).toMatch(/Ofereço grãos pela passagem/);
    expect(u).toMatch(/Turno 2/);
  });

  it("separa a memória da conversa do turno corrente", () => {
    const u = buildHouseReplyUser(base);
    expect(u.indexOf("você lembra disto")).toBeLessThan(u.indexOf("Correspondência deste turno"));
  });

  it("omite a seção de memória quando não há passado", () => {
    expect(buildHouseReplyUser({ ...base, priorLetters: [] })).not.toMatch(/você lembra disto/);
  });
});

describe("persona do líder", () => {
  const persona = {
    leaderName: "Lorde Thrain Khazdrun", title: "Senhor de Khar-Durak",
    temperament: "Cauteloso e teimoso; acha que pedra não suporta duas fundações.",
    speechStyle: "Curto, sem floreio, cita contratos.",
    wants: "Autonomia sobre as minas.", refuses: "Comando externo sobre Khar-Durak.",
    crownStance: "Coopera, mas teme controle permanente.",
    interests: "Docas e autonomia.",
  };
  const base = {
    toHouseName: "Casa Khazdrun", fromHouseName: "Solarion", fromHouseKey: "casa-solarion", houseEntry: null,
    character: null,
    relations: [], publicEvent: "", chronicle: "", priorLetters: [],
    thread: [{ author: "PLAYER" as const, body: "Aliança?" }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  it("faz a Casa escrever como uma pessoa, não como instituição", () => {
    const u = buildHouseReplyUser({ ...base, persona, leaderDied: false });
    expect(u).toMatch(/Você é Lorde Thrain Khazdrun/);
    expect(u).toMatch(/pedra não suporta duas fundações/);
    expect(u).toMatch(/O que você nunca aceita/);
  });

  it("nunca assina com o nome de um líder morto", () => {
    // Aylin Karasoy afundou com a Asteria no turno 3. Uma carta assinada por
    // ela destruiria a ilusão na primeira linha.
    const u = buildHouseReplyUser({ ...base, persona, leaderDied: true });
    expect(u).toMatch(/MORREU/);
    expect(u).toMatch(/Nunca assine com o nome do morto/);
    expect(u).not.toMatch(/Você é Lorde Thrain Khazdrun,/);
  });

  it("mantém o temperamento da Casa mesmo depois da morte do líder", () => {
    const u = buildHouseReplyUser({ ...base, persona, leaderDied: true });
    expect(u).toMatch(/pedra não suporta duas fundações/);
    expect(u).toMatch(/luto/);
  });

  it("funciona sem persona registrada", () => {
    expect(buildHouseReplyUser({ ...base, persona: null, leaderDied: false })).toMatch(/Aliança\?/);
  });

  // Sem saber do que carece, a Casa negocia no vazio: aceita o que não precisa
  // e recusa o que lhe salvaria o inverno.
  it("diz à Casa do que ela vive e do que ela carece", () => {
    const u = buildHouseReplyUser({
      ...base,
      persona: null,
      leaderDied: false,
      houseProfile: {
        wealth: "Ferro, obra e frete.",
        resources: "Ferro em abundância. Falta alimento de lavoura.",
        soldiers: "Infantaria pesada e fuzileiros de doca.",
        control: "Pela estrutura social: o Conselho de Pedra.",
      },
    });
    expect(u).toMatch(/Falta alimento de lavoura/);
    expect(u).toMatch(/cobrando pelo que só você oferece/);
  });
});

describe("relação entre Casas no prompt", () => {
  const base = {
    toHouseName: "Casa Karasoy",
    fromHouseName: "Casa Auremont",
    fromHouseKey: "casa-auremont",
    houseEntry: karasoy,
    character: null,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: null as never,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Propomos um acordo de grão." }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  const relacao = (over: Partial<HouseRelation> = {}): HouseRelation => ({
    ...emptyHouseRelation("casa-khazdrun", "casa-solarion"),
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...over,
  });

  it("não entra quando o Mestre não definiu o par", () => {
    const out = buildHouseReplyUser({ ...base, houseRelation: null });
    expect(out).not.toContain("Como você vê");
  });

  it("vira instrução de conduta, não só rótulo", () => {
    const out = buildHouseReplyUser({ ...base, houseRelation: relacao({ amizade: 5, comercio: 5, favores: 5 }) });
    expect(out).toContain("amizade ruim");
    expect(out).toContain("frieza formal");
    expect(out).toContain("o preço é alto");
    expect(out).toContain("recuse pedido de favor");
  });

  it("muda a conduta quando a relação é boa", () => {
    const out = buildHouseReplyUser({ ...base, houseRelation: relacao({ amizade: 95, comercio: 95, favores: 95 }) });
    expect(out).toContain("Você confia neles");
    expect(out).toContain("sem exigir pagamento imediato");
    expect(out).not.toContain("frieza formal");
  });

  it("leva a nota do Mestre e proíbe recitar os níveis na carta", () => {
    const out = buildHouseReplyUser({ ...base, houseRelation: relacao({ note: "Traíram na votação do Conselho." }) });
    expect(out).toContain("Traíram na votação do Conselho.");
    expect(out).toContain("não cite estes níveis");
  });
});

describe("os dois lados da mesa", () => {
  const base = {
    toHouseName: "Casa Karasoy",
    fromHouseName: "Casa Auremont",
    fromHouseKey: "casa-auremont",
    houseEntry: karasoy,
    character: null,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: null as never,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Propomos um acordo." }],
    houseSituation: "",
    houseProfile: null,
    npcDynamic: null,
    worldFacts: [],
    biography: null,
    houseForce: null,
    writerForce: null,
    houseRelation: null,
    writerProfile: null,
    toHouseKey: "casa-karasoy",
    codexIdentity: null,
  };

  // A queixa que originou isto: os Ulgar responderam a Khazdrun com parágrafos
  // sobre confiança e autonomia, sem nunca notar que eles têm madeira e não têm
  // ferro, e que Khazdrun tem ferro e não planta trigo. A Casa respondia cega.
  it("entrega o perfil de quem escreveu, não só o de quem responde", () => {
    const ulgar = houseProfileFor("grande-casa-ulgar")!;
    const khazdrun = houseProfileFor("casa-khazdrun")!;
    const out = buildHouseReplyUser({
      ...base,
      toHouseName: "Grande Casa Ulgar",
      fromHouseName: "Casa Khazdrun",
      houseProfile: ulgar,
      writerProfile: khazdrun,
    });
    expect(out).toContain(ulgar.resources);
    expect(out).toContain(khazdrun.resources);
    expect(out).toContain("O que se sabe de Casa Khazdrun");
  });

  it("manda comparar as duas listas e propor onde a falta encontra a sobra", () => {
    const out = buildHouseReplyUser({ ...base, writerProfile: houseProfileFor("casa-khazdrun") });
    // A conta em três passos é o que impede a carta de pedir trigo a quem
    // declara não plantar trigo — foi o erro do modelo antes dela existir.
    expect(out).toContain("O que EU tenho de sobra e eles NÃO têm");
    expect(out).toContain("Nunca peça o que a outra Casa também declara faltar");
    expect(out).toMatch(/quantidade, prazo e contrapartida/);
  });

  it("omite o bloco quando a sede de quem escreve não tem perfil", () => {
    const out = buildHouseReplyUser({ ...base, writerProfile: null });
    expect(out).not.toContain("O que EU tenho de sobra");
  });
});

describe("exigência de movimento concreto", () => {
  it("proíbe a carta que só concorda em princípio", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/movimento concreto/);
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/carta vazia/);
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/Fale de coisas, não de conceitos/);
  });
});

describe("acordo que sai da carta", () => {
  // CampaignFact existia desde o começo, com tipo, partes e origem auditável,
  // e nada nunca criou um: aliança e acordo viviam só dentro do texto.
  it("extrai o acordo do JSON junto com a carta", () => {
    const r = parseReply(JSON.stringify({
      carta: "Aceitamos. O posto fica em Raven's Cross.",
      acordo: { tipo: "ACORDO", resumo: "Rota comercial por Raven's Cross: vigias por grão, sinais por sal." },
    }));
    expect(r.text).toMatch(/Raven's Cross/);
    expect(r.acordo).toEqual({ tipo: "ACORDO", resumo: "Rota comercial por Raven's Cross: vigias por grão, sinais por sal." });
  });

  it("não inventa acordo quando a conversa apenas seguiu", () => {
    expect(parseReply(JSON.stringify({ carta: "Vamos pensar.", acordo: null }).toString()).acordo).toBeNull();
  });

  it("recusa tipo que não existe no registro", () => {
    const r = parseReply(JSON.stringify({ carta: "Uma carta.", acordo: { tipo: "FOFOCA", resumo: "x" } }));
    expect(r.acordo).toBeNull();
    expect(r.text).toBe("Uma carta.");
  });

  // Perder a carta inteira porque o modelo devolveu prosa seria trocar uma
  // resposta boa por nenhuma.
  it("aceita texto puro, como antes", () => {
    const r = parseReply("Não aceitamos, e o motivo é o grão.");
    expect(r.text).toBe("Não aceitamos, e o motivo é o grão.");
    expect(r.acordo).toBeNull();
  });
});

describe("o mapa entra na negociação", () => {
  const base = {
    toHouseName: "Casa Euralune", fromHouseName: "Casa Solarion", fromHouseKey: "casa-solarion",
    toHouseKey: "casa-euralune", houseEntry: null, character: null, relations: [] as string[],
    publicEvent: "", chronicle: "", persona: null as never, leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Proposta." }], houseSituation: "",
    houseProfile: null, npcDynamic: null, houseRelation: null, writerProfile: null, codexIdentity: null,
    biography: null, houseForce: null, writerForce: null, worldFacts: [],
  };

  // Euralune pediu "chão de ninguém" e ninguém soube dizer onde isso ficaria:
  // a IA sabia o que cada Casa tem e não sabia onde as Casas ficam.
  it("dá as distâncias e nomeia candidatos a terreno neutro", () => {
    const out = buildHouseReplyUser({
      ...base,
      toHouseName: "Casa Euralune",
      fromHouseName: "Casa Solarion",
      fromHouseKey: "casa-solarion",
      toHouseKey: "casa-euralune",
    });
    expect(out).toMatch(/346 km/);
    expect(out).toMatch(/Chão de ninguém/);
    expect(out).toMatch(/Raven's Cross/);
    expect(out).toMatch(/Nomeie/);
  });
});

describe("as regras de voz", () => {
  // Ficam no system prompt de propósito: ali são prefixo cacheado, e valem para
  // as dezenas de cartas de um turno pelo preço de uma.
  it("proíbe os quatro tiques que apareciam em quase toda carta", () => {
    for (const prompt of [HOUSE_REPLY_SYSTEM_PROMPT, OUTREACH_SYSTEM_PROMPT]) {
      expect(prompt).toContain("Escrevo porque");     // a abertura fórmula
      expect(prompt).toContain("aforismo");            // o fecho de oráculo
      expect(prompt).toContain("antítese");            // "Não X. Só Y."
      expect(prompt).toContain("Três substantivos");   // a lista de três
      expect(prompt).toContain("'vós'");               // o arcaísmo universal
    }
  });

  it("deixa o arcaísmo como exceção que a persona precisa pedir", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/só escreva em 'vós'.*se o SEU estilo disser/i);
  });
});

/** O mínimo para montar um prompt de carta nos testes abaixo. */
const ctxBase = {
  toHouseName: "Casa Karasoy",
  fromHouseName: "Casa Auremont",
  fromHouseKey: "casa-auremont",
  toHouseKey: "casa-karasoy",
  houseEntry: null,
  character: null,
  codexIdentity: null,
  relations: [] as string[],
  publicEvent: "",
  chronicle: "",
  persona: null as never,
  leaderDied: false,
  priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
  thread: [{ author: "PLAYER" as const, body: "Propomos uma aliança." }],
  houseSituation: "",
  houseProfile: null,
  writerProfile: null,
  npcDynamic: null,
  houseRelation: null,
  worldFacts: [],
  biography: null,
  houseForce: null,
  writerForce: null,
};

describe("a vida de quem responde", () => {
  const BIO = "Orven Geada veio de uma família de caçadores das aldeias externas, acostumada a trocar peles por sal-gema.";

  // 122 KB de biografia autorada existiam desde sempre e só a página de
  // personagem as lia. A IA escrevia a Dama Elara a partir de três linhas de
  // speechStyle enquanto a biografia dela dizia com quem ela se dá e com quem
  // não se dá.
  it("põe a biografia no prompt, depois de quem a pessoa é", () => {
    const out = buildHouseReplyUser({ ...ctxBase, biography: BIO });
    expect(out).toContain(BIO);
    expect(out).toContain("A sua vida até aqui");
  });

  it("cala a biografia quando o líder canônico morreu", () => {
    // O bloco de sucessão já diz que ele morreu; a biografia fala dele no
    // presente e contradiria a própria carta.
    const out = buildHouseReplyUser({ ...ctxBase, biography: BIO, leaderDied: true });
    expect(out).not.toContain(BIO);
  });

  it("trunca a biografia longa em vez de mandar tudo", () => {
    const gigante = "a".repeat(5000);
    const out = buildHouseReplyUser({ ...ctxBase, biography: gigante });
    expect(out).not.toContain("a".repeat(1900));
    expect(out).toContain("a".repeat(1800));
  });

  it("não escreve bloco nenhum quando não há biografia", () => {
    expect(buildHouseReplyUser({ ...ctxBase, biography: null })).not.toContain("A sua vida até aqui");
  });
});

describe("quanta gente a Casa põe em campo", () => {
  const KARASOY = { sustainableTroops: 3000, emergencyTroops: 7000 };

  // Selma ofereceu "300 cavaleiras Ak-Boran" sem nada no prompt dizendo se
  // isso é muito ou pouco para Karasoy. Saiu plausível por sorte.
  it("dá o número das duas Casas", () => {
    const out = buildHouseReplyUser({
      ...ctxBase,
      houseProfile: houseProfileFor("casa-karasoy"),
      writerProfile: houseProfileFor("casa-auremont"),
      houseForce: KARASOY,
      writerForce: { sustainableTroops: 4000, emergencyTroops: 9000 },
    });
    expect(out).toContain("3000");
    expect(out).toContain("7000");
    expect(out).toContain("4000");
  });

  it("proíbe prometer mais do que a mobilização de emergência", () => {
    const out = buildHouseReplyUser({ ...ctxBase, houseProfile: houseProfileFor("casa-karasoy"), houseForce: KARASOY });
    expect(out).toMatch(/Nunca prometa mais do que a mobilização de emergência/i);
  });

  it("fica calado para sede sem número no cânone", () => {
    const out = buildHouseReplyUser({ ...ctxBase, houseProfile: houseProfileFor("casa-karasoy"), houseForce: null });
    expect(out).not.toMatch(/mobilização de emergência/i);
  });
});

describe("a biografia do NPC do Codex", () => {
  const elara = fullCodex().find((n) => n.id === "dama-elara-voss")!;

  it("entra quando o contexto a manda", () => {
    const out = buildHouseReplyUser({ ...ctxBase, codexIdentity: elara, biography: "Uma vida inteira em Asterhall." });
    expect(out).toContain("Uma vida inteira em Asterhall.");
  });

  // A ficha do Codex carrega `biography`, e ler dali criava uma segunda fonte:
  // o bloco entrava mesmo quando quem montou o contexto decidiu não mandar.
  it("não se serve sozinha da ficha quando o contexto disse não", () => {
    const out = buildHouseReplyUser({ ...ctxBase, codexIdentity: elara, biography: null });
    expect(out).not.toContain("A sua vida até aqui");
    expect(elara.biography).toBeTruthy();
  });
});

describe("o registro da campanha na carta", () => {
  const anoes: WorldFact = {
    id: "f-anoes", campaignId: "c", turnNumber: 6, kind: "MILITAR", parties: ["casa-khazdrun"], visibility: "PUBLICO",
    summary: "Khazdrun enviou cem homens e um comboio à Marcha do Norte.",
    quote: "Khazdrun mandou cem.", status: "ATIVO", supersededBy: null, createdAt: "2026-08-29T00:00:00Z",
  };
  const decreto: WorldFact = { ...anoes, id: "f-decreto", kind: "DECRETO", parties: [], turnNumber: 7,
    summary: "Tributo agravado sobre as Casas que não enviaram tropas." };

  // O caso que motivou tudo: a afirmação errada sobre os anões atravessou três
  // turnos porque só existia em prosa. Agora ela é uma linha que a carta lê.
  it("entrega o fato da Casa envolvida", () => {
    const out = buildHouseReplyUser({ ...ctxBase, toHouseKey: "casa-khazdrun", worldFacts: [anoes] });
    expect(out).toContain("Khazdrun enviou cem homens");
    expect(out).toContain("Turno 6");
  });

  it("entrega o decreto do reino a qualquer conversa", () => {
    const out = buildHouseReplyUser({ ...ctxBase, worldFacts: [decreto] });
    expect(out).toContain("Tributo agravado");
  });

  it("não vaza fato de terceiros para uma conversa que não os envolve", () => {
    const out = buildHouseReplyUser({ ...ctxBase, worldFacts: [anoes] });
    expect(out).not.toContain("Khazdrun enviou cem homens");
  });

  it("não escreve cabeçalho quando não há fato nenhum", () => {
    expect(buildHouseReplyUser({ ...ctxBase, worldFacts: [] })).not.toContain("O QUE JÁ ACONTECEU");
  });

  it("manda tratar o registro como assentado, não como boato", () => {
    const out = buildHouseReplyUser({ ...ctxBase, worldFacts: [decreto] });
    expect(out).toMatch(/nunca contradiga/i);
  });
});

describe("a escala do que se negocia", () => {
  // Uma carta ofereceu "8.000 sacas de trigo" por "300 toneladas de ferro", em
  // dois comboios — quase quinhentas carroças de boi cada, numa estrada de
  // inverno. O modelo não ignora a Idade Média; ele não tinha com o que comparar.
  it("proíbe tonelada e manda usar as medidas do mundo", () => {
    for (const prompt of [HOUSE_REPLY_SYSTEM_PROMPT, OUTREACH_SYSTEM_PROMPT]) {
      expect(prompt).toMatch(/NUNCA escreva 'toneladas'/i);
      expect(prompt).toMatch(/lingotes e barras/i);
    }
  });

  // A defesa que de fato funciona: quem precisa escrever "seiscentas carroças"
  // percebe sozinho que errou.
  it("exige dizer em quantas carroças a entrega viaja", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/DIGA COMO ELA VIAJA/i);
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/se a conta der em centenas de carroças/i);
  });

  it("dá o teto de uma entrega normal", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/dez a trinta carroças/i);
  });

  it("ancora a capacidade de mula, carroça e barcaça", () => {
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/mula ou cavalo de carga/i);
    expect(HOUSE_REPLY_SYSTEM_PROMPT).toMatch(/barcaça de rio/i);
  });
});
