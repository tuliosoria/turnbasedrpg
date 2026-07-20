export const ATTRIBUTE_KEYS = ["riqueza", "recursos", "soldados", "controle"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const POINT_BUDGET = 10;
export const ATTR_MAX = 5;
export const ATTR_MIN = 0;

export const EMBLEM_ICONS = ["lobo", "veado", "corvo", "torre", "chama", "coroa"] as const;
export type EmblemIcon = (typeof EMBLEM_ICONS)[number];

export const EMBLEM_COLORS = ["#7f1d1d", "#1e3a5f", "#3f3f46", "#4c1d95", "#14532d", "#78350f"] as const;
export type EmblemColor = string;

export const EMBLEM_COLOR_NAMES: Record<string, string> = {
  "#7f1d1d": "Vermelho escuro",
  "#1e3a5f": "Azul marinho",
  "#3f3f46": "Cinza chumbo",
  "#4c1d95": "Roxo",
  "#14532d": "Verde escuro",
  "#78350f": "Marrom",
};

export function emblemColorName(color: string): string {
  return EMBLEM_COLOR_NAMES[color] ?? color;
}

export interface Emblem { icon: EmblemIcon; color1: EmblemColor; color2: EmblemColor; }

export interface House {
  houseId: string;
  name: string;
  motto: string;
  emblem: Emblem;
  leaderName: string;
  heirName: string;
  castleName: string;
  townsText: string;
  historyText: string;
  specialty: string;
  weakness: string;
  attributes: Attributes;
  createdAt: string;
  imageUrls?: string[];
}

export type TurnStatus = "DRAFT" | "OPEN" | "LOCKED" | "RESOLVED";

export interface TurnResult {
  publicResult: string;
  houseResults: Record<string, string>;
  attributeDeltas: Record<string, Partial<Attributes>>;
  discoveries: string[];
}

export interface Turn {
  turnId: number;
  status: TurnStatus;
  publicEvent: string;
  privateInfo: Record<string, string>;
  createdAt: string;
  result?: TurnResult;
  eventImageUrl?: string;
  resultImageUrl?: string;
}

export interface WorldBible {
  lore: string;
  visualDirectives: string;
  updatedAt: string;
}

export const CHRONICLE_MAX_TURNS = 10;

export interface Submission {
  houseId: string;
  orderText: string;
  submittedAt: string;
}

export interface HouseExample {
  name: string; motto: string; leaderName: string; heirName: string;
  castleName: string; townsText: string; historyText: string;
  specialty: string; weakness: string; attributes: Attributes;
  emblem: Emblem;
}
