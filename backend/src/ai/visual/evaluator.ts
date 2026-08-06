import { HttpError } from "../../types/domain";
import type { ConsistencyReport } from "@ravenloft/content";

export const EVALUATOR_SYSTEM_PROMPT =
  "Você é o Verificador de Consistência Visual de Valdren. Compare a imagem gerada com as referências canônicas e a Bíblia Visual. Responda APENAS com um objeto JSON com as chaves: overallScore, styleScore, characterIdentityScore, architectureScore, paletteScore, violations (lista de {severity: LOW|MEDIUM|HIGH, category, description}), recommendedAction e correctionInstructions (lista de strings). Scores de 0 a 100.";

export function parseConsistencyReport(raw: string): ConsistencyReport {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "O verificador retornou um formato inválido.");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new HttpError(502, "AI_PARSE", "O verificador retornou um formato inválido.");
  }
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const violations = Array.isArray(obj.violations)
    ? obj.violations.map((v: any) => ({
        severity: v?.severity === "HIGH" || v?.severity === "MEDIUM" ? v.severity : "LOW",
        category: typeof v?.category === "string" ? v.category : "geral",
        description: typeof v?.description === "string" ? v.description : "",
      }))
    : [];
  return {
    overallScore: num(obj.overallScore),
    styleScore: num(obj.styleScore),
    characterIdentityScore: num(obj.characterIdentityScore),
    architectureScore: num(obj.architectureScore),
    paletteScore: num(obj.paletteScore),
    violations,
    recommendedAction: ["ACCEPT", "AUTO_CORRECT", "CORRECTIVE_EDIT", "REJECT", "NEEDS_REVIEW"].includes(obj.recommendedAction) ? obj.recommendedAction : "NEEDS_REVIEW",
    correctionInstructions: Array.isArray(obj.correctionInstructions) ? obj.correctionInstructions.filter((s: unknown) => typeof s === "string") : [],
  };
}

export type EvaluatorAction = "ACCEPT" | "AUTO_CORRECT" | "CORRECTIVE_EDIT" | "REJECT" | "NEEDS_REVIEW";

export function decideAction(report: ConsistencyReport, subjectIsLocked: boolean): EvaluatorAction {
  const hasHigh = report.violations.some((v) => v.severity === "HIGH");
  if (subjectIsLocked && hasHigh) return "NEEDS_REVIEW";
  if (report.overallScore >= 90) return "ACCEPT";
  if (report.overallScore >= 80) return "AUTO_CORRECT";
  if (report.overallScore >= 65) return "CORRECTIVE_EDIT";
  return "REJECT";
}
