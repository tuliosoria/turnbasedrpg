import { describe, expect, it } from "vitest";
import { HttpError } from "../types/domain";
import { mapOpenAiError, parsePrivateInfo, parseResolution } from "./openai";

describe("mapOpenAiError", () => {
  it("maps a 429 quota error to a clear 503 AI_QUOTA HttpError", () => {
    const err = mapOpenAiError({ status: 429, message: "You exceeded your current quota" });
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(503);
    expect(err.code).toBe("AI_QUOTA");
    expect(err.message).toMatch(/cota/i);
  });

  it("maps a 401 auth error to a 502 AI_AUTH HttpError", () => {
    const err = mapOpenAiError({ status: 401, message: "Invalid API key" });
    expect(err.status).toBe(502);
    expect(err.code).toBe("AI_AUTH");
  });

  it("maps an unknown error to a generic 502 AI_ERROR HttpError", () => {
    const err = mapOpenAiError(new Error("network down"));
    expect(err.status).toBe(502);
    expect(err.code).toBe("AI_ERROR");
  });

  it("passes through an existing HttpError unchanged", () => {
    const original = new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
    expect(mapOpenAiError(original)).toBe(original);
  });
});

describe("parseResolution", () => {
  it("parses a valid resolution JSON payload including attribute deltas", () => {
    const result = parseResolution(JSON.stringify({
      publicResult: "Valdren sobrevive a mais uma noite.",
      houseResults: { "casa-vargen": "Os lobos mantêm a muralha." },
      attributeDeltas: { "casa-vargen": { soldados: -1, controle: 1 } },
      discoveries: ["Há luz sob o lago."],
    }));

    expect(result).toEqual({
      publicResult: "Valdren sobrevive a mais uma noite.",
      houseResults: { "casa-vargen": "Os lobos mantêm a muralha." },
      attributeDeltas: { "casa-vargen": { soldados: -1, controle: 1 } },
      discoveries: ["Há luz sob o lago."],
    });
  });

  it("throws HttpError when the AI returns garbage", () => {
    expect(() => parseResolution("não é json")).toThrow(HttpError);
    expect(() => parseResolution("não é json")).toThrow("A IA retornou um formato inválido.");
  });

  it("throws HttpError when the AI returns an incomplete or malformed resolution shape", () => {
    expect(() => parseResolution("null")).toThrow(HttpError);
    expect(() => parseResolution(JSON.stringify({
      publicResult: "Resultado",
      houseResults: { "casa-vargen": 12 },
    }))).toThrow(HttpError);
    expect(() => parseResolution(JSON.stringify({
      publicResult: "Resultado",
      attributeDeltas: { "casa-vargen": { reputacao: 1 } },
    }))).toThrow(HttpError);
    expect(() => parseResolution(JSON.stringify({
      publicResult: "Resultado",
      discoveries: ["Válida", 3],
    }))).toThrow(HttpError);
  });
});

describe("parsePrivateInfo", () => {
  it("parses a houseId to text map", () => {
    const privateInfo = parsePrivateInfo(JSON.stringify({
      "casa-vargen": "Batedores viram pegadas nas Brumas.",
      "casa-miruna": "Um informante teme a capela congelada.",
    }));

    expect(privateInfo).toEqual({
      "casa-vargen": "Batedores viram pegadas nas Brumas.",
      "casa-miruna": "Um informante teme a capela congelada.",
    });
  });

  it("throws HttpError when the AI returns garbage", () => {
    expect(() => parsePrivateInfo("sem json")).toThrow(HttpError);
    expect(() => parsePrivateInfo("sem json")).toThrow("A IA retornou um formato inválido.");
  });

  it("throws HttpError when private info is not a string-only object", () => {
    expect(() => parsePrivateInfo("[]")).toThrow(HttpError);
    expect(() => parsePrivateInfo(JSON.stringify({ "casa-vargen": 42 }))).toThrow(HttpError);
  });
});
