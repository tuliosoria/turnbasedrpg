import { describe, expect, it } from "vitest";
import {
  ENERGIA_POR_TURNO,
  PASSO_POR_TURNO,
  energiaDoTurno,
  energiaMaximaPara,
  validarAlocacao,
  alocacaoPadrao,
  clamparAlocacao,
} from "./energia.js";
import type { ProjectCard } from "./projects.js";

/** Uma carta ativa com o mínimo que a regra da Energia olha. */
function carta(id: string, durationTurns: number, turnsCompleted = 0, status: ProjectCard["status"] = "ACTIVE"): ProjectCard {
  // O título entra porque a recusa por teto o cita: sem ele, a mensagem sairia
  // com a palavra "undefined" e nenhum teste perceberia.
  return { id, title: `Carta ${id.toUpperCase()}`, durationTurns, turnsCompleted, status } as ProjectCard;
}

describe("ENERGIA_POR_TURNO", () => {
  it("é 3, como o Mestre definiu", () => {
    expect(ENERGIA_POR_TURNO).toBe(3);
  });
});

describe("PASSO_POR_TURNO", () => {
  it("é 1 — o passo livre que toda carta ativa recebe, com ou sem Energia", () => {
    expect(PASSO_POR_TURNO).toBe(1);
  });
});

describe("energiaMaximaPara", () => {
  it("é o que falta para concluir MENOS o passo livre, não a duração inteira", () => {
    // 3 turnos, 2 já andados: falta 1, e o passo livre cobre esse 1 sozinho.
    // Dar Energia aqui não compraria progresso nenhum.
    expect(energiaMaximaPara(carta("a", 3, 2))).toBe(0);
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("a regressão: carta de um turno em 0/1 tem teto zero — o passo livre já conclui sozinho", () => {
    expect(energiaMaximaPara(carta("a", 1, 0))).toBe(0);
  });

  it("a regressão: carta de três turnos em 1/3 tem teto 1 — falta 2, um deles é de graça", () => {
    expect(energiaMaximaPara(carta("a", 3, 1))).toBe(1);
  });

  it("nunca passa dos 3 pontos do turno", () => {
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("é zero para carta pausada", () => {
    expect(energiaMaximaPara(carta("a", 5, 0, "PAUSED"))).toBe(0);
  });

  it("nunca fica negativo quando falta menos que o passo livre", () => {
    expect(energiaMaximaPara(carta("a", 1, 0))).toBeGreaterThanOrEqual(0);
  });
});

describe("validarAlocacao", () => {
  // Duração 4, não 3: com o passo livre descontado, o teto de uma carta nova é
  // `duração - 1`. Precisa ser >= 3 para o teste "concentrar os três numa
  // carta" continuar cabendo no teto por carta, e não só no total do turno.
  const ativas = [carta("a", 4), carta("b", 4), carta("c", 4)];

  it("aceita espalhar um ponto em cada", () => {
    expect(validarAlocacao({ a: 1, b: 1, c: 1 }, ativas).ok).toBe(true);
  });

  it("aceita concentrar os três numa carta", () => {
    expect(validarAlocacao({ a: 3 }, ativas).ok).toBe(true);
  });

  it("recusa passar do total do turno", () => {
    const r = validarAlocacao({ a: 2, b: 2 }, ativas);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("3");
  });

  it("recusa dar a uma carta mais do que ela precisa", () => {
    // Duração 4 em 2/4: falta 2, um deles é o passo livre, então o teto é 1.
    const r = validarAlocacao({ a: 2 }, [carta("a", 4, 2)]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("precisa");
    // Nomear a carta é o que torna a recusa útil ao jogador, então o teste cobra
    // o título e o número que faltava — não só a palavra "precisa".
    expect(r.motivo).toContain("Carta A");
    expect(r.motivo).toContain("1 de Energia");
    expect(r.motivo).not.toContain("undefined");
  });

  // Caso mais comum de recusa desde que o teto passou a descontar o passo
  // livre: toda carta a um passo do fim tem teto 0. "precisa de 0 de Energia"
  // seria uma frase sem sentido — a recusa tem de dizer a razão de verdade.
  it("recusa com a razão certa quando o teto é zero — o passo livre já conclui sozinho", () => {
    const r = validarAlocacao({ a: 1 }, [carta("a", 1, 0)]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("Carta A");
    expect(r.motivo).toContain("passo livre");
    expect(r.motivo).not.toContain("precisa de 0");
    expect(r.motivo).not.toContain("undefined");
  });

  it("recusa carta que não está ativa", () => {
    const r = validarAlocacao({ z: 1 }, ativas);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("não está ativa");
  });

  it("recusa valor negativo", () => {
    expect(validarAlocacao({ a: -1 }, ativas).ok).toBe(false);
  });

  it("recusa valor quebrado", () => {
    expect(validarAlocacao({ a: 1.5 }, ativas).ok).toBe(false);
  });

  it("aceita alocação vazia", () => {
    expect(validarAlocacao({}, ativas).ok).toBe(true);
  });

  it("aceita zero para carta que não está na lista", () => {
    // Contrato deliberado: a tela monta o formulário com todas as cartas e zera
    // as que o jogador não escolheu. Zero é neutro, então não precisa filtrar
    // antes de enviar. Este teste existe para ninguém "consertar" isso depois.
    expect(validarAlocacao({ z: 0 }, ativas).ok).toBe(true);
  });
});

describe("alocacaoPadrao", () => {
  it("dá um ponto por carta ativa, que é o ritmo de hoje", () => {
    expect(alocacaoPadrao([carta("a", 3), carta("b", 3)])).toEqual({ a: 1, b: 1 });
  });

  it("não acelera quem tem uma carta só — o resto da Energia se perde", () => {
    expect(alocacaoPadrao([carta("a", 5)])).toEqual({ a: 1 });
  });

  it("ignora carta pausada", () => {
    expect(alocacaoPadrao([carta("a", 3), carta("b", 3, 0, "PAUSED")])).toEqual({ a: 1 });
  });

  it("dá um ponto a cada carta ativa, sem deixar nenhuma de fora", () => {
    const cartas = [carta("a", 3), carta("b", 3), carta("c", 3), carta("d", 3)];
    expect(alocacaoPadrao(cartas)).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });

  it("devolve vazio quando a Casa não tem carta ativa — os três pontos se perdem", () => {
    expect(alocacaoPadrao([])).toEqual({});
  });

  it("o que devolve passa na própria validação, até o teto de cartas do turno", () => {
    const cartas = [carta("a", 3), carta("b", 3)];
    expect(validarAlocacao(alocacaoPadrao(cartas), cartas).ok).toBe(true);
  });

  it("no teto de cartas, o padrão ainda cabe no orçamento do turno", () => {
    // O jogador precisa conseguir, no mínimo, reproduzir o padrão à mão. É o que
    // garante que distribuir nunca seja pior do que não mexer em nada.
    const cartas = [carta("a", 3), carta("b", 3), carta("c", 3)];
    expect(validarAlocacao(alocacaoPadrao(cartas), cartas).ok).toBe(true);
  });

  it("toda Casa recebe os mesmos três pontos, não importa quantas cartas tenha", () => {
    expect(energiaDoTurno([carta("a", 3), carta("b", 3), carta("c", 3)])).toBe(ENERGIA_POR_TURNO);
    expect(energiaDoTurno([carta("a", 3)])).toBe(ENERGIA_POR_TURNO);
    expect(energiaDoTurno([])).toBe(ENERGIA_POR_TURNO);
  });
});

describe("clamparAlocacao", () => {
  // A alocação foi válida no dia em que o jogador gravou — a carta era outra.
  // `refeita: true` reescreve a carta com prazo de um turno, ou o Mestre devolve
  // a carta para PENDING_GM, e a alocação gravada sobrevive sem ninguém revisá-la.
  it("corta para o teto atual quando a carta encolheu", () => {
    const cartas = [carta("a", 1, 0)]; // refeita: virou carta de um turno
    const { porProjeto, ajustes } = clamparAlocacao({ a: 3 }, cartas);
    expect(porProjeto).toEqual({});
    expect(ajustes).toEqual([{ id: "a", title: "Carta A", de: 3, para: 0 }]);
  });

  it("clampa parcialmente quando o teto caiu mas não zerou", () => {
    const cartas = [carta("a", 3, 1)]; // teto atual é 1
    const { porProjeto, ajustes } = clamparAlocacao({ a: 3 }, cartas);
    expect(porProjeto).toEqual({ a: 1 });
    expect(ajustes).toEqual([{ id: "a", title: "Carta A", de: 3, para: 1 }]);
  });

  it("não mexe em alocação que ainda cabe no teto", () => {
    const cartas = [carta("a", 5, 0)];
    const { porProjeto, ajustes } = clamparAlocacao({ a: 3 }, cartas);
    expect(porProjeto).toEqual({ a: 3 });
    expect(ajustes).toEqual([]);
  });

  it("derruba a entrada inteira quando a carta saiu de ACTIVE (voltou a PENDING_GM, por exemplo)", () => {
    const cartas = [carta("a", 5, 0, "PENDING_GM")];
    const { porProjeto, ajustes } = clamparAlocacao({ a: 2 }, cartas);
    expect(porProjeto).toEqual({});
    expect(ajustes).toEqual([{ id: "a", title: "Carta A", de: 2, para: 0 }]);
  });

  it("derruba a entrada quando a carta nem existe mais na lista", () => {
    const { porProjeto, ajustes } = clamparAlocacao({ fantasma: 2 }, []);
    expect(porProjeto).toEqual({});
    expect(ajustes).toEqual([{ id: "fantasma", title: "fantasma", de: 2, para: 0 }]);
  });

  it("alocação vazia não gera ajuste nenhum", () => {
    const cartas = [carta("a", 5, 0)];
    expect(clamparAlocacao({}, cartas)).toEqual({ porProjeto: {}, ajustes: [] });
  });

  it("o resultado de uma alocação que já era válida ao gravar sempre passa na própria validação depois do clamp", () => {
    // {a:1, b:1, c:1} somava 3 e era válida quando gravada. O clamp só reduz
    // cada entrada — nunca aumenta — então a soma final nunca passa da soma
    // original, e a soma original já cabia no orçamento do turno.
    const cartas = [carta("a", 1, 0), carta("b", 3, 1), carta("c", 5, 0)];
    const { porProjeto } = clamparAlocacao({ a: 1, b: 1, c: 1 }, cartas);
    expect(validarAlocacao(porProjeto, cartas).ok).toBe(true);
  });
});
