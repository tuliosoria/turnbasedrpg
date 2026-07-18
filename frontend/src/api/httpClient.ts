import type { ApiClient } from "./client";
import {
  ApiError,
  type ApiErrorCode,
  type CampaignSummary,
  type HouseSummary,
  type ClaimResult,
  type LoginResult,
  type PlayerGameView,
  type CurrentChoice,
  type AdminDashboard,
} from "../types/api";
import type { HouseId } from "@ravenloft/content";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export class HttpApiClient implements ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError("NETWORK", "Não foi possível conectar ao servidor.");
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }

    if (!res.ok) {
      const err = data as { code?: string; message?: string } | undefined;
      const code = (err?.code ?? "NETWORK") as ApiErrorCode;
      throw new ApiError(code, err?.message ?? "Erro inesperado.");
    }
    return data as T;
  }

  getCampaign(): Promise<CampaignSummary> {
    return this.request<CampaignSummary>("/api/campaign");
  }

  getHouses(): Promise<HouseSummary[]> {
    return this.request<HouseSummary[]>("/api/houses");
  }

  claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult> {
    return this.request<ClaimResult>("/api/claim-house", {
      method: "POST",
      body: { houseId, displayName },
    });
  }

  login(playerCode: string): Promise<LoginResult> {
    return this.request<LoginResult>("/api/player/login", {
      method: "POST",
      body: { playerCode },
    });
  }

  getGame(playerToken: string): Promise<PlayerGameView> {
    return this.request<PlayerGameView>("/api/player/game", { token: playerToken });
  }

  submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice> {
    return this.request<CurrentChoice>(`/api/turns/${turnId}/choice`, {
      method: "PUT",
      body: { cardId },
      token: playerToken,
    });
  }

  adminLogin(adminCode: string): Promise<{ adminToken: string }> {
    return this.request<{ adminToken: string }>("/api/admin/login", {
      method: "POST",
      body: { adminCode },
    });
  }

  getAdminDashboard(adminToken: string): Promise<AdminDashboard> {
    return this.request<AdminDashboard>("/api/admin/dashboard", { token: adminToken });
  }

  async lockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/lock", { method: "POST", token: adminToken });
  }

  async unlockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/unlock", { method: "POST", token: adminToken });
  }
}
