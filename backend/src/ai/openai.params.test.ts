import { describe, expect, it } from "vitest";
import { chatParamsFor, timeoutFor } from "./openai";

describe("contrato de parâmetros por família de modelo", () => {
  // Mandar max_tokens para um gpt-5 não degrada: devolve 400 e a chamada
  // inteira falha. Um modelo melhor mal configurado é um modelo que nunca
  // responde.
  it("usa max_tokens no gpt-4o", () => {
    expect(chatParamsFor("gpt-4o-mini", 700, 0.7)).toEqual({ max_tokens: 700, temperature: 0.7 });
  });

  it("usa max_completion_tokens e omite temperatura na família gpt-5", () => {
    const p = chatParamsFor("gpt-5.5", 700, 0.7);
    expect(p).toEqual({ max_completion_tokens: 700 });
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("max_tokens");
  });

  it("trata os modelos de raciocínio o1..o4 como a família nova", () => {
    expect(chatParamsFor("o3-mini", 500, 0.7)).toEqual({ max_completion_tokens: 500 });
  });

  // Cortar a resolução de um turno ao meio é pior que gastar tokens.
  it("respeita a ausência de teto nas duas famílias", () => {
    expect(chatParamsFor("gpt-4o-mini", undefined, 0.7).max_tokens).toBeUndefined();
    expect(chatParamsFor("gpt-5.5", undefined, 0.7)).toEqual({});
  });

  it("dá mais tempo a quem pensa antes de escrever", () => {
    expect(timeoutFor("gpt-4o-mini")).toBe(12000);
    expect(timeoutFor("gpt-5.5")).toBeGreaterThan(12000);
  });
});
