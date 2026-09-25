import { describe, expect, it } from "vitest";
import { emptyDynamic, applyImpact } from "@ravenloft/content";
import { parseImpact } from "./impact";

// O modelo devolveu `"loyaltyChange": -10` nos turnos 9 e 10, e o `.trim()` do
// applyImpact estourou no meio do motor: todo NPC depois daquele ficou sem
// reação ao turno.
describe("parseImpact com tipos errados vindos do modelo", () => {
  it("aceita número onde devia vir texto, sem estourar ao aplicar", () => {
    const impact = parseImpact(JSON.stringify({ affected: true, loyaltyChange: -10, moodChange: { x: 1 }, newMemory: "Viu a frota." }));
    expect(impact.loyaltyChange).toBe("-10");
    expect(impact.moodChange).toBeUndefined();
    const d = applyImpact(emptyDynamic("casa-a", "npc"), impact, 10, "t");
    expect(d.memory[0].description).toBe("Viu a frota.");
  });

  it("descarta deltas que não são número e aceita número em string", () => {
    const impact = parseImpact(JSON.stringify({ affected: true, relationshipChanges: { "casa-b": { trust: "-20", fear: "muito", summary: 3 }, lixo: "x" } }));
    expect(impact.relationshipChanges).toEqual({ "casa-b": { trust: -20, summary: "3" } });
  });

  it("sem affected booleano, não é afetado", () => {
    expect(parseImpact('{"affected":"sim"}')).toEqual({ affected: false });
  });
});
