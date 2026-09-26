import { describe, it, expect } from "vitest";
import { PROJECT_CATEGORIES, PROJECT_STATUSES, isProjectCategory, jaPagouInicio } from "./projects.js";

describe("project enums", () => {
  it("lists 8 categories", () => {
    expect(PROJECT_CATEGORIES).toHaveLength(8);
    expect(PROJECT_CATEGORIES).toContain("MILITARY");
    expect(PROJECT_CATEGORIES).toContain("MAGIC");
  });
  it("includes lifecycle statuses", () => {
    expect(PROJECT_STATUSES).toContain("ACTIVE");
    expect(PROJECT_STATUSES).toContain("PENDING_GM");
    expect(PROJECT_STATUSES).toContain("COMPLETED");
  });
  it("validates category strings", () => {
    expect(isProjectCategory("MILITARY")).toBe(true);
    expect(isProjectCategory("BANANA")).toBe(false);
  });
});

describe("jaPagouInicio", () => {
  // Cartas que ficaram ACTIVE antes de existir `inicioPago` não têm o campo,
  // e reescrita devolve a carta para aceite. Cobrar de novo foi o que tirou
  // Recursos de Solarion. Passo já andado, ou carta ainda ativa, conta como pago.
  it("trata carta que já andou ou que já está ativa como início pago", () => {
    expect(jaPagouInicio({ inicioPago: true })).toBe(true);
    expect(jaPagouInicio({ refeita: true })).toBe(true);
    expect(jaPagouInicio({ turnsCompleted: 4 })).toBe(true);
    expect(jaPagouInicio({ status: "ACTIVE", turnsCompleted: 0 })).toBe(true);
    expect(jaPagouInicio({ status: "PAUSED", turnsCompleted: 0 })).toBe(true);
  });

  it("carta nova, sem passo e sem os selos, ainda não pagou", () => {
    expect(jaPagouInicio({ status: "PENDING_PLAYER", turnsCompleted: 0 })).toBe(false);
    expect(jaPagouInicio({})).toBe(false);
  });
});
