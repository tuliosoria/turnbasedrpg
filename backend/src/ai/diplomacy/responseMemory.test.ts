import { describe, expect, it } from "vitest";
import { responseMemory } from "./responseMemory";
import type { DiplomaticMessage } from "@ravenloft/content";

function message(id: string, body: string, createdAt: string): DiplomaticMessage {
  return { id, body, createdAt, author: "PLAYER", turnNumber: 11 } as DiplomaticMessage;
}

describe("memória da resposta", () => {
  it("lê o convite recebido uma vez, na ordem de envio, e inclui o pacto confirmado", () => {
    const dossie = {
      fio: [
        { turnNumber: 10, author: "AI" as const, body: "Encontro marcado em Raven's Cross." },
        { turnNumber: 11, author: "PLAYER" as const, body: "Confirmo o encontro." },
      ],
      compromissos: ["Turno 10 (acordo firmado): encontro em Raven's Cross."],
    };
    const result = responseMemory(dossie, 11, [
      message("b", "Confirmo o encontro.", "2026-09-24T10:00:00Z"),
      message("a", "Podemos conversar?", "2026-09-24T09:00:00Z"),
    ]);
    expect(result.priorLetters).toHaveLength(1);
    expect(result.thread.map((m) => m.body)).toEqual(["Podemos conversar?", "Confirmo o encontro."]);
    expect(result.commitments).toContain("acordo firmado");
  });
});
