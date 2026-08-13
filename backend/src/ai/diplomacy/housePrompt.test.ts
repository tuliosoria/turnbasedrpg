import { describe, it, expect } from "vitest";
import type { WikiEntry } from "@ravenloft/content";
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
    houseEntry: karasoy,
    relations: ["A ferida mais conhecida é a Marcha dos Cascos Vazios."],
    publicEvent: "O Rei ordena que cada Casa envie tropas a Asterhall.",
    chronicle: "## Turno 2\nAsterhall foi atacada durante a votação.\nO que se seguiu: a Asteria afundou na Curva dos Salgueiros.",
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

describe("parseReply", () => {
  it("tira aspas que o modelo às vezes coloca em volta da carta", () => {
    expect(parseReply('"Não aceitamos."')).toBe("Não aceitamos.");
  });

  it("trata resposta vazia", () => {
    expect(parseReply("")).toBe("");
  });
});
