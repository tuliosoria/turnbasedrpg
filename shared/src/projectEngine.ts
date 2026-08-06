import { ATTR_MIN, ATTR_MAX, STABILITY_MIN, STABILITY_MAX, houseStability } from "./types.js";
import type { House, Attributes } from "./types.js";
import type { ProjectCard, ProjectCost, FavorEffect } from "./projects.js";

export function projectSlotLimit(house: House): number {
  return house.attributes.controle >= 4 ? 2 : 1;
}

export function activeProjectCount(projects: ProjectCard[]): number {
  return projects.filter((p) => p.status === "ACTIVE" || p.status === "PAUSED").length;
}

function sumCost(costs: ProjectCost[], type: ProjectCost["type"], timing: ProjectCost["timing"]): number {
  return costs.filter((c) => c.type === type && c.timing === timing).reduce((n, c) => n + c.amount, 0);
}

export function canAffordStart(house: House, project: ProjectCard): { ok: boolean; reason?: string } {
  const wealth = sumCost(project.costs, "WEALTH", "ON_START");
  const resources = sumCost(project.costs, "RESOURCES", "ON_START");
  const stabilityCost = sumCost(project.costs, "STABILITY", "ON_START");
  const soldiers = sumCost(project.costs, "SOLDIERS_COMMITTED", "ON_START");
  const control = sumCost(project.costs, "CONTROL_COMMITTED", "ON_START");
  if (house.attributes.riqueza < wealth) return { ok: false, reason: "Riqueza insuficiente." };
  if (house.attributes.recursos < resources) return { ok: false, reason: "Recursos insuficientes." };
  if (houseStability(house) < stabilityCost) return { ok: false, reason: "Estabilidade insuficiente." };
  if (house.attributes.soldados < soldiers) return { ok: false, reason: "Soldados insuficientes." };
  if (house.attributes.controle < control) return { ok: false, reason: "Controle insuficiente." };
  return { ok: true };
}

export function applyStartCharges(house: House, project: ProjectCard): House {
  const attrs: Attributes = { ...house.attributes };
  attrs.riqueza -= sumCost(project.costs, "WEALTH", "ON_START");
  attrs.recursos -= sumCost(project.costs, "RESOURCES", "ON_START");
  const stability = clamp(houseStability(house) - sumCost(project.costs, "STABILITY", "ON_START"), STABILITY_MIN, STABILITY_MAX);
  return { ...house, attributes: attrs, stability };
}

export interface CompletionResult {
  house: House;
  favorsToCreate: FavorEffect[];
  assetsAdded: string[];
}

export function applyCompletion(house: House, project: ProjectCard): CompletionResult {
  const attrs: Attributes = { ...house.attributes };
  let stability = houseStability(house);
  for (const ch of project.completionEffects.attributeChanges) {
    if (!ch.permanent) continue;
    if (ch.attribute === "stability") {
      stability = clamp(stability + ch.amount, STABILITY_MIN, STABILITY_MAX);
    } else {
      attrs[ch.attribute] = clamp(attrs[ch.attribute] + ch.amount, ATTR_MIN, ATTR_MAX);
    }
  }
  const assetsAdded = project.completionEffects.assets;
  const assets = [...(house.assets ?? []), ...assetsAdded];
  return {
    house: { ...house, attributes: attrs, stability, assets },
    favorsToCreate: project.completionEffects.favors,
    assetsAdded,
  };
}

export interface ProcessResult {
  project: ProjectCard;
  justCompleted: boolean;
}

export function processProjectForTurn(project: ProjectCard, turnId: number): ProcessResult {
  if (project.lastProcessedTurnId === turnId) return { project, justCompleted: false };
  const turnsCompleted = project.turnsCompleted + 1;
  const completed = turnsCompleted >= project.durationTurns;
  // Status/outcome on completion is decided by the backend after the AI verdict.
  const next: ProjectCard = {
    ...project,
    turnsCompleted,
    lastProcessedTurnId: turnId,
    updatedAt: new Date().toISOString(),
  };
  return { project: next, justCompleted: completed };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
