import { describe, it, expect } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES, getTemplate } from "./projectTemplates.js";
import { isProjectCategory } from "./projects.js";

describe("DEFAULT_PROJECT_TEMPLATES", () => {
  it("has all 70 cards", () => {
    expect(DEFAULT_PROJECT_TEMPLATES).toHaveLength(70);
  });
  it("every template is structurally valid", () => {
    for (const t of DEFAULT_PROJECT_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(isProjectCategory(t.category)).toBe(true);
      expect(t.durationTurns).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(t.costs)).toBe(true);
      expect(t.completionEffects).toBeDefined();
    }
  });
  it("ids are unique", () => {
    const ids = DEFAULT_PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("encodes a permanent attribute card (Abrir uma Nova Mina → recursos +1)", () => {
    const mina = getTemplate("abrir-uma-nova-mina");
    expect(mina?.completionEffects.attributeChanges).toEqual([
      { attribute: "recursos", amount: 1, permanent: true },
    ]);
  });
  it("marks a diplomacy card as requiring target approval", () => {
    const presente = getTemplate("enviar-um-presente-cerimonial");
    expect(presente?.requiresTargetApproval).toBe(true);
  });
  it("marks Contratar a Ordem dos Três as requiring GM approval", () => {
    expect(getTemplate("contratar-a-ordem-dos-tres")?.requiresGmApproval).toBe(true);
  });
});
