import type {
  CampaignSummary,
  HouseExample,
  CreateHouseInput,
  CreateAccountResult,
  LoginResult,
  PlayerGameView,
  SubmitOrderInput,
  AdminDashboard,
  ComposeTurnInput,
  WorldBible,
} from "../types/api";
import type { Attributes, TurnResult } from "@ravenloft/content";

export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouseExample(): Promise<HouseExample>;
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
  adminDraftResolution(adminToken: string): Promise<TurnResult>;
  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }>;
  adminEditHouse(adminToken: string, houseId: string, attributes: Attributes): Promise<void>;
  adminGetWorldBible(adminToken: string): Promise<WorldBible>;
  adminPutWorldBible(adminToken: string, input: { lore: string; visualDirectives: string }): Promise<void>;
}
