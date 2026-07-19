import { describe, it, expect } from "vitest";
import { parseAdminLoginBody, parseApplyResolutionBody, parseCreateHouseBody, parseLoginBody, parseSubmitOrderBody, parseWorldBibleBody } from "./schemas";
import { HttpError } from "../types/domain";

const validCreateHouseBody = {
  displayName: "Jogador",
  name: "Casa Vargen",
  motto: "No inverno, resistimos",
  emblem: { icon: "lobo", color1: "#111111", color2: "#222222" },
  leaderName: "Radan",
  heirName: "Irina",
  castleName: "Castelo Vargen",
  townsText: "Três vilas",
  historyText: "Antiga linhagem",
  specialty: "Patrulhas",
  weakness: "Orgulho",
  attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
};

describe("validation schemas", () => {
  it("parseWorldBibleBody accepts strings and defaults missing fields to empty", () => {
    expect(parseWorldBibleBody({ lore: "Valdren", visualDirectives: "Dark fantasy" }))
      .toEqual({ lore: "Valdren", visualDirectives: "Dark fantasy" });
    expect(parseWorldBibleBody({})).toEqual({ lore: "", visualDirectives: "" });
  });

  it("parseWorldBibleBody rejects non-string and oversized fields", () => {
    expect(() => parseWorldBibleBody({ lore: 123 })).toThrow(HttpError);
    expect(() => parseWorldBibleBody({ lore: "x".repeat(20001) })).toThrow(HttpError);
  });

  it("parseCreateHouseBody accepts a valid body", () => {
    expect(parseCreateHouseBody(validCreateHouseBody)).toEqual(validCreateHouseBody);
  });

  it("parseCreateHouseBody rejects a bad attribute sum", () => {
    expect(() => parseCreateHouseBody({
      ...validCreateHouseBody,
      attributes: { riqueza: 1, recursos: 1, soldados: 1, controle: 1 },
    })).toThrow(HttpError);
  });

  it("parseCreateHouseBody rejects an unknown emblem icon", () => {
    expect(() => parseCreateHouseBody({
      ...validCreateHouseBody,
      emblem: { icon: "dragao", color1: "#111111", color2: "#222222" },
    })).toThrow(HttpError);
  });

  it("parseSubmitOrderBody requires orderText", () => {
    expect(() => parseSubmitOrderBody({ orderText: "", cardResponses: [] })).toThrow(HttpError);
  });

  it("parseSubmitOrderBody accepts declaredSpend", () => {
    expect(parseSubmitOrderBody({
      orderText: "Defender a ponte.",
      cardResponses: [{ cardId: "ponte", text: "", declaredSpend: { attribute: "soldados", amount: "2" } }],
    })).toEqual({
      orderText: "Defender a ponte.",
      cardResponses: [{ cardId: "ponte", text: "", declaredSpend: { attribute: "soldados", amount: 2 } }],
    });
  });

  it("keeps login parsers working", () => {
    expect(parseLoginBody({ playerCode: "vargen-4K7P" })).toEqual({ playerCode: "vargen-4K7P" });
    expect(parseAdminLoginBody({ adminCode: "secret" })).toEqual({ adminCode: "secret" });
  });

  it("parseApplyResolutionBody accepts a valid resolution", () => {
    const body = {
      publicResult: "O inverno recua por uma noite.",
      houseResults: { "casa-vargen": "A muralha resiste." },
      attributeDeltas: { "casa-vargen": { soldados: -1, controle: 1 } },
      discoveries: ["Há fogo sob o lago."],
    };

    expect(parseApplyResolutionBody(body)).toEqual(body);
  });

  it("parseApplyResolutionBody rejects malformed nested records", () => {
    expect(() => parseApplyResolutionBody({
      publicResult: "Resultado",
      houseResults: { "casa-vargen": 7 },
      attributeDeltas: {},
      discoveries: [],
    })).toThrow(HttpError);
    expect(() => parseApplyResolutionBody({
      publicResult: "Resultado",
      houseResults: {},
      attributeDeltas: { "casa-vargen": null },
      discoveries: [],
    })).toThrow(HttpError);
    expect(() => parseApplyResolutionBody({
      publicResult: "Resultado",
      houseResults: {},
      attributeDeltas: { "casa-vargen": { reputacao: 1 } },
      discoveries: [],
    })).toThrow(HttpError);
    expect(() => parseApplyResolutionBody({
      publicResult: "Resultado",
      houseResults: {},
      attributeDeltas: {},
      discoveries: ["válida", 9],
    })).toThrow(HttpError);
  });
});
