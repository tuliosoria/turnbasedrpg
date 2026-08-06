import { describe, it, expect } from "vitest";
import { parseConsistencyReport, decideAction, EVALUATOR_SYSTEM_PROMPT } from "./evaluator";

describe("parseConsistencyReport", () => {
  it("parses a valid report", () => {
    const raw = JSON.stringify({
      overallScore: 88, styleScore: 90, characterIdentityScore: 85, architectureScore: 80, paletteScore: 92,
      violations: [{ severity: "MEDIUM", category: "identidade", description: "olhos diferentes" }],
      recommendedAction: "AUTO_CORRECT", correctionInstructions: ["ajustar cor dos olhos"],
    });
    const r = parseConsistencyReport(raw);
    expect(r.overallScore).toBe(88);
    expect(r.violations[0].severity).toBe("MEDIUM");
  });
  it("throws on malformed JSON", () => {
    expect(() => parseConsistencyReport("not json")).toThrow();
  });
});

describe("decideAction", () => {
  const base = { overallScore: 0, styleScore: 0, characterIdentityScore: 0, architectureScore: 0, paletteScore: 0, violations: [], recommendedAction: "ACCEPT" as const, correctionInstructions: [] };
  it("accepts at >= 90", () => {
    expect(decideAction({ ...base, overallScore: 95 }, false)).toBe("ACCEPT");
  });
  it("auto-corrects in 80-89", () => {
    expect(decideAction({ ...base, overallScore: 85 }, false)).toBe("AUTO_CORRECT");
  });
  it("corrective edit in 65-79", () => {
    expect(decideAction({ ...base, overallScore: 70 }, false)).toBe("CORRECTIVE_EDIT");
  });
  it("rejects below 65", () => {
    expect(decideAction({ ...base, overallScore: 40 }, false)).toBe("REJECT");
  });
  it("forces NEEDS_REVIEW on HIGH violation against a LOCKED subject", () => {
    const r = { ...base, overallScore: 95, violations: [{ severity: "HIGH" as const, category: "mapa", description: "geografia alterada" }] };
    expect(decideAction(r, true)).toBe("NEEDS_REVIEW");
  });
});

describe("EVALUATOR_SYSTEM_PROMPT", () => {
  it("asks for strict JSON scoring", () => {
    expect(EVALUATOR_SYSTEM_PROMPT).toContain("JSON");
  });
});
