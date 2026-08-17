import { describe, it, expect } from "vitest";
import { newCanonSubmission, CANON_TITLE_MAX, CANON_BODY_MAX, CANON_SUMMARY_MAX, isCanonSubmissionStatus } from "./models";

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
});

describe("isCanonSubmissionStatus", () => {
  it("accepts only the three states", () => {
    expect(isCanonSubmissionStatus("PENDING_GM")).toBe(true);
    expect(isCanonSubmissionStatus("APPROVED")).toBe(true);
    expect(isCanonSubmissionStatus("REJECTED")).toBe(true);
    expect(isCanonSubmissionStatus("ACTIVE")).toBe(false);
  });
});
