import { describe, it, expect } from "vitest";
import { projectSlotLimit, activeProjectCount, canAffordStart, applyStartCharges, applyCompletion, processProjectForTurn } from "./engine";
import type { House } from "@ravenloft/content";
import type { ProjectCard } from "@ravenloft/content";

function house(over: Partial<House> = {}): House {
  return {
    houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 2 }, createdAt: "", stability: 3, ...over,
  };
}

function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1", campaignId: "c", houseId: "casa-a", title: "T", description: "", publicDescription: "",
    category: "MILITARY", status: "ACTIVE", durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "", updatedAt: "", completedAt: null, ...over,
  };
}

describe("engine", () => {
  it("slot limit is 3 for every house, matching the turn energy budget", () => {
    expect(projectSlotLimit(house({ attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 3 } }))).toBe(3);
    expect(projectSlotLimit(house({ attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 4 } }))).toBe(3);
  });

  it("counts ACTIVE and PAUSED as active", () => {
    expect(activeProjectCount([project(), project({ status: "PAUSED" }), project({ status: "COMPLETED" })])).toBe(2);
  });

  it("canAffordStart rejects when wealth insufficient", () => {
    const p = project({ costs: [{ type: "WEALTH", amount: 5, timing: "ON_START" }] });
    expect(canAffordStart(house(), p).ok).toBe(false);
  });

  it("applyStartCharges deducts wealth/resources/stability", () => {
    const p = project({ costs: [
      { type: "WEALTH", amount: 1, timing: "ON_START" },
      { type: "STABILITY", amount: 1, timing: "ON_START" },
    ] });
    const next = applyStartCharges(house(), p);
    expect(next.attributes.riqueza).toBe(2);
    expect(next.stability).toBe(2);
  });

  it("applyCompletion clamps permanent attribute at 5", () => {
    const p = project({ completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] } });
    const { house: h } = applyCompletion(house({ attributes: { riqueza: 3, recursos: 3, soldados: 5, controle: 2 } }), p);
    expect(h.attributes.soldados).toBe(5);
  });

  it("applyCompletion applies stability change and collects favors + assets", () => {
    const p = project({ completionEffects: { attributeChanges: [{ attribute: "stability", amount: 1, permanent: true }], favors: [{ targetHouseId: "casa-b", amount: 1, requiresAcceptance: true }], assets: ["Hospital"], qualitativeEffects: [], unlocks: [] } });
    const r = applyCompletion(house({ stability: 3 }), p);
    expect(r.house.stability).toBe(4);
    expect(r.favorsToCreate).toHaveLength(1);
    expect(r.assetsAdded).toContain("Hospital");
  });

  it("processProjectForTurn is idempotent for the same turnId", () => {
    const p = project({ durationTurns: 2 });
    const first = processProjectForTurn(p, 5);
    expect(first.project.turnsCompleted).toBe(1);
    const again = processProjectForTurn(first.project, 5);
    expect(again.project.turnsCompleted).toBe(1);
    expect(again.justCompleted).toBe(false);
  });

  it("processProjectForTurn flags completion at duration but leaves final status to the backend verdict", () => {
    let p = project({ durationTurns: 2 });
    p = processProjectForTurn(p, 1).project;
    const done = processProjectForTurn(p, 2);
    expect(done.justCompleted).toBe(true);
    expect(done.project.turnsCompleted).toBe(2);
    expect(done.project.status).toBe("ACTIVE");
  });
});
