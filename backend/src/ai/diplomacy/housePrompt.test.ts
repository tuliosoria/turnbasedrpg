import { describe, it, expect } from "vitest";
import { personaFor, type WikiEntry } from "@ravenloft/content";
import { HOUSE_REPLY_SYSTEM_PROMPT, buildHouseReplyUser, relationsBetween, parseReply } from "./housePrompt";

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
    relations: ["A ferida mais conhecida é a Marcha dos Cascos Vazios."],
    publicEvent: "O Rei ordena que cada Casa envie tropas a Asterhall.",
    chronicle: "## Turno 2\nAsterhall foi atacada durante a votação.\nO que se seguiu: a Asteria afundou na Curva dos Salgueiros.",
    persona: null as never,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Propomos uma aliança." }],
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
});

describe("postura política na carta", () => {
  const orcPersona = personaFor("cla-mandibula-de-osso")!;
  const base = {
    toHouseName: "Clã Mandíbula de Osso",
    houseEntry: null,
    relations: [] as string[],
    publicEvent: "",
    chronicle: "",
    persona: orcPersona,
    leaderDied: false,
    priorLetters: [] as { turnNumber: number; author: "PLAYER" | "AI"; body: string }[],
    thread: [{ author: "PLAYER" as const, body: "Proponho uma aliança." }],
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

describe("parseReply", () => {
  it("tira aspas que o modelo às vezes coloca em volta da carta", () => {
    expect(parseReply('"Não aceitamos."')).toBe("Não aceitamos.");
  });

  it("trata resposta vazia", () => {
    expect(parseReply("")).toBe("");
  });
});

describe("memória entre turnos", () => {
  const base = {
    toHouseName: "Casa Karasoy", fromHouseName: "Solarion", fromHouseKey: "casa-solarion", houseEntry: null,
    relations: [], publicEvent: "", chronicle: "", persona: null as never, leaderDied: false,
    priorLetters: [
      { turnNumber: 2, author: "PLAYER" as const, body: "Ofereço grãos pela passagem." },
      { turnNumber: 2, author: "AI" as const, body: "Aceitamos, mas queremos escolta." },
    ],
    thread: [{ author: "PLAYER" as const, body: "E quanto ao chamado do Rei?" }],
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
  };
  const base = {
    toHouseName: "Casa Khazdrun", fromHouseName: "Solarion", houseEntry: null,
    relations: [], publicEvent: "", chronicle: "", priorLetters: [],
    thread: [{ author: "PLAYER" as const, body: "Aliança?" }],
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
});
