import { beforeEach, describe, expect, it } from "vitest";
import { clearAdminToken, loadAdminToken, saveAdminToken } from "./adminSession";

const KEY = "ravenloft.admin";

/** Um token no formato do servidor: payload base64url assinado. */
function tokenExpiringIn(ms: number): string {
  const payload = { type: "admin", campaignId: "winter-dead", exp: Date.now() + ms };
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${body}.assinatura`;
}

describe("sessão do admin", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // O motivo da mudança: fechar a aba derrubava o login e a interface sumia
  // com os botões de GM sem explicar por quê.
  it("sobrevive ao fechamento da aba", () => {
    saveAdminToken(tokenExpiringIn(60_000));

    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("ainda aceita o login de quem estava em sessionStorage", () => {
    const token = tokenExpiringIn(60_000);
    sessionStorage.setItem(KEY, token);

    expect(loadAdminToken()).toBe(token);
  });

  // Um getter que grava faz a limpeza de quem chama mentir: foi assim que os
  // testes do AdminPage passaram a vazar login de um caso para o outro.
  it("não grava nada ao apenas ler", () => {
    sessionStorage.setItem(KEY, tokenExpiringIn(60_000));

    loadAdminToken();

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  // Sem isto a interface mostraria controles de GM que o servidor recusa.
  it("descarta o token vencido em vez de devolvê-lo", () => {
    saveAdminToken(tokenExpiringIn(-1000));

    expect(loadAdminToken()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("mantém o token que ainda vale", () => {
    const token = tokenExpiringIn(60_000);
    saveAdminToken(token);

    expect(loadAdminToken()).toBe(token);
  });

  // Quem decide a validade é o servidor; um token que não a declara passa.
  it("não inventa prazo para token sem exp legível", () => {
    saveAdminToken("mock-admin-token");

    expect(loadAdminToken()).toBe("mock-admin-token");
  });

  it("limpa os dois armazenamentos", () => {
    localStorage.setItem(KEY, "a");
    sessionStorage.setItem(KEY, "b");

    clearAdminToken();

    expect(loadAdminToken()).toBeNull();
  });
});
