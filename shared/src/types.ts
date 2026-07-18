export type HouseId =
  | "vargen"
  | "auremont"
  | "valerius"
  | "iron-guild"
  | "pale-bell"
  | "ravens";

export type CardCategory =
  | "military"
  | "logistics"
  | "politics"
  | "administration"
  | "investigation"
  | "religion"
  | "engineering"
  | "popular-support"
  | "sacrifice";

export interface KingdomState {
  provisions: number;
  militaryStrength: number;
  unity: number;
  publicOrder: number;
  enemyKnowledge: number;
  undeadAdvance: number;
}

export interface HouseDefinition {
  id: HouseId;
  name: string;
  subtitle: string;
  motto: string;
  publicIntroduction: string;
  privateIntroduction: string;
  leaderName: string;
  strength: string;
  weakness: string;
  publicInterest: string;
  privateObjective: string;
  privateConcern: string;
}

export interface TurnCard {
  id: string;
  houseId: HouseId;
  title: string;
  categories: CardCategory[];
  description: string;
  contribution: string;
  risk?: string;
  cost?: string;
  adminTags: string[];
}

export interface HouseTurnContent {
  privateInformation: string;
  cardIds: [string, string, string];
}

export interface PublishedTurnResult {
  publicResult: string;
  stateAfter: KingdomState;
  houseResults: Partial<Record<HouseId, string>>;
  discoveries: string[];
}

export interface TurnDefinition {
  id: number;
  slug: string;
  title: string;
  publicEvent: string;
  stateBefore: KingdomState;
  houseContent: Record<HouseId, HouseTurnContent>;
  cards: TurnCard[];
  adminResolutionNotes: string;
  publishedResult?: PublishedTurnResult;
}

export interface CampaignDefinition {
  id: string;
  title: string;
  activeTurnId: number;
  introduction: string;
  initialState: KingdomState;
}

export const HOUSE_IDS: HouseId[] = [
  "vargen",
  "auremont",
  "valerius",
  "iron-guild",
  "pale-bell",
  "ravens",
];
