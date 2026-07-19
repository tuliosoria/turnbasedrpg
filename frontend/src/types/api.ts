import type {
  House,
  Attributes,
  NarrativeCard,
  TurnStatus,
  TurnResult,
  Submission,
  HouseExample,
  Emblem,
  CardResponse,
} from "@ravenloft/content";

export type {
  House,
  Attributes,
  NarrativeCard,
  TurnStatus,
  TurnResult,
  Submission,
  HouseExample,
  Emblem,
  CardResponse,
};

export type ApiErrorCode =
  | "ACCOUNT_EXISTS"
  | "INVALID_CODE"
  | "TURN_LOCKED"
  | "INVALID_CARD"
  | "INVALID_SPEND"
  | "INVALID_CHOICE"
  | "INVALID_ATTRIBUTES"
  | "INVALID_BODY"
  | "NO_HOUSE"
  | "BAD_STATUS"
  | "AI_DISABLED"
  | "AI_PARSE"
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
}

export interface PlayerGameView {
  house: House;
  turnId: number | null;
  turnStatus: TurnStatus | null;
  publicEvent: string;
  privateInformation: string;
  cards: NarrativeCard[];
  submission: Submission | null;
  previousResult: PreviousResult | null;
}

export interface SubmitOrderInput {
  orderText: string;
  cardResponses: CardResponse[];
}

export interface AdminDashboard {
  turnId: number | null;
  turnStatus: TurnStatus | null;
  publicEvent: string;
  privateInfo: Record<string, string>;
  cards: NarrativeCard[];
  result: TurnResult | null;
  houses: House[];
  submissions: Submission[];
}

export interface ComposeTurnInput {
  publicEvent: string;
  privateInfo: Record<string, string>;
  cards: NarrativeCard[];
}

export interface WorldBible {
  lore: string;
  visualDirectives: string;
  updatedAt: string;
}
