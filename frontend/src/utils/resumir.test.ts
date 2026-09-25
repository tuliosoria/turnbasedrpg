import { describe, it, expect } from "vitest";
import { resumir } from "./resumir";

describe("resumir", () => {
  it("devolve o texto inteiro quando cabe", () => {
    expect(resumir("Curto.", 160)).toBe("Curto.");
  });

  it("corta em fronteira de palavra e marca com reticências", () => {
    const t = "O Aqueduto está de pé em Khar-Durak desde o inverno";
    expect(resumir(t, 30)).toBe("O Aqueduto está de pé em…");
  });

  it("não deixa pontuação pendurada antes das reticências", () => {
    expect(resumir("Primeira parte, segunda parte longa demais", 16)).toBe("Primeira parte…");
  });
});
