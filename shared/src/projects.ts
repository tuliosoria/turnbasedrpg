import type { AttributeKey } from "./types.js";

export const PROJECT_CATEGORIES = [
  "MILITARY", "INFRASTRUCTURE", "ECONOMY", "DIPLOMACY",
  "INTELLIGENCE", "SOCIETY", "MAGIC", "EXPLORATION",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export function isProjectCategory(v: string): v is ProjectCategory {
  return (PROJECT_CATEGORIES as readonly string[]).includes(v);
}

export const PROJECT_STATUSES = [
  "DRAFT", "PENDING_AI", "PENDING_PLAYER", "PENDING_TARGET",
  "PENDING_GM", "APPROVED", "ACTIVE", "PAUSED",
  "COMPLETED", "FAILED", "CANCELLED", "REJECTED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_COST_TYPES = [
  "WEALTH", "RESOURCES", "SOLDIERS_COMMITTED", "CONTROL_COMMITTED",
  "STABILITY", "FAVOR", "CUSTOM",
] as const;
export type ProjectCostType = (typeof PROJECT_COST_TYPES)[number];

export type CostTiming = "ON_START" | "PER_TURN" | "ON_COMPLETION";

export interface ProjectCost {
  type: ProjectCostType;
  amount: number;
  timing: CostTiming;
  note?: string;
}

export type StabilityKey = "stability";
export type EffectAttribute = AttributeKey | StabilityKey;

export interface AttributeChange {
  attribute: EffectAttribute;
  amount: number;
  permanent: boolean;
  durationTurns?: number | null;
}

export interface FavorEffect {
  targetHouseId: string;
  amount: number;
  requiresAcceptance: boolean;
}

export interface CompletionEffects {
  attributeChanges: AttributeChange[];
  favors: FavorEffect[];
  assets: string[];
  qualitativeEffects: string[];
  unlocks: string[];
}

export interface ProjectCard {
  id: string;
  campaignId: string;
  houseId: string;
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  status: ProjectStatus;
  durationTurns: number;
  turnsCompleted: number;
  lastProcessedTurnId: number | null;
  costs: ProjectCost[];
  requirements: string[];
  completionEffects: CompletionEffects;
  risks: string[];
  complications: string[];
  targetHouseId: string | null;
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
  playerOriginalRequest: string | null;
  gmNotes: string | null;
  templateId: string | null;
  createdBy: "PLAYER" | "AI" | "GM";
  createdAtTurn: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  outcome?: "SUCCESS" | "FAILURE" | null;
  outcomeNarrative?: string | null;
  resolvedAt?: string | null;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  description: string;
  completionEffects: CompletionEffects;
  risks: string[];
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
}

export interface Favor {
  id: string;
  campaignId: string;
  fromHouseId: string;
  toHouseId: string;
  amount: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomProjectInput {
  request: string;
  targetHouseId?: string | null;
  desiredOutcome?: string;
  maxSpend?: number;
  riskLevel?: "low" | "medium" | "high";
}

export interface EnhanceCardInput {
  title: string;
  body: string;
  targetHouseId?: string | null;
}

export const CARD_TITLE_MAX = 80;
export const CARD_DESCRIPTION_MAX = 500;

export function clampText(v: string, max: number): string {
  const t = v.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export interface CustomCardDraft {
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  risks: string[];
  completionEffects: CompletionEffects;
  targetHouseId: string | null;
  playerOriginalRequest: string;
  playerEditedRules: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
}

export function emptyCompletionEffects(): CompletionEffects {
  return { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] };
}
