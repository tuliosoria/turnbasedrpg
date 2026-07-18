import type {
  CampaignSummary, HouseSummary, ClaimResult, LoginResult,
  PlayerGameView, CurrentChoice, AdminDashboard,
} from "../types/api";
import type { HouseId } from "@ravenloft/content";

export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouses(): Promise<HouseSummary[]>;
  claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  lockTurn(adminToken: string): Promise<void>;
  unlockTurn(adminToken: string): Promise<void>;
}
