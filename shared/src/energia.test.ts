import { describe, expect, it } from "vitest";
import {
  ENERGIA_POR_TURNO,
  energiaDoTurno,
  energiaMaximaPara,
  validarAlocacao,
  alocacaoPadrao,
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

describe("energiaMaximaPara", () => {
  it("é o que falta para concluir, não a duração inteira", () => {
    expect(energiaMaximaPara(carta("a", 3, 2))).toBe(1);
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("nunca passa dos 3 pontos do turno", () => {
    expect(energiaMaximaPara(carta("a", 5, 0))).toBe(3);
  });

  it("é zero para carta pausada", () => {
    expect(energiaMaximaPara(carta("a", 5, 0, "PAUSED"))).toBe(0);
  });
});

describe("validarAlocacao", () => {
  const ativas = [carta("a", 3), carta("b", 3), carta("c", 3)];

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
    const r = validarAlocacao({ a: 2 }, [carta("a", 3, 2)]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("precisa");
    // Nomear a carta é o que torna a recusa útil ao jogador, então o teste cobra
    // o título e o número que faltava — não só a palavra "precisa".
    expect(r.motivo).toContain("Carta A");
    expect(r.motivo).toContain("1 de Energia");
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

  it("dá um ponto a cada carta ativa, mesmo com quatro cartas", () => {
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

  it("com quatro cartas o padrão continua cabendo no orçamento do turno", () => {
    // O jogador precisa conseguir, no mínimo, reproduzir o padrão à mão. Se o
    // orçamento fosse fixo em três, distribuir seria sempre pior que não mexer.
    const cartas = [carta("a", 3), carta("b", 3), carta("c", 3), carta("d", 3)];
    expect(validarAlocacao(alocacaoPadrao(cartas), cartas).ok).toBe(true);
  });

  it("quatro cartas ativas dão quatro de Energia; três ou menos dão três", () => {
    expect(energiaDoTurno([carta("a", 3), carta("b", 3), carta("c", 3), carta("d", 3)])).toBe(4);
    expect(energiaDoTurno([carta("a", 3), carta("b", 3)])).toBe(3);
    expect(energiaDoTurno([])).toBe(3);
  });

  it("carta pausada não engorda o orçamento do turno", () => {
    expect(energiaDoTurno([carta("a", 3), carta("b", 3), carta("c", 3), carta("d", 3, 0, "PAUSED")])).toBe(3);
  });
});
