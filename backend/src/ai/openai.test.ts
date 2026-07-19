import { describe, expect, it } from "vitest";
import { HttpError } from "../types/domain";
import { parsePrivateInfo, parseResolution } from "./openai";

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
