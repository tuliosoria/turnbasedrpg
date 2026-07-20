import { describe, it, expect } from "vitest";
import { parseAdminLoginBody, parseApplyResolutionBody, parseCreateHouseBody, parseLoginBody, parseSubmitOrderBody, parseWorldBibleBody, parseAdminCreateHouseBody, parseAdminUpdateHouseBody, parseAdminDeleteHouseBody, parseImagesField, parseHouseImageGenerateBody } from "./schemas";
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
    expect(parseCreateHouseBody(validCreateHouseBody)).toEqual({ ...validCreateHouseBody, images: [] });
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

  it("parseAdminCreateHouseBody accepts a free (non-10) attribute spread", () => {
    const body = { ...validCreateHouseBody, attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 } };
    expect(parseAdminCreateHouseBody(body)).toEqual({ ...body, images: [] });
  });

  it("parseAdminCreateHouseBody still rejects out-of-range attributes", () => {
    expect(() => parseAdminCreateHouseBody({
      ...validCreateHouseBody,
      attributes: { riqueza: 6, recursos: 0, soldados: 0, controle: 0 },
    })).toThrow(HttpError);
  });

  it("parseAdminUpdateHouseBody requires houseId and accepts free attributes", () => {
    const { displayName, ...houseFields } = validCreateHouseBody;
    void displayName;
    const body = { houseId: "casa-vargen", ...houseFields, attributes: { riqueza: 0, recursos: 0, soldados: 1, controle: 0 } };
    expect(parseAdminUpdateHouseBody(body)).toEqual(body);
    expect(() => parseAdminUpdateHouseBody({ ...body, houseId: "" })).toThrow(HttpError);
  });

  it("parseAdminDeleteHouseBody requires houseId", () => {
    expect(parseAdminDeleteHouseBody({ houseId: "casa-vargen" })).toEqual({ houseId: "casa-vargen" });
    expect(() => parseAdminDeleteHouseBody({})).toThrow(HttpError);
  });

  it("parseSubmitOrderBody requires orderText", () => {
    expect(() => parseSubmitOrderBody({ orderText: "" })).toThrow(HttpError);
  });

  it("parseSubmitOrderBody returns the free-text order", () => {
    expect(parseSubmitOrderBody({ orderText: "Defender a ponte." })).toEqual({
      orderText: "Defender a ponte.",
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

const dataUrl = (n: number) => "data:image/png;base64," + "A".repeat(n);

describe("parseImagesField", () => {
  it("returns [] when absent", () => {
    expect(parseImagesField({})).toEqual([]);
  });
  it("accepts up to 5 valid data urls", () => {
    const imgs = [dataUrl(10), dataUrl(10)];
    expect(parseImagesField({ images: imgs })).toEqual(imgs);
  });
  it("rejects more than 5", () => {
    expect(() => parseImagesField({ images: Array(6).fill(dataUrl(10)) })).toThrow();
  });
  it("rejects non-image or oversized entries", () => {
    expect(() => parseImagesField({ images: ["notadataurl"] })).toThrow();
    expect(() => parseImagesField({ images: [dataUrl(3_000_000)] })).toThrow();
  });
});

describe("parseHouseImageGenerateBody", () => {
  it("parses name, description, emblem", () => {
    const out = parseHouseImageGenerateBody({
      name: "Casa Vargen", description: "Uma casa antiga do norte.",
      emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
    });
    expect(out.name).toBe("Casa Vargen");
    expect(out.emblem.icon).toBe("lobo");
  });
});
