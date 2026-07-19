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
} from "../types/api";
import type { TurnResult } from "@ravenloft/content";

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
  adminCreateHouse(adminToken: string, input: CreateHouseInput): Promise<{ houseId: string; playerCode: string }>;
  adminUpdateHouse(adminToken: string, input: AdminUpdateHouseInput): Promise<void>;
  adminDeleteHouse(adminToken: string, houseId: string): Promise<{ deleted: number }>;
  adminResetCampaign(adminToken: string): Promise<{ deleted: number }>;
  adminGetWorldBible(adminToken: string): Promise<WorldBible>;
  adminPutWorldBible(adminToken: string, input: { lore: string; visualDirectives: string }): Promise<void>;
}
