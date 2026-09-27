import { describe, expect, it } from "vitest";
import { selectCurrentExchange, selectHistoricalLetters } from "./conversationMemory";
import type { DiplomaticMessage } from "@ravenloft/content";

const letter = (n: number, body = `m${n}`) => ({
  turnNumber: 8 + Math.floor(n / 9),
  author: n % 2 ? "PLAYER" as const : "AI" as const,
  body,
});

const message = (id: string, createdAt: string, body = id) => ({
  id,
  createdAt,
  body,
  author: "PLAYER",
  turnNumber: 10,
} as DiplomaticMessage);

describe("projeção do histórico diplomático", () => {
  it("preserva as duas origens e as seis mais recentes de um fio de 27", () => {
    const selected = selectHistoricalLetters(Array.from({ length: 27 }, (_, i) => letter(i)));
    expect(selected.map((m) => m.body)).toEqual([
      "m0", "m1", "m21", "m22", "m23", "m24", "m25", "m26",
    ]);
  });

  it("não confunde duas posições que têm o mesmo corpo", () => {
    const input = [
      letter(0, "igual"),
      letter(1, "igual"),
      ...Array.from({ length: 7 }, (_, i) => letter(i + 2)),
    ];
    expect(selectHistoricalLetters(input).filter((m) => m.body === "igual")).toHaveLength(2);
  });

  it("preserva origem legada inteira e não acrescenta recente fora do orçamento", () => {
    const input = [
      letter(0, "a".repeat(7_000)),
      letter(1, "b".repeat(7_000)),
      letter(2, "recente"),
    ];
    expect(selectHistoricalLetters(input).map((m) => m.body)).toEqual([
      "a".repeat(7_000),
      "b".repeat(7_000),
    ]);
  });
});

describe("projeção da troca atual", () => {
  it("ordena, limita o passado e exclui tudo posterior ao alvo", () => {
    const items = [
      message("depois", "2026-09-20T12:00:00Z"),
      ...Array.from({ length: 8 }, (_, i) =>
        message(`antes-${i}`, `2026-09-20T0${i}:00:00Z`)),
      message("alvo", "2026-09-20T10:00:00Z", "pergunta estratégica"),
    ];
    const selected = selectCurrentExchange(items, "alvo");
    expect(selected.before.map((m) => m.id)).toEqual([
      "antes-2", "antes-3", "antes-4", "antes-5", "antes-6", "antes-7",
    ]);
    expect(selected.incoming.body).toBe("pergunta estratégica");
    expect(selected.before.map((m) => m.id)).not.toContain("depois");
  });

  it("recusa id que não pertence ao fio", () => {
    expect(() =>
      selectCurrentExchange([message("a", "2026-09-20T00:00:00Z")], "ausente"),
    ).toThrow(/Carta atual ausente/);
  });
});
