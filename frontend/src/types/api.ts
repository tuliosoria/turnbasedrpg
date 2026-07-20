import type {
  House,
  Attributes,
  TurnStatus,
  TurnResult,
  Submission,
  HouseExample,
  Emblem,
  WikiEntry,
  GmEntry,
} from "@ravenloft/content";

export type {
  House,
  Attributes,
  TurnStatus,
  TurnResult,
  Submission,
  HouseExample,
  Emblem,
  WikiEntry,
  GmEntry,
};

export interface WikiEntryInput {
  section: string;
  title: string;
  body: string;
  order: number;
}

export interface GmEntryInput {
  section: string;
  title: string;
  body: string;
  order: number;
}

export type ApiErrorCode =
  | "ACCOUNT_EXISTS"
  | "INVALID_CODE"
  | "TURN_LOCKED"
  | "INVALID_ATTRIBUTES"
  | "INVALID_BODY"
  | "NO_HOUSE"
  | "BAD_STATUS"
  | "AI_DISABLED"
  | "AI_PARSE"
  | "AI_QUOTA"
  | "AI_AUTH"
  | "AI_ERROR"
  | "IMAGE_DISABLED"
  | "IMAGE_ERROR"
  | "SESSION_EXPIRED"
  | "NETWORK"
  | "INTERNAL"
  | "NOT_FOUND";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CampaignSummary {
  id: string;
  title: string;
  introduction: string;
}

export interface CreateHouseInput {
  displayName: string;
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
}

export interface AdminUpdateHouseInput {
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
}

export interface CreateAccountResult {
  playerCode: string;
  playerToken: string;
  houseId: string;
  displayName: string;
}

export interface LoginResult {
  playerToken: string;
  houseId: string;
  displayName: string;
}

export interface PreviousResult {
  publicResult?: string;
  privateResult?: string;
  discoveries: string[];
  resultImageUrl?: string;
}

export interface PlayerGameView {
  house: House;
  turnId: number | null;
  turnStatus: TurnStatus | null;
  publicEvent: string;
  eventImageUrl?: string;
  privateInformation: string;
  submission: Submission | null;
  previousResult: PreviousResult | null;
}

export interface GalleryEntry {
  turnId: number;
  publicEvent: string;
  eventImageUrl?: string;
  publicResult: string;
  resultImageUrl?: string;
}

export interface SubmitOrderInput {
  orderText: string;
}

export interface AdminDashboard {
  turnId: number | null;
  turnStatus: TurnStatus | null;
  publicEvent: string;
  eventImageUrl?: string;
  resultImageUrl?: string;
  privateInfo: Record<string, string>;
  result: TurnResult | null;
  houses: House[];
  submissions: Submission[];
}

export interface ComposeTurnInput {
  publicEvent: string;
  privateInfo: Record<string, string>;
}

export interface WorldBible {
  lore: string;
  visualDirectives: string;
  updatedAt: string;
}
