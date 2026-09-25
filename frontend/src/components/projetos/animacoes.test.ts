import { describe, it, expect, vi, afterEach } from "vitest";
import { querMovimentoReduzido, voarOrbe, animacao, pulsoEnergia } from "./animacoes";

function comMovimentoReduzido(reduzido: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduzido && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("animações", () => {
  it("lê a preferência do sistema", () => {
    comMovimentoReduzido(true);
    expect(querMovimentoReduzido()).toBe(true);
    comMovimentoReduzido(false);
    expect(querMovimentoReduzido()).toBe(false);
  });

  it("sem matchMedia, assume movimento normal", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(querMovimentoReduzido()).toBe(false);
  });

  it("com movimento reduzido, o orbe não voa e nada é criado", async () => {
    comMovimentoReduzido(true);
    const de = document.createElement("div");
    const para = document.createElement("div");
    const animate = vi.fn();
    (de as unknown as { animate: unknown }).animate = animate;
    await voarOrbe(de, para);
    expect(document.body.children.length).toBe(0);
  });

  it("sem Web Animations (jsdom), resolve sem erro e limpa o orbe", async () => {
    comMovimentoReduzido(false);
    const de = document.createElement("div");
    const para = document.createElement("div");
    document.body.append(de, para);
    await expect(voarOrbe(de, para)).resolves.toBeUndefined();
    expect(document.querySelectorAll("[data-orbe-voando]").length).toBe(0);
  });

  it("animacao() vira 'none' com movimento reduzido", () => {
    comMovimentoReduzido(true);
    expect(animacao(pulsoEnergia, "2s", "infinite")).toBe("none");
    comMovimentoReduzido(false);
    expect(animacao(pulsoEnergia, "2s", "infinite")).toContain("2s");
  });
});
