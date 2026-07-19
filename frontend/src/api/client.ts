import type {
  CampaignSummary,
  HouseExample,
  CreateHouseInput,
  CreateAccountResult,
  AdminUpdateHouseInput,
  LoginResult,
  PlayerGameView,
  SubmitOrderInput,
  AdminDashboard,
  ComposeTurnInput,
  WorldBible,
  GalleryEntry,
  WikiEntry,
  WikiEntryInput,
} from "../types/api";
import type { TurnResult } from "@ravenloft/content";

export type TurnImageKind = "event" | "result";

export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouseExample(): Promise<HouseExample>;
  getGallery(): Promise<GalleryEntry[]>;
  getWiki(): Promise<WikiEntry[]>;
  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  adminComposeTurn(adminToken: string, input: ComposeTurnInput): Promise<void>;
  adminOpenTurn(adminToken: string): Promise<void>;
  adminLockTurn(adminToken: string): Promise<void>;
  adminUnlockTurn(adminToken: string): Promise<void>;
  adminDraftPrivateInfo(adminToken: string): Promise<Record<string, string>>;
  adminDraftPublicEvent(adminToken: string): Promise<string>;
  adminDraftResolution(adminToken: string): Promise<TurnResult>;
  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }>;
  adminGenerateTurnImage(adminToken: string, kind: TurnImageKind, sceneDescription?: string): Promise<{ imageUrl: string }>;
  adminDeleteTurnImage(adminToken: string, kind: TurnImageKind): Promise<void>;
  adminCreateHouse(adminToken: string, input: CreateHouseInput): Promise<{ houseId: string; playerCode: string }>;
  adminUpdateHouse(adminToken: string, input: AdminUpdateHouseInput): Promise<void>;
  adminDeleteHouse(adminToken: string, houseId: string): Promise<{ deleted: number }>;
  adminResetCampaign(adminToken: string): Promise<{ deleted: number }>;
  adminGetWorldBible(adminToken: string): Promise<WorldBible>;
  adminPutWorldBible(adminToken: string, input: { lore: string; visualDirectives: string }): Promise<void>;
  adminListWiki(adminToken: string): Promise<WikiEntry[]>;
  adminCreateWikiEntry(adminToken: string, input: WikiEntryInput): Promise<WikiEntry>;
  adminUpdateWikiEntry(adminToken: string, entryId: string, input: WikiEntryInput): Promise<WikiEntry>;
  adminDeleteWikiEntry(adminToken: string, entryId: string): Promise<void>;
  adminSeedWiki(adminToken: string): Promise<{ seeded: number }>;
}
