import { describe, it, expect } from "vitest";
import {
  privadoVazio, privadoPedeDecisao, numeroContradito, repeticaoLiteral,
  projetoFalhadoNaoContado, ordemSemEco, nomeSemRegistro, compromissoSemPrazo,
  CHECKS, severidades, resumir,
} from "./validar-turno.mjs";

const base = {
  turno: 10,
  casa: { houseId: "khazdrun-wxey", name: "Khazdrun" },
  resultado: "Durgan desceu sozinho e Hraki falou. O trabuco não existe mais.",
  privado: "Os leitores de runas ficaram, e a contagem fechou.",
  ordens: [{ numero: 1, texto: "Audiência com o prisioneiro Hraki" }],
  textosAnteriores: [{ turno: 6, texto: "O ourives pesou cada peça." }],
  projetos: [], trilha: [], pactos: [], registrados: new Set(), cruzamentos: 0,
};

describe("privado-vazio", () => {
  it("dispara quando a Casa não recebeu privado — foi o turno 9", () => {
    expect(privadoVazio({ ...base, privado: "" }).length).toBe(1);
  });
  it("cala quando há privado", () => {
    expect(privadoVazio(base)).toEqual([]);
  });
});

describe("privado-pede-decisao", () => {
  it("dispara em privado que termina em pergunta", () => {
    expect(privadoPedeDecisao({ ...base, privado: "O cofre está pronto.\n\nQual será a resposta de sua Casa?" }).length).toBe(1);
  });
  it("dispara em fórmula de espera", () => {
    expect(privadoPedeDecisao({ ...base, privado: "Orin subiu com uma folha.\n\nEle espera a vossa palavra." }).length).toBe(1);
  });
  it("cala quando termina em fato", () => {
    expect(privadoPedeDecisao({ ...base, privado: "Khar-Durak guardou as peças por três séculos sem saber." })).toEqual([]);
  });
});

describe("numero-contradito", () => {
  const trilha10 = [{ motivo: "resolução do turno 10", antes: { recursos: 2 }, depois: { recursos: 5 } }];
  it("cala quando o texto bate com a trilha", () => {
    const ctx = { ...base, resultado: "Os recursos subiram de dois para cinco.", trilha: trilha10 };
    expect(numeroContradito(ctx)).toEqual([]);
  });
  it("dispara quando o texto contradiz a trilha", () => {
    const ctx = { ...base, resultado: "Os recursos subiram de dois para quatro.", trilha: trilha10 };
    expect(numeroContradito(ctx).length).toBe(1);
  });
  it("cala quando não há trilha para o atributo — isso é aviso, não erro", () => {
    const ctx = { ...base, resultado: "A riqueza subiu de dois para três.", trilha: trilha10 };
    expect(numeroContradito(ctx)).toEqual([]);
  });
});

describe("repeticao-literal", () => {
  const velho = "Eram novas. Mesmo cunho, mesmo ano, cunho da Casa do Ouro. Moeda que não tinha passado por mão nenhuma.";
  it("pega o trecho recontado de um turno anterior", () => {
    const ctx = { ...base, resultado: `O tesoureiro disse: ${velho}`, textosAnteriores: [{ turno: 6, texto: velho }] };
    const r = repeticaoLiteral(ctx);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].detalhe).toMatch(/turno 6/);
  });
  it("junta janelas sobrepostas numa achado só, não quatro", () => {
    const longo = "o caderno velho da biblioteca aquele em que um mestre de trezentos anos atras catalogou pecas recolhidas na costa sul";
    const ctx = { ...base, resultado: longo, textosAnteriores: [{ turno: 8, texto: longo }] };
    expect(repeticaoLiteral(ctx).length).toBe(1);
  });

  it("é AVISO, não ERRO: não distingue recontagem preguiçosa de retomada deliberada", () => {
    expect(severidades()["repeticao-literal"]).toBe("AVISO");
  });

  it("não grita por frase curta repetida, como um lema", () => {
    const ctx = { ...base, resultado: "Da Rocha ao Mar.", textosAnteriores: [{ turno: 3, texto: "Da Rocha ao Mar." }] };
    expect(repeticaoLiteral(ctx)).toEqual([]);
  });
});

describe("projeto-falhado-nao-contado", () => {
  const trabuco = { title: "Fortificação da Montanha: Trabuco de Defesa", status: "FAILED", lastProcessedTurnId: 9 };
  it("dispara quando o jogador nunca soube da falha", () => {
    const ctx = { ...base, resultado: "A montanha trabalhou.", privado: "", projetos: [trabuco] };
    expect(projetoFalhadoNaoContado(ctx).length).toBe(1);
  });
  it("cala quando o texto conta", () => {
    const ctx = { ...base, resultado: "A ordem para trancar os moldes do trabuco não encontrou molde nenhum.", projetos: [trabuco] };
    expect(projetoFalhadoNaoContado(ctx)).toEqual([]);
  });
  it("cala para projeto que falhou NESTE turno — o texto do turno é que conta", () => {
    const ctx = { ...base, projetos: [{ ...trabuco, lastProcessedTurnId: 10 }], resultado: "nada" };
    expect(projetoFalhadoNaoContado(ctx)).toEqual([]);
  });
});

describe("ordem-sem-eco", () => {
  it("dispara quando nenhuma palavra da ordem aparece", () => {
    const ctx = { ...base, ordens: [{ numero: 9, texto: "Khazdrun passará a cremar seus mortos com respeito" }] };
    expect(ordemSemEco(ctx).length).toBe(1);
  });
  it("cala quando há eco", () => {
    expect(ordemSemEco(base)).toEqual([]);
  });
  it("é AVISO por padrão, porque já deu falso negativo comprovado", () => {
    expect(severidades()["ordem-sem-eco"]).toBe("AVISO");
  });
});

describe("nome-sem-registro", () => {
  it("aponta nome novo que não existe em registro nenhum", () => {
    const ctx = { ...base, resultado: "O homem se chamava Vell, e o sargento Ordwin ficou no muro.",
      registrados: new Set(["hraki", "durgan"]) };
    const nomes = nomeSemRegistro(ctx).map((f) => f.detalhe).join(" ");
    expect(nomes).toMatch(/Vell/);
  });
  it("cala para nome já registrado", () => {
    const ctx = { ...base, resultado: "Durgan desceu sozinho.", registrados: new Set(["durgan"]) };
    expect(nomeSemRegistro(ctx)).toEqual([]);
  });
});

describe("compromisso-sem-prazo", () => {
  it("aponta compromisso do turno cujo prazo não foi reconhecido", () => {
    const ctx = { ...base, pactos: [{ turnNumber: 10, status: "ATIVO", summary: "Ulgar aceita aliança limitada contra o Vórtice." }] };
    expect(compromissoSemPrazo(ctx).length).toBe(1);
  });
  it("junta todos os compromissos sem prazo num achado por Casa", () => {
    const ctx = { ...base, pactos: [
      { turnNumber: 10, status: "ATIVO", summary: "Ulgar aceita aliança limitada." },
      { turnNumber: 10, status: "ATIVO", summary: "Karasoy promete não tratar como ameaça." },
      { turnNumber: 10, status: "ATIVO", summary: "Garok recusa recuar de Asterhall." },
    ] };
    const r = compromissoSemPrazo(ctx);
    expect(r.length).toBe(1);
    expect(r[0].mensagem).toMatch(/3/);
  });

  it("cala quando o prazo foi reconhecido", () => {
    const ctx = { ...base, pactos: [{ turnNumber: 10, status: "ATIVO", summary: "Prontos a partir do sexto dia." }] };
    expect(compromissoSemPrazo(ctx)).toEqual([]);
  });
});

describe("nome-sem-registro, limpeza", () => {
  it("separa nomes colados pelo conector e confere um por um", () => {
    const ctx = { ...base, resultado: "a sala recebeu Belegue e Ritolun na conta do céu",
      registrados: new Set(["belegue"]) };
    const d = nomeSemRegistro(ctx).map((f) => f.detalhe).join(" ");
    expect(d).toMatch(/Ritolun/);
    expect(d).not.toMatch(/Belegue/);
  });

  it("tira o título antes de conferir", () => {
    const ctx = { ...base, resultado: "responde por eles o Capitão Arven Solkar no pátio",
      registrados: new Set(["arven-solkar"]) };
    expect(nomeSemRegistro(ctx)).toEqual([]);
  });

  it("não trata forma de tratamento como personagem", () => {
    const ctx = { ...base, resultado: "as arcas saíram por aqui, Alteza, e ninguém arrombou porta", registrados: new Set() };
    const d = nomeSemRegistro(ctx).map((f) => f.detalhe).join(" ");
    expect(d).not.toMatch(/Alteza/);
  });
});

describe("compromisso-sem-prazo é NOTA", () => {
  it("informa, não avisa: recusa e prática permanente não têm prazo por natureza", () => {
    expect(severidades()["compromisso-sem-prazo"]).toBe("NOTA");
  });
});

describe("o registro e o portão", () => {
  it("toda checagem tem id e severidade declarada", () => {
    for (const c of CHECKS) {
      expect(c.id).toBeTruthy();
      expect(["ERRO", "AVISO", "NOTA"]).toContain(c.severidade);
      expect(typeof c.fn).toBe("function");
    }
  });

  it("só bloqueia com ERRO não ignorado", () => {
    const achados = [
      { id: "privado-vazio", severidade: "ERRO", mensagem: "x" },
      { id: "ordem-sem-eco", severidade: "AVISO", mensagem: "y" },
    ];
    expect(resumir(achados, new Set()).bloqueia).toBe(true);
    expect(resumir(achados, new Set(["privado-vazio"])).bloqueia).toBe(false);
    expect(resumir([achados[1]], new Set()).bloqueia).toBe(false);
  });

  it("o ignorado continua aparecendo no relatório, marcado", () => {
    const r = resumir([{ id: "privado-vazio", severidade: "ERRO", mensagem: "x" }], new Set(["privado-vazio"]));
    expect(r.ignorados.length).toBe(1);
    expect(r.bloqueia).toBe(false);
  });
});
