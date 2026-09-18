import { describe, expect, it } from "vitest";
import type { DiplomaticMessage } from "@ravenloft/content";
import { triarCartasDoTurno } from "./refazerCartas";

function carta(over: Partial<DiplomaticMessage>): DiplomaticMessage {
  return {
    id: "out-10-aaaa",
    campaignId: "winter-dead",
    turnNumber: 10,
    fromHouseId: "solarion-k0hc",
    toHouseKey: "cla-mandibula-de-osso",
    author: "AI",
    body: "Uma carta.",
    replyToId: null,
    toCharacterId: null,
    createdAt: "2026-09-18T10:00:00.000Z",
    ...over,
  };
}

describe("triarCartasDoTurno", () => {
  it("refaz a carta do mundo que ninguém respondeu", () => {
    const t = triarCartasDoTurno([carta({})], 10);
    expect(t.refazer).toHaveLength(1);
    expect(t.mantidas).toHaveLength(0);
  });

  // A falha real: reescrever por cima de um fio já respondido faz o jogador
  // passar a responder a um texto que deixou de existir.
  it("não toca na carta que o jogador já respondeu", () => {
    const t = triarCartasDoTurno(
      [
        carta({ createdAt: "2026-09-18T10:00:00.000Z" }),
        carta({ id: "resp-1", author: "PLAYER", createdAt: "2026-09-18T11:00:00.000Z" }),
      ],
      10,
    );
    expect(t.refazer).toHaveLength(0);
    expect(t.mantidas.map((m) => m.motivo).join(" ")).toMatch(/já respondeu/);
  });

  // Uma resposta do jogador num fio não pode proteger a carta de outro fio.
  it("olha fio por fio, e não o turno inteiro", () => {
    const t = triarCartasDoTurno(
      [
        carta({ id: "out-10-aaaa", toHouseKey: "cla-mandibula-de-osso" }),
        carta({ id: "out-10-bbbb", toHouseKey: "casa-ferrumor" }),
        carta({
          id: "resp-1",
          author: "PLAYER",
          toHouseKey: "casa-ferrumor",
          createdAt: "2026-09-18T11:00:00.000Z",
        }),
      ],
      10,
    );
    expect(t.refazer.map((c) => c.id)).toEqual(["out-10-aaaa"]);
  });

  it("nunca apaga o que o Mestre escreveu à mão", () => {
    const t = triarCartasDoTurno([carta({ id: "gm-carta-do-mestre" })], 10);
    expect(t.refazer).toHaveLength(0);
    expect(t.mantidas[0].motivo).toMatch(/à mão pelo Mestre/);
  });

  it("não confunde resposta a carta de jogador com carta do mundo", () => {
    const t = triarCartasDoTurno([carta({ id: "m9k2-a1b2c3" })], 10);
    expect(t.refazer).toHaveLength(0);
    expect(t.mantidas[0].motivo).toMatch(/resposta a uma carta do jogador/);
  });

  it("nunca apaga o que o jogador escreveu", () => {
    const t = triarCartasDoTurno([carta({ id: "x1", author: "PLAYER" })], 10);
    expect(t.refazer).toHaveLength(0);
    expect(t.mantidas[0].motivo).toMatch(/registro da partida/);
  });

  it("ignora os outros turnos", () => {
    const t = triarCartasDoTurno([carta({ turnNumber: 9, id: "out-9-zzzz" })], 10);
    expect(t.refazer).toHaveLength(0);
    expect(t.mantidas).toHaveLength(0);
  });
});
