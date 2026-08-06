import { describe, it, expect } from "vitest";
import { parseStartTemplateBody, parseEnhanceCardBody, parseCustomCardDraftBody, parseProjectIdBody, parseRevisionBody, parseFavorRespondBody, parseApproveProjectBody, parseRejectProjectBody } from "./schemas";
import { HttpError } from "../types/domain";

describe("project body parsers", () => {
  it("parseStartTemplateBody requires templateId", () => {
    expect(parseStartTemplateBody({ templateId: "abrir-uma-nova-mina" }).templateId).toBe("abrir-uma-nova-mina");
    expect(() => parseStartTemplateBody({})).toThrow(HttpError);
  });
  it("parseEnhanceCardBody requires title and body", () => {
    const b = parseEnhanceCardBody({ title: "Muralha", body: "Quero uma muralha na capital", targetHouseId: "casa-x" });
    expect(b.title).toBe("Muralha");
    expect(b.body).toBe("Quero uma muralha na capital");
    expect(b.targetHouseId).toBe("casa-x");
    expect(() => parseEnhanceCardBody({ title: "x" })).toThrow(HttpError);
    expect(() => parseEnhanceCardBody({ body: "x" })).toThrow(HttpError);
  });
  it("parseCustomCardDraftBody validates and clamps a full draft", () => {
    const d = parseCustomCardDraftBody({
      title: "Muralha", description: "Construir muralha", category: "INFRASTRUCTURE",
      durationTurns: 99, costs: [{ type: "RESOURCES", amount: 2, timing: "ON_COMPLETION" }],
      requirements: ["território"], risks: ["sabotagem"],
      completionEffects: { attributeChanges: [{ attribute: "controle", amount: 9, permanent: true }] },
      playerEditedRules: true, aiBalanceStatus: "BALANCED",
    });
    expect(d.durationTurns).toBe(12);
    expect(d.costs[0].timing).toBe("ON_START");
    expect(d.completionEffects.attributeChanges[0].amount).toBe(5);
    expect(d.playerEditedRules).toBe(true);
    expect(d.publicDescription).toBe("Construir muralha");
  });
  it("parseCustomCardDraftBody rejects bad category", () => {
    expect(() => parseCustomCardDraftBody({ title: "x", description: "y", category: "BOGUS", durationTurns: 3 })).toThrow(HttpError);
  });
  it("parseProjectIdBody requires projectId", () => {
    expect(parseProjectIdBody({ projectId: "p1" }).projectId).toBe("p1");
    expect(() => parseProjectIdBody({})).toThrow(HttpError);
  });
  it("parseRevisionBody requires projectId and note", () => {
    expect(parseRevisionBody({ projectId: "p1", note: "menos custo" }).note).toBe("menos custo");
    expect(() => parseRevisionBody({ projectId: "p1" })).toThrow(HttpError);
  });
  it("parseFavorRespondBody parses favorId and accept boolean", () => {
    expect(parseFavorRespondBody({ favorId: "f1", accept: true }).accept).toBe(true);
    expect(() => parseFavorRespondBody({ favorId: "f1" })).toThrow(HttpError);
  });
  it("parseApproveProjectBody requires projectId, note optional", () => {
    expect(parseApproveProjectBody({ projectId: "p1" }).projectId).toBe("p1");
  });
  it("parseRejectProjectBody requires projectId and note", () => {
    expect(parseRejectProjectBody({ projectId: "p1", note: "não" }).note).toBe("não");
    expect(() => parseRejectProjectBody({ projectId: "p1" })).toThrow(HttpError);
  });
});
