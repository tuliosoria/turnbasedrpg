import type { KingdomState, CardCategory, HouseId } from "@ravenloft/content";

export type TurnStatus = "OPEN" | "LOCKED";

export type ApiErrorCode =
  | "HOUSE_TAKEN"
  | "INVALID_CODE"
  | "TURN_LOCKED"
  | "INVALID_CARD"
  | "SESSION_EXPIRED"
  | "VERSION_CONFLICT"
  | "NO_PUBLISHED_TURN"
  | "NETWORK";

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
  publicState: KingdomState;
  activeTurnId: number;
  turnStatus: TurnStatus;
  contentVersion: string;
}

export interface HouseSummary {
  id: HouseId;
  name: string;
  subtitle: string;
  motto: string;
  strength: string;
  available: boolean;
}

export interface ClaimResult {
  playerCode: string;
  playerToken: string;
  houseId: HouseId;
  displayName: string;
}

export interface LoginResult {
  playerToken: string;
  houseId: HouseId;
  displayName: string;
}

export interface CardView {
  id: string;
  title: string;
  categories: CardCategory[];
  description: string;
  contribution: string;
  risk?: string;
  cost?: string;
}

export interface CurrentChoice {
  cardId: string;
  chosenAt: string;
}

export interface PreviousResult {
  publicResult: string;
  privateResult?: string;
  stateAfter: KingdomState;
  discoveries: string[];
}

export interface PlayerGameView {
  houseId: HouseId;
  houseName: string;
  houseSubtitle: string;
  privateIntroduction: string;
  displayName: string;
  kingdomState: KingdomState;
  turnId: number;
  turnTitle: string;
  publicEvent: string;
  privateInformation: string;
  cards: CardView[];
  currentChoice?: CurrentChoice;
  turnStatus: TurnStatus;
  previousResult?: PreviousResult;
}

export interface AdminChoiceRow {
  houseId: HouseId;
  houseName: string;
  claimed: boolean;
  displayName?: string;
  cardId?: string;
  cardTitle?: string;
  categories?: CardCategory[];
  chosenAt?: string;
}

export interface AdminDashboard {
  activeTurnId: number;
  turnTitle: string;
  turnStatus: TurnStatus;
  kingdomState: KingdomState;
  rows: AdminChoiceRow[];
  summaryText: string;
}
