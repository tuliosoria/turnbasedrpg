import { describe, it, expect } from "vitest";
import { newMessage, sendsRemaining, pairKey, clampMessage, MESSAGE_MAX, isFactKind } from "./models.js";

const msg = (author: "PLAYER" | "AI", i = 0) =>
  newMessage({ id: `m${i}`, campaignId: "winter-dead", turnNumber: 2, fromHouseId: "h1", toHouseKey: "casa-karasoy", author, body: "olá" });

describe("sendsRemaining", () => {
  it("conta só os envios do jogador, não as respostas", () => {
    // A resposta da IA é consequência do envio, não um segundo gasto — senão
    // um orçamento de 2 permitiria uma única carta.
    const thread = [msg("PLAYER", 1), msg("AI", 2)];
    expect(sendsRemaining(thread, 2)).toBe(1);
  });

  it("chega a zero quando o orçamento acaba", () => {
    expect(sendsRemaining([msg("PLAYER", 1), msg("AI", 2), msg("PLAYER", 3), msg("AI", 4)], 2)).toBe(0);
  });

  it("nunca fica negativo", () => {
    expect(sendsRemaining([msg("PLAYER", 1), msg("PLAYER", 2), msg("PLAYER", 3)], 2)).toBe(0);
  });

  it("devolve o orçamento inteiro numa conversa vazia", () => {
    expect(sendsRemaining([], 2)).toBe(2);
  });
});

describe("pairKey", () => {
  it("distingue destinatários diferentes da mesma Casa", () => {
    // O orçamento é por par: gastar com Karasoy não pode consumir o de Vargen.
    expect(pairKey("h1", "casa-karasoy")).not.toBe(pairKey("h1", "casa-vargen"));
  });

  it("é estável para o mesmo par", () => {
    expect(pairKey("h1", "casa-karasoy")).toBe(pairKey("h1", "casa-karasoy"));
  });
});

describe("newMessage", () => {
  it("corta corpo longo demais", () => {
    const m = newMessage({ id: "m", campaignId: "c", turnNumber: 1, fromHouseId: "h", toHouseKey: "k", author: "PLAYER", body: "x".repeat(9000) });
    expect(m.body.length).toBe(MESSAGE_MAX);
  });

  it("guarda a mensagem respondida quando existe", () => {
    const m = newMessage({ id: "m", campaignId: "c", turnNumber: 1, fromHouseId: "h", toHouseKey: "k", author: "AI", body: "resposta", replyToId: "m1" });
    expect(m.replyToId).toBe("m1");
  });
});

describe("clampMessage / isFactKind", () => {
  it("trata entrada não textual", () => {
    expect(clampMessage(undefined)).toBe("");
    expect(clampMessage(42)).toBe("");
  });

  it("valida os tipos de fato", () => {
    expect(isFactKind("ALIANCA")).toBe(true);
    expect(isFactKind("FOFOCA")).toBe(false);
  });
});
