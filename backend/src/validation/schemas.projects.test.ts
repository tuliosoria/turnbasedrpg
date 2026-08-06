import { describe, it, expect } from "vitest";
import { parseStartTemplateBody, parseAnalyzeCustomBody, parseProjectIdBody, parseRevisionBody, parseFavorRespondBody, parseApproveProjectBody, parseRejectProjectBody } from "./schemas";
import { HttpError } from "../types/domain";

describe("project body parsers", () => {
  it("parseStartTemplateBody requires templateId", () => {
    expect(parseStartTemplateBody({ templateId: "abrir-uma-nova-mina" }).templateId).toBe("abrir-uma-nova-mina");
    expect(() => parseStartTemplateBody({})).toThrow(HttpError);
  });
  it("parseAnalyzeCustomBody requires request and passes optional fields", () => {
    const b = parseAnalyzeCustomBody({ request: "Muralha", riskLevel: "high", maxSpend: 3 });
    expect(b.request).toBe("Muralha");
    expect(b.riskLevel).toBe("high");
    expect(b.maxSpend).toBe(3);
    expect(() => parseAnalyzeCustomBody({})).toThrow(HttpError);
  });
  it("parseAnalyzeCustomBody rejects bad riskLevel", () => {
    expect(() => parseAnalyzeCustomBody({ request: "x", riskLevel: "insane" })).toThrow(HttpError);
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
