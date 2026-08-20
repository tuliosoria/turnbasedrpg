import { describe, it, expect } from "vitest";
import {
  newCanonSubmission,
  clampCanonProposal,
  CANON_TITLE_MAX,
  CANON_BODY_MAX,
  CANON_SUMMARY_MAX,
  CANON_RAW_TEXT_MAX,
  CANON_TRAIT_MAX,
  isCanonSubmissionStatus,
  CANON_VERDICTS,
  CANON_VERDICT_LABELS,
} from "./models";

describe("newCanonSubmission", () => {
  it("starts pending with no published ids", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "  Quero criar Sera, a batedora.  ",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "Sera de Vargen",
        section: "casas",
        body: "Batedora das fronteiras.",
        summary: "Batedora.",
        entityType: "CHARACTER",
        canonicalName: "Sera de Vargen",
        immutableTraits: ["cicatriz no queixo"],
        houseId: "vargen",
      },
    });
    expect(sub.status).toBe("PENDING_GM");
    expect(sub.rawText).toBe("Quero criar Sera, a batedora.");
    expect(sub.review).toBeNull();
    expect(sub.gmNote).toBe("");
    expect(sub.wikiEntryId).toBeNull();
    expect(sub.visualEntityId).toBeNull();
    expect(sub.visualAssetId).toBeNull();
    expect(sub.resolvedAt).toBeNull();
    expect(sub.createdAt).toBe(sub.updatedAt);
  });

  it("preserva o parecer da IA quando ele acompanha a submissão", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "Troque o nome do líder.",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "Novo líder de Solarion",
        section: "casas",
        body: "O líder passa a se chamar Corvo.",
        summary: "Renomeia o líder.",
        entityType: null,
        canonicalName: "Corvo",
        immutableTraits: [],
        houseId: "solarion",
      },
      review: {
        verdict: "CONFLICT",
        flags: [{ severity: "BLOCK", message: "Contradiz o nome já registrado." }],
        conflictingEntryIds: ["w-solarion"],
      },
    });
    expect(sub.review).toEqual({
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o nome já registrado." }],
      conflictingEntryIds: ["w-solarion"],
    });
  });

  it("clamps proposal text to the documented limits", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "x",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "T".repeat(CANON_TITLE_MAX + 50),
        section: "casas",
        body: "B".repeat(CANON_BODY_MAX + 50),
        summary: "S".repeat(CANON_SUMMARY_MAX + 50),
        entityType: null,
        canonicalName: "Sera",
        immutableTraits: [],
        houseId: null,
      },
    });
    expect(sub.proposal.title.length).toBe(CANON_TITLE_MAX);
    expect(sub.proposal.body.length).toBe(CANON_BODY_MAX);
    expect(sub.proposal.summary.length).toBe(CANON_SUMMARY_MAX);
  });

  it("trunca rawText ao limite documentado", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "R".repeat(CANON_RAW_TEXT_MAX + 50),
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "Sera de Vargen",
        section: "casas",
        body: "Batedora das fronteiras.",
        summary: "Batedora.",
        entityType: "CHARACTER",
        canonicalName: "Sera de Vargen",
        immutableTraits: [],
        houseId: null,
      },
    });
    expect(sub.rawText.length).toBe(CANON_RAW_TEXT_MAX);
    expect(sub.rawText.endsWith("…")).toBe(true);
  });
});

describe("clampCanonProposal", () => {
  it("trunca canonicalName ao limite de título", () => {
    const proposal = clampCanonProposal({
      title: "Sera de Vargen",
      section: "casas",
      body: "Batedora das fronteiras.",
      summary: "Batedora.",
      entityType: null,
      canonicalName: "N".repeat(CANON_TITLE_MAX + 50),
      immutableTraits: [],
      houseId: null,
    });
    expect(proposal.canonicalName.length).toBe(CANON_TITLE_MAX);
    expect(proposal.canonicalName.endsWith("…")).toBe(true);
  });

  it("trunca cada traço imutável individualmente ao limite de traço", () => {
    const proposal = clampCanonProposal({
      title: "Sera de Vargen",
      section: "casas",
      body: "Batedora das fronteiras.",
      summary: "Batedora.",
      entityType: null,
      canonicalName: "Sera de Vargen",
      immutableTraits: ["T".repeat(CANON_TRAIT_MAX + 20), "curta", "X".repeat(CANON_TRAIT_MAX + 5)],
      houseId: null,
    });
    expect(proposal.immutableTraits[0].length).toBe(CANON_TRAIT_MAX);
    expect(proposal.immutableTraits[0].endsWith("…")).toBe(true);
    expect(proposal.immutableTraits[1]).toBe("curta");
    expect(proposal.immutableTraits[2].length).toBe(CANON_TRAIT_MAX);
    expect(proposal.immutableTraits[2].endsWith("…")).toBe(true);
  });
});

describe("isCanonSubmissionStatus", () => {
  it("accepts only the three states", () => {
    expect(isCanonSubmissionStatus("PENDING_GM")).toBe(true);
    expect(isCanonSubmissionStatus("APPROVED")).toBe(true);
    expect(isCanonSubmissionStatus("REJECTED")).toBe(true);
    expect(isCanonSubmissionStatus("ACTIVE")).toBe(false);
  });
});

describe("CANON_VERDICT_LABELS", () => {
  it("has a Portuguese label for every verdict", () => {
    for (const verdict of CANON_VERDICTS) {
      expect(CANON_VERDICT_LABELS[verdict]).toBeTruthy();
    }
  });
});
