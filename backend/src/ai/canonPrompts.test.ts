import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCanonProposalPrompt, parseCanonProposalJson, buildCanonReviewPrompt, parseCanonReviewJson, buildCanonContext, CANON_CONTEXT_BUDGETS } from "./canonPrompts";
import type { WikiEntry } from "@ravenloft/content";

const wiki: WikiEntry[] = [
  { entryId: "w1", section: "casas", title: "Casa Vargen", body: "Guarda a fronteira norte.", order: 0, updatedAt: "" },
  { entryId: "w2", section: "campanha-dnd", title: "Fireball", body: "Slot de nível 3.", order: 0, updatedAt: "" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildCanonContext", () => {
  it("leaves table rules out of the canon fed to the model", () => {
    const ctx = buildCanonContext(wiki);
    expect(ctx).toContain("Casa Vargen");
    expect(ctx).not.toContain("Fireball");
  });

  it("truncates and appends marker when total exceeds budget", () => {
    const longBody = "x".repeat(CANON_CONTEXT_BUDGETS.entryChars);
    const manyEntries: WikiEntry[] = Array.from({ length: 30 }, (_, i) => ({
      entryId: `e${i}`,
      section: "casas",
      title: `Entrada ${i}`,
      body: longBody,
      order: i,
      updatedAt: "",
    }));
    const ctx = buildCanonContext(manyEntries);
    expect(ctx.length).toBeLessThanOrEqual(CANON_CONTEXT_BUDGETS.totalChars);
    expect(ctx).toContain("[truncado:");
  });
});

describe("buildCanonProposalPrompt", () => {
  it("names the house, the sections and the player text", () => {
    const { system, user } = buildCanonProposalPrompt("Casa Vargen", buildCanonContext(wiki), "Quero criar Sera, batedora.");
    expect(system).toContain("Valdren");
    expect(system).toContain("JSON");
    expect(user).toContain("Casa Vargen");
    expect(user).toContain("Quero criar Sera");
    expect(user).toContain("casas");
    expect(user).not.toContain("campanha-dnd");
  });
});

describe("parseCanonProposalJson", () => {
  it("accepts a well-formed proposal", () => {
    const p = parseCanonProposalJson(JSON.stringify({
      title: "Sera de Vargen", section: "casas", body: "Batedora.", summary: "Batedora.",
      entityType: "CHARACTER", canonicalName: "Sera de Vargen", immutableTraits: ["cicatriz"], houseId: "vargen",
    }));
    expect(p.title).toBe("Sera de Vargen");
    expect(p.entityType).toBe("CHARACTER");
  });

  it("falls back to a safe section and null entity type", () => {
    const p = parseCanonProposalJson(JSON.stringify({ title: "X", section: "inventada", body: "Y", entityType: "DRAGAO" }));
    expect(p.section).toBe("visao-geral");
    expect(p.entityType).toBeNull();
  });

  it("emite aviso quando a seção devolvida pela IA é desconhecida", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseCanonProposalJson(JSON.stringify({ title: "X", section: "nao-existe", body: "Y" }));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("nao-existe"));
  });

  it("throws AI_PARSE on garbage so generateJson retries", () => {
    expect(() => parseCanonProposalJson("não é json")).toThrow(/AI_PARSE|JSON/);
  });

  it("throws when the body is empty", () => {
    expect(() => parseCanonProposalJson(JSON.stringify({ title: "X", section: "visao-geral", body: "" }))).toThrow();
  });

  it("throws when the title is empty", () => {
    expect(() => parseCanonProposalJson(JSON.stringify({ title: "", section: "visao-geral", body: "Texto." }))).toThrow();
  });

  it("throws when the title is missing", () => {
    expect(() => parseCanonProposalJson(JSON.stringify({ section: "visao-geral", body: "Texto." }))).toThrow();
  });
});

describe("parseCanonReviewJson", () => {
  it("accepts a review and normalises unknown severities", () => {
    const r = parseCanonReviewJson(JSON.stringify({
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o cerco." }, { severity: "???", message: "Nome parecido." }],
      conflictingEntryIds: ["w1", 7],
    }));
    expect(r.verdict).toBe("CONFLICT");
    expect(r.flags.map((f) => f.severity)).toEqual(["BLOCK", "INFO"]);
    expect(r.conflictingEntryIds).toEqual(["w1"]);
  });

  it("defaults to OK with no flags when the model omits them", () => {
    const r = parseCanonReviewJson(JSON.stringify({}));
    expect(r).toEqual({ verdict: "OK", flags: [], conflictingEntryIds: [] });
  });
});

describe("buildCanonReviewPrompt", () => {
  it("includes the proposal and the canon", () => {
    const { user } = buildCanonReviewPrompt(buildCanonContext(wiki), {
      title: "Sera de Vargen", section: "casas", body: "Batedora.", summary: "Batedora.",
      entityType: "CHARACTER", canonicalName: "Sera de Vargen", immutableTraits: [], houseId: "vargen",
    });
    expect(user).toContain("Sera de Vargen");
    expect(user).toContain("Casa Vargen");
  });
});
