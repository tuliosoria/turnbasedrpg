import type { ApiClient, TurnImageKind } from "./client";
import {
  ApiError,
  type ApiErrorCode,
  type CampaignSummary,
  type CreateAccountResult,
  type CreateHouseInput,
  type AdminUpdateHouseInput,
  type LoginResult,
  type PlayerGameView,
  type SubmitOrderInput,
  type AdminDashboard,
  type ComposeTurnInput,
  type WorldBible,
  type HouseExample,
  type GalleryEntry,
} from "../types/api";
import type { TurnResult } from "@ravenloft/content";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

const API_ERROR_CODES = new Set<ApiErrorCode>([
  "ACCOUNT_EXISTS",
  "INVALID_CODE",
  "TURN_LOCKED",
  "INVALID_CARD",
  "INVALID_SPEND",
  "INVALID_CHOICE",
  "INVALID_ATTRIBUTES",
  "INVALID_BODY",
  "NO_HOUSE",
  "BAD_STATUS",
  "AI_DISABLED",
  "AI_PARSE",
  "AI_QUOTA",
  "AI_AUTH",
  "AI_ERROR",
  "IMAGE_DISABLED",
  "IMAGE_ERROR",
  "SESSION_EXPIRED",
  "NETWORK",
  "INTERNAL",
  "NOT_FOUND",
]);

function toApiErrorCode(code: string | undefined): ApiErrorCode {
  if (code && API_ERROR_CODES.has(code as ApiErrorCode)) return code as ApiErrorCode;
  return "INTERNAL";
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
      throw new ApiError(toApiErrorCode(err?.code), err?.message ?? "Erro inesperado.");
    }
    return data as T;
  }

  getCampaign(): Promise<CampaignSummary> {
    return this.request<CampaignSummary>("/api/campaign");
  }

  getHouseExample(): Promise<HouseExample> {
    return this.request<HouseExample>("/api/house-example");
  }

  async getGallery(): Promise<GalleryEntry[]> {
    const res = await this.request<{ entries: GalleryEntry[] }>("/api/gallery");
    return res.entries;
  }

  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult> {
    return this.request<CreateAccountResult>("/api/create-account", {
      method: "POST",
      body: input,
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

  submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }> {
    return this.request<{ submittedAt: string }>("/api/player/order", {
      method: "PUT",
      body: input,
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

  async adminComposeTurn(adminToken: string, input: ComposeTurnInput): Promise<void> {
    await this.request<void>("/api/admin/turn/compose", {
      method: "POST",
      body: input,
      token: adminToken,
    });
  }

  async adminOpenTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/open", { method: "POST", token: adminToken });
  }

  async adminLockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/lock", { method: "POST", token: adminToken });
  }

  async adminUnlockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/unlock", { method: "POST", token: adminToken });
  }

  async adminDraftPrivateInfo(adminToken: string): Promise<Record<string, string>> {
    const res = await this.request<{ privateInfo: Record<string, string> }>(
      "/api/admin/turn/draft-private",
      { method: "POST", token: adminToken },
    );
    return res.privateInfo;
  }

  adminDraftResolution(adminToken: string): Promise<TurnResult> {
    return this.request<TurnResult>("/api/admin/turn/draft-resolution", {
      method: "POST",
      token: adminToken,
    });
  }

  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }> {
    return this.request<{ nextTurnId: number }>("/api/admin/turn/apply", {
      method: "POST",
      body: result,
      token: adminToken,
    });
  }

  adminGenerateTurnImage(adminToken: string, kind: TurnImageKind, prompt: string): Promise<{ imageUrl: string }> {
    return this.request<{ imageUrl: string }>("/api/admin/turn/image", {
      method: "POST",
      body: { kind, prompt },
      token: adminToken,
    });
  }

  async adminDeleteTurnImage(adminToken: string, kind: TurnImageKind): Promise<void> {
    await this.request<void>("/api/admin/turn/image/delete", {
      method: "POST",
      body: { kind },
      token: adminToken,
    });
  }

  async adminCreateHouse(adminToken: string, input: CreateHouseInput): Promise<{ houseId: string; playerCode: string }> {
    return this.request<{ houseId: string; playerCode: string }>("/api/admin/house/create", {
      method: "POST",
      body: input,
      token: adminToken,
    });
  }

  async adminUpdateHouse(adminToken: string, input: AdminUpdateHouseInput): Promise<void> {
    await this.request<void>("/api/admin/house/update", {
      method: "POST",
      body: input,
      token: adminToken,
    });
  }

  adminDeleteHouse(adminToken: string, houseId: string): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>("/api/admin/house/delete", {
      method: "POST",
      body: { houseId },
      token: adminToken,
    });
  }

  adminGetWorldBible(adminToken: string): Promise<WorldBible> {
    return this.request<WorldBible>("/api/admin/world-bible", { token: adminToken });
  }

  adminResetCampaign(adminToken: string): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>("/api/admin/reset", {
      method: "POST",
      token: adminToken,
    });
  }

  async adminPutWorldBible(adminToken: string, input: { lore: string; visualDirectives: string }): Promise<void> {
    await this.request<void>("/api/admin/world-bible", {
      method: "PUT",
      body: input,
      token: adminToken,
    });
  }
}
