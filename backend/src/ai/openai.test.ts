import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../types/domain";
import { generateJson, mapOpenAiError, parsePrivateInfo, parsePublicEvent, parseResolution } from "./openai";

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

describe("parsePublicEvent", () => {
  it("extracts the publicEvent string", () => {
    expect(parsePublicEvent(JSON.stringify({ publicEvent: "As Brumas avançam." }))).toBe("As Brumas avançam.");
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePublicEvent("não é json")).toThrow(HttpError);
  });

  it("throws when publicEvent is missing or empty", () => {
    expect(() => parsePublicEvent(JSON.stringify({}))).toThrow(HttpError);
    expect(() => parsePublicEvent(JSON.stringify({ publicEvent: "   " }))).toThrow(HttpError);
  });
});

describe("generateJson", () => {
  const good = JSON.stringify({ publicResult: "ok", houseResults: {}, attributeDeltas: {}, discoveries: [] });
  const malformed = JSON.stringify({ publicResult: "ok", houseResults: { a: 1 } });

  it("returns the parsed result on the first successful attempt", async () => {
    const chat = vi.fn().mockResolvedValue(good);
    const res = await generateJson(chat, "sys", "usr", parseResolution);
    expect(res.publicResult).toBe("ok");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("retries when the model returns a malformed shape and succeeds on a later attempt", async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce(malformed)
      .mockResolvedValueOnce(good);
    const res = await generateJson(chat, "sys", "usr", parseResolution, 3);
    expect(res.publicResult).toBe("ok");
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("retries transient AI_ERROR (timeout/network) and succeeds", async () => {
    const chat = vi.fn()
      .mockRejectedValueOnce(new HttpError(502, "AI_ERROR", "timeout"))
      .mockResolvedValueOnce(good);
    const res = await generateJson(chat, "sys", "usr", parseResolution, 3);
    expect(res.publicResult).toBe("ok");
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("throws AI_PARSE after exhausting all attempts", async () => {
    const chat = vi.fn().mockResolvedValue(malformed);
    await expect(generateJson(chat, "sys", "usr", parseResolution, 3)).rejects.toMatchObject({ code: "AI_PARSE" });
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it("defaults to 2 attempts", async () => {
    const chat = vi.fn().mockResolvedValue(malformed);
    await expect(generateJson(chat, "sys", "usr", parseResolution)).rejects.toMatchObject({ code: "AI_PARSE" });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("does not retry quota or auth errors", async () => {
    const chat = vi.fn().mockRejectedValue(new HttpError(503, "AI_QUOTA", "sem cota"));
    await expect(generateJson(chat, "sys", "usr", parseResolution, 3)).rejects.toMatchObject({ code: "AI_QUOTA" });
    expect(chat).toHaveBeenCalledTimes(1);
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
