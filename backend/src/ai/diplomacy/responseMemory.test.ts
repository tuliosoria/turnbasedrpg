import { describe, expect, it } from "vitest";
import { responseMemory } from "./responseMemory";
import type { DiplomaticMessage } from "@ravenloft/content";

function message(id: string, createdAt: string, body: string): DiplomaticMessage {
  return { id, body, createdAt, author: "PLAYER", turnNumber: 11 } as DiplomaticMessage;
}

describe("memória da resposta", () => {
  it("lê o convite recebido uma vez, na ordem de envio, e inclui o pacto confirmado", () => {
    const dossie = {
      fio: [
        { turnNumber: 10, author: "AI" as const, body: "Encontro marcado em Raven's Cross." },
        { turnNumber: 11, author: "PLAYER" as const, body: "Confirmo o encontro." },
      ],
      fatos: [{
        id: "f1", campaignId: "c", turnNumber: 10, kind: "ACORDO" as const,
        betweenA: "solarion-k0hc", betweenB: "casa-ferrumor",
        summary: "Encontro em Raven's Cross.", sourceMessageId: "m1",
        status: "ATIVO" as const, createdAt: "2026-09-24T08:00:00Z",
      }],
    };
    const result = responseMemory(dossie, 11, [
      message("b", "2026-09-24T10:00:00Z", "Confirmo o encontro."),
      message("a", "2026-09-24T09:00:00Z", "Podemos conversar?"),
    ], "b");
    expect(result.priorLetters).toHaveLength(1);
    expect(result.thread.map((m) => m.body)).toEqual(["Podemos conversar?"]);
    expect(result.incomingLetter).toBe("Confirmo o encontro.");
    expect(result.diplomaticState).toContain("OBRIGAÇÕES EM VIGOR");
  });

  it("reduz o fio de Solarion e separa a pergunta atual sem duplicá-la", () => {
    const previous = Array.from({ length: 18 }, (_, i) => ({
      turnNumber: i < 9 ? 8 : 9,
      author: i % 2 ? "PLAYER" as const : "AI" as const,
      body: i === 0
        ? "Propomos a primeira troca."
        : i === 1
          ? "Solarion aceita."
          : `histórico-${i}`,
    }));
    const current = Array.from({ length: 9 }, (_, i) =>
      message(
        `t10-${i}`,
        `2026-09-20T0${i}:00:00Z`,
        i === 7 ? "O que pensa da estratégia?" : `turno-atual-${i}`,
      ));
    const dossie = { fio: previous, fatos: [] };
    const result = responseMemory(dossie, 10, current, "t10-7");
    expect(result.priorLetters.map((m) => m.body)).toEqual([
      "Propomos a primeira troca.",
      "Solarion aceita.",
      "histórico-12",
      "histórico-13",
      "histórico-14",
      "histórico-15",
      "histórico-16",
      "histórico-17",
    ]);
    expect(result.thread).toHaveLength(6);
    expect(result.incomingLetter).toBe("O que pensa da estratégia?");
    expect(result.thread.map((m) => m.body)).not.toContain("O que pensa da estratégia?");
  });
});
