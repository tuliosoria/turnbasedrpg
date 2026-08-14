import { describe, expect, it } from "vitest";
import { LEADER_PERSONAS } from "../diplomacy/leaders.js";
import { applyImpact, emptyDynamic, seedRelationsFromPersona, type NpcImpact } from "./relationship.js";

describe("seedRelationsFromPersona", () => {
  it("faz uma Casa desconfiada começar com confiança baixa e ressentimento alto", () => {
    const orc = LEADER_PERSONAS["cla-mandibula-de-osso"];
    const rel = seedRelationsFromPersona(orc);
    expect(rel["casa-solarion"].trust).toBeLessThan(40);
    expect(rel["casa-solarion"].resentment).toBeGreaterThan(50);
    // O motivo já escrito na persona vira o resumo da relação.
    expect(rel["casa-solarion"].summary).toMatch(/escraviz|passado/i);
  });

  it("faz uma Casa de confiança começar alta", () => {
    const orc = LEADER_PERSONAS["cla-mandibula-de-osso"];
    const rel = seedRelationsFromPersona(orc);
    expect(rel["casa-khazdrun"].trust).toBeGreaterThan(60);
  });
});

describe("applyImpact", () => {
  const base = emptyDynamic("casa-euralune", "brannic-euralune");

  it("aplica deltas e faz clamp em 0–100", () => {
    const impact: NpcImpact = {
      affected: true,
      relationshipChanges: { "casa-valerius": { trust: -80, fear: +90, resentment: +95 } },
    };
    const next = applyImpact({ ...base, relations: { "casa-valerius": { trust: 46, respect: 50, fear: 15, resentment: 10, obligation: 20, summary: "" } } }, impact, 4, "t");
    const rel = next.relations["casa-valerius"];
    expect(rel.trust).toBe(0); // 46 - 80, com piso em 0
    expect(rel.fear).toBe(100); // 15 + 90, com teto em 100
    expect(rel.resentment).toBe(100);
  });

  it("registra a memória com o turno de origem", () => {
    const impact: NpcImpact = { affected: true, newMemory: "Forças do rei atacaram Ninho Alto.", relationshipChanges: { "casa-valerius": { trust: -35 } } };
    const next = applyImpact(base, impact, 4, "t");
    expect(next.memory).toHaveLength(1);
    expect(next.memory[0].turnNumber).toBe(4);
    expect(next.memory[0].impact).toMatch(/trust -35/);
  });

  // Idempotência: reprocessar o mesmo turno não empilha a mesma lembrança.
  it("não duplica a memória ao reprocessar o mesmo turno", () => {
    const impact: NpcImpact = { affected: true, newMemory: "O ataque a Ninho Alto." };
    const once = applyImpact(base, impact, 4, "t");
    const twice = applyImpact(once, impact, 4, "t");
    expect(twice.memory).toHaveLength(1);
  });

  it("um NPC não afetado fica intacto", () => {
    const next = applyImpact(base, { affected: false }, 4, "t");
    expect(next).toBe(base);
  });

  it("muda objetivo, humor e lealdade quando o impacto os traz", () => {
    const impact: NpcImpact = { affected: true, objectiveChanges: "Buscar aliados contra a Coroa.", moodChange: "furioso", loyaltyChange: "hostil ao trono" };
    const next = applyImpact(base, impact, 4, "t");
    expect(next.objective).toBe("Buscar aliados contra a Coroa.");
    expect(next.mood).toBe("furioso");
    expect(next.loyalty).toBe("hostil ao trono");
  });
});
