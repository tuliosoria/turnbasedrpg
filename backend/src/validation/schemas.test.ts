import { describe, it, expect } from "vitest";
import { parseAdminLoginBody, parseApplyResolutionBody, parseCreateHouseBody, parseLoginBody, parseSubmitOrderBody, parseWorldBibleBody, parseAdminCreateHouseBody, parseAdminUpdateHouseBody, parseAdminDeleteHouseBody, parseImagesField, parseHouseImageGenerateBody, parseWikiCreateBody, parseWikiUpdateBody } from "./schemas";
import { HttpError } from "../types/domain";
import { ORDER_TEXT_MAX } from "@ravenloft/content";

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

  // "Campo muito longo" não dizia ao jogador o teto nem quanto cortar.
  it("parseSubmitOrderBody diz o limite e o excesso quando o texto estoura", () => {
    const excedente = "a".repeat(ORDER_TEXT_MAX + 25);
    expect(() => parseSubmitOrderBody({ orderText: excedente })).toThrow(
      new RegExp(`${ORDER_TEXT_MAX}.*Corte 25`),
    );
  });

  it("parseSubmitOrderBody aceita exatamente o limite", () => {
    const noLimite = "a".repeat(ORDER_TEXT_MAX);
    expect(parseSubmitOrderBody({ orderText: noLimite }).orderText).toHaveLength(ORDER_TEXT_MAX);
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

describe("wiki schemas", () => {
  it("accepts optional safe wiki image URLs", () => {
    expect(parseWikiCreateBody({
      section: "geografia",
      title: "Atlas de Valdren",
      body: "Mapa público do reino.",
      order: 0,
      imageUrl: "/valdren-map.png",
    })).toEqual({
      section: "geografia",
      title: "Atlas de Valdren",
      body: "Mapa público do reino.",
      order: 0,
      imageUrl: "/valdren-map.png",
      imageUrls: ["/valdren-map.png"],
    });

    expect(parseWikiUpdateBody({
      entryId: "atlas",
      section: "geografia",
      title: "Atlas de Valdren",
      body: "Mapa público do reino.",
      order: 0,
      imageUrl: "https://example.com/map.png",
    })).toMatchObject({ imageUrl: "https://example.com/map.png" });

    expect(parseWikiCreateBody({
      section: "casas",
      title: "Casa Euralune",
      body: "Senhores do céu.",
      order: 1,
      imageUrls: ["/houses/euralune.jpg", "/houses/euralune-2.jpg"],
    })).toMatchObject({
      imageUrl: "/houses/euralune.jpg",
      imageUrls: ["/houses/euralune.jpg", "/houses/euralune-2.jpg"],
    });
  });

  it("rejects unsafe wiki image URLs", () => {
    expect(() => parseWikiCreateBody({
      section: "geografia",
      title: "Atlas",
      body: "",
      order: 0,
      imageUrl: "javascript:alert(1)",
    })).toThrow(HttpError);

    expect(() => parseWikiCreateBody({
      section: "casas",
      title: "Casa Euralune",
      body: "",
      order: 0,
      imageUrls: ["/houses/euralune.jpg", "javascript:alert(1)"],
    })).toThrow(HttpError);
  });
});

import { parseCanonPreviewBody, parseCanonProposal, parseCanonSubmitBody, parseCanonApproveBody, parseCanonRejectBody, parseUploadCanonImageBody, assertCanonImageOwned } from "./schemas";
import { canonImageKey } from "../keys";

describe("canon schemas", () => {
  const proposal = {
    title: "Sera de Vargen",
    section: "casas",
    body: "Batedora das fronteiras do norte.",
    summary: "Batedora de Vargen.",
    entityType: "CHARACTER",
    canonicalName: "Sera de Vargen",
    immutableTraits: ["cicatriz no queixo"],
    houseId: "vargen",
  };

  it("parses a preview body", () => {
    expect(parseCanonPreviewBody({ rawText: " Quero criar Sera. " })).toEqual({ rawText: "Quero criar Sera." });
  });

  it("rejects an empty preview body", () => {
    expect(() => parseCanonPreviewBody({ rawText: "   " })).toThrow(/Descreva/);
  });

  it("parses a submit body with an optional image", () => {
    const parsed = parseCanonSubmitBody({ rawText: "Quero criar Sera.", rawImageUrl: "https://cdn/x.png", rawImageKey: "canon/x/original.png", proposal });
    expect(parsed.rawImageUrl).toBe("https://cdn/x.png");
    expect(parsed.rawImageKey).toBe("canon/x/original.png");
    expect(parsed.proposal.entityType).toBe("CHARACTER");
    expect(parseCanonSubmitBody({ rawText: "x", proposal }).rawImageUrl).toBeNull();
  });

  /**
   * O formulário manda `rawImageUrl: null` quando o jogador não anexa imagem —
   * não omite a chave. Tratar só `undefined` como ausente rejeitava com 400
   * toda proposta sem imagem, e o jogador ficava sem conseguir enviar.
   */
  it("aceita imagem nula, que é como o formulário representa 'sem imagem'", () => {
    const parsed = parseCanonSubmitBody({ rawText: "x", rawImageUrl: null, rawImageKey: null, proposal });
    expect(parsed.rawImageUrl).toBeNull();
    expect(parsed.rawImageKey).toBeNull();
  });

  it("rejects an unknown wiki section", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, section: "inexistente" } })).toThrow(/Seção/);
  });

  it("rejects a non-canon wiki section", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, section: "campanha-dnd" } })).toThrow(/regras/);
  });

  it("rejects an unknown entity type but allows null", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, entityType: "DRAGAO" } })).toThrow(/Tipo/);
    expect(parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, entityType: null } }).proposal.entityType).toBeNull();
  });

  it("preserva o parecer da IA quando ele acompanha a submissão", () => {
    const parsed = parseCanonSubmitBody({
      rawText: "x",
      proposal,
      review: {
        verdict: "CONFLICT",
        flags: [{ severity: "BLOCK", message: "Contradiz o nome já registrado." }, { severity: "???", message: "Nome parecido." }],
        conflictingEntryIds: ["w1", 7, "w2"],
      },
    });
    expect(parsed.review).toEqual({
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o nome já registrado." }, { severity: "INFO", message: "Nome parecido." }],
      conflictingEntryIds: ["w1", "w2"],
    });
  });

  // O parecer chega do cliente: sem teto, um envio poderia guardar milhares de
  // flags e ids no item da submissão.
  it("limita a quantidade de flags e de ids em conflito do parecer", () => {
    const parsed = parseCanonSubmitBody({
      rawText: "x",
      proposal,
      review: {
        verdict: "CONFLICT",
        flags: Array.from({ length: 30 }, (_, i) => ({ severity: "WARN", message: `aviso ${i}` })),
        conflictingEntryIds: Array.from({ length: 40 }, (_, i) => `w${i}`),
      },
    });
    expect(parsed.review?.flags).toHaveLength(8);
    expect(parsed.review?.conflictingEntryIds).toHaveLength(10);
    expect(parsed.review?.flags[0].message).toBe("aviso 0");
  });

  it("aceita submissão sem parecer (review nulo ou ausente)", () => {    expect(parseCanonSubmitBody({ rawText: "x", proposal }).review).toBeNull();
    expect(parseCanonSubmitBody({ rawText: "x", proposal, review: null }).review).toBeNull();
  });

  it("parses admin approve and reject bodies", () => {
    expect(parseCanonApproveBody({ submissionId: "abc", proposal }).submissionId).toBe("abc");
    expect(parseCanonApproveBody({ submissionId: "abc" }).proposal).toBeNull();
    expect(parseCanonRejectBody({ submissionId: "abc", note: "Conflita." })).toEqual({ submissionId: "abc", note: "Conflita." });
    expect(() => parseCanonRejectBody({ submissionId: "abc", note: "" })).toThrow(/obrigatório/);
    expect(() => parseCanonRejectBody({ submissionId: "abc", note: "   " })).toThrow(/nota/);
    expect(() => parseCanonRejectBody({ submissionId: "abc" })).toThrow(/obrigatório/);
  });

  it("parses a multipart canon image upload", () => {
    const boundary = "----x";
    const raw = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      Buffer.from([1, 2, 3]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const parsed = parseUploadCanonImageBody({ "content-type": `multipart/form-data; boundary=${boundary}` }, raw);
    expect(parsed.contentType).toBe("image/png");
    expect(parsed.body.length).toBe(3);
  });

  it("rejects a non-array immutableTraits", () => {
    expect(() => parseCanonProposal({ ...proposal, immutableTraits: "não é lista" })).toThrow(/lista/);
  });

  it("rejects immutableTraits above the maximum count", () => {
    const manyTraits = Array.from({ length: 100 }, (_, i) => `traço ${i}`);
    expect(() => parseCanonProposal({ ...proposal, immutableTraits: manyTraits })).toThrow(/traços/i);
  });

  it("rejects a non-string element inside immutableTraits", () => {
    expect(() => parseCanonProposal({ ...proposal, immutableTraits: [42] })).toThrow(/Traço/);
  });

  it("rejects a rawImageUrl with a bad scheme", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", rawImageUrl: "ftp://evil.com/img.png", proposal })).toThrow(/https/);
  });

  it("rejects a rawImageKey with path traversal or leading slash", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", rawImageKey: "../etc/passwd", proposal })).toThrow(/rawImageKey/);
    expect(() => parseCanonSubmitBody({ rawText: "x", rawImageKey: "/absolute/path", proposal })).toThrow(/rawImageKey/);
  });

  it("rejects a canon image upload that is not multipart", () => {
    expect(() => parseUploadCanonImageBody({ "content-type": "application/json" }, Buffer.from("{}"))).toThrow(/multipart/);
  });

  it("requires rawImageUrl and rawImageKey to travel together", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", rawImageUrl: "https://cdn/x.png", proposal })).toThrow(/juntos/);
    expect(() => parseCanonSubmitBody({ rawText: "x", rawImageKey: "canon/x/original.png", proposal })).toThrow(/juntos/);
  });
});

describe("assertCanonImageOwned", () => {
  const baseUrl = "https://ravenloft-images.s3.us-east-1.amazonaws.com";

  it("accepts a url/key pair produced by uploadCanonImage", () => {
    const key = canonImageKey("abc-123", "png");
    expect(() => assertCanonImageOwned(baseUrl, `${baseUrl}/${key}?v=1700000000000`, key)).not.toThrow();
  });

  it("accepts an absent image", () => {
    expect(() => assertCanonImageOwned(baseUrl, null, null)).not.toThrow();
  });

  it("rejects a rawImageUrl on a foreign host", () => {
    const key = canonImageKey("abc-123", "png");
    expect(() => assertCanonImageOwned(baseUrl, `https://evil.example/${key}`, key)).toThrow(/rawImageUrl/);
  });

  it("rejects a rawImageKey outside the canon prefix", () => {
    const key = "turns/012/result.png";
    expect(() => assertCanonImageOwned(baseUrl, `${baseUrl}/${key}`, key)).toThrow(/rawImageKey/);
  });

  it("rejects a mismatch between url and key", () => {
    const key = canonImageKey("abc-123", "png");
    const otherKey = canonImageKey("outro-999", "png");
    expect(() => assertCanonImageOwned(baseUrl, `${baseUrl}/${otherKey}?v=1`, key)).toThrow(/rawImageUrl/);
  });
});

