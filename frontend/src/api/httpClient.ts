import type {
  ApiClient,
  CreateVisualEntityInput,
  TurnImageKind,
  UpdateVisualEntityInput,
  VisualContextPreview,
  VisualCoverage,
  VisualGenerateInput,
  VisualGenerationCreated,
  OrchestratedPrompt,
  CorrespondenceOverview,
  DiplomaticMessageView,
  SendMessageResult,
} from "./client";
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
  type WikiEntry,
  type WikiEntryInput,
  type GmEntry,
  type GmEntryInput,
  type Emblem,
  type ProjectsView,
  type AiStatus,
} from "../types/api";
import type {
  TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft,
  VisualAsset, VisualEntity, VisualGeneration, CanonicalLevel, VisualStyleBible,
} from "@ravenloft/content";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

const API_ERROR_CODES = new Set<ApiErrorCode>([
  "ACCOUNT_EXISTS",
  "INVALID_CODE",
  "TURN_LOCKED",
  "INVALID_ATTRIBUTES",
  "INVALID_BODY",
  "NO_HOUSE",
  "BAD_STATUS",
  "AI_DISABLED",
  "AI_PARSE",
  "AI_QUOTA",
  "AI_AUTH",
  "AI_ERROR",
  "AI_LEAKED_PRIVATE_CONTEXT",
  "IMAGE_DISABLED",
  "IMAGE_ERROR",
  "RATE_LIMITED",
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

  private async requestForm<T>(path: string, formData: FormData, token: string): Promise<T> {
    const headers: Record<string, string> = {};
    headers["Authorization"] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: formData,
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

  async getVisualGallery(): Promise<VisualAsset[]> {
    const res = await this.request<{ entries: VisualAsset[] }>("/api/visual/gallery");
    return res.entries;
  }

  async listVisualEntities(): Promise<VisualEntity[]> {
    const res = await this.request<{ entries: VisualEntity[] }>("/api/visual/entities");
    return res.entries;
  }

  async getVisualEntity(id: string): Promise<VisualEntity> {
    return this.request<VisualEntity>(`/api/visual/entities/${encodeURIComponent(id)}`);
  }

  async getVisualEntityAssets(id: string): Promise<VisualAsset[]> {
    const res = await this.request<{ entries: VisualAsset[] }>(`/api/visual/entities/${encodeURIComponent(id)}/assets`);
    return res.entries;
  }

  async createVisualEntity(adminToken: string, input: CreateVisualEntityInput): Promise<VisualEntity> {
    return this.request<VisualEntity>("/api/visual/entities", {
      method: "POST",
      body: input,
      token: adminToken,
    });
  }

  async updateVisualEntity(adminToken: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity> {
    return this.request<VisualEntity>(`/api/visual/entities/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
      token: adminToken,
    });
  }

  async getCorrespondence(playerToken: string): Promise<CorrespondenceOverview> {
    return this.request<CorrespondenceOverview>("/api/player/correspondencia", { token: playerToken });
  }

  async getCorrespondenceThread(playerToken: string, houseKey: string): Promise<DiplomaticMessageView[]> {
    const res = await this.request<{ entries: DiplomaticMessageView[] }>(
      `/api/player/correspondencia/${encodeURIComponent(houseKey)}`, { token: playerToken },
    );
    return res.entries;
  }

  async sendCorrespondence(playerToken: string, input: { toHouseKey: string; body: string }): Promise<SendMessageResult> {
    return this.request<SendMessageResult>("/api/player/correspondencia", { method: "POST", body: input, token: playerToken });
  }

  async getVisualStyleBible(): Promise<VisualStyleBible> {
    return this.request<VisualStyleBible>("/api/visual/style-bible");
  }

  async updateVisualStyleBible(adminToken: string, input: Record<string, unknown>): Promise<VisualStyleBible> {
    return this.request<VisualStyleBible>("/api/visual/style-bible", { method: "PUT", body: input, token: adminToken });
  }

  async getVisualCoverage(): Promise<VisualCoverage> {
    return this.request<VisualCoverage>("/api/visual/coverage");
  }

  async previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview> {
    // The backend preview handler runs the shared generate-body validator, which requires a
    // non-empty requestText even though preview only uses entityId. Send a placeholder to satisfy it.
    return this.request<VisualContextPreview>("/api/visual/context/preview", {
      method: "POST",
      body: { requestText: "preview", ...input },
    });
  }

  async enhanceVisualPrompt(input: { requestText: string; entityId?: string | null; assetType?: string }): Promise<OrchestratedPrompt> {
    return this.request<OrchestratedPrompt>("/api/visual/prompts/enhance", { method: "POST", body: input });
  }

  async createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated> {
    return this.request<VisualGenerationCreated>("/api/visual/generations", { method: "POST", body: input });
  }

  async getVisualGeneration(id: string): Promise<VisualGeneration> {
    return this.request<VisualGeneration>(`/api/visual/generations/${encodeURIComponent(id)}`);
  }

  async getVisualAsset(id: string): Promise<VisualAsset> {
    return this.request<VisualAsset>(`/api/visual/assets/${encodeURIComponent(id)}`);
  }

  async canonizeAsset(id: string, input?: { canonicalName?: string; entityType?: string }): Promise<{ id: string; canonicalLevel: CanonicalLevel }> {
    return this.request<{ id: string; canonicalLevel: CanonicalLevel }>(
      `/api/visual/assets/${encodeURIComponent(id)}/canonize`,
      { method: "POST", body: input ?? {} },
    );
  }

  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult> {
    return this.request<CreateAccountResult>("/api/create-account", {
      method: "POST",
      body: input,
    });
  }

  generateHouseImage(input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }> {
    return this.request<{ image: string }>("/api/house-image/generate", {
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

  async adminDraftPublicEvent(adminToken: string): Promise<string> {
    const res = await this.request<{ publicEvent: string }>(
      "/api/admin/turn/draft-event",
      { method: "POST", token: adminToken },
    );
    return res.publicEvent;
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

  adminGenerateTurnImage(adminToken: string, kind: TurnImageKind, sceneDescription?: string): Promise<{ imageUrl: string }> {
    return this.request<{ imageUrl: string }>("/api/admin/turn/image", {
      method: "POST",
      body: { kind, sceneDescription: sceneDescription ?? "" },
      token: adminToken,
    });
  }

  adminUploadTurnImage(adminToken: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("image", file);
    return this.requestForm<{ imageUrl: string }>("/api/admin/turn/image/upload", formData, adminToken);
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

  adminAiStatus(adminToken: string): Promise<AiStatus> {
    return this.request<AiStatus>("/api/admin/ai-status", {
      method: "GET",
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

  async getWiki(): Promise<WikiEntry[]> {
    const res = await this.request<{ entries: WikiEntry[] }>("/api/wiki");
    return res.entries;
  }

  async adminListWiki(adminToken: string): Promise<WikiEntry[]> {
    const res = await this.request<{ entries: WikiEntry[] }>("/api/admin/wiki", { token: adminToken });
    return res.entries;
  }

  async adminCreateWikiEntry(adminToken: string, input: WikiEntryInput): Promise<WikiEntry> {
    const res = await this.request<{ entry: WikiEntry }>("/api/admin/wiki/create", {
      method: "POST",
      body: input,
      token: adminToken,
    });
    return res.entry;
  }

  async adminUpdateWikiEntry(adminToken: string, entryId: string, input: WikiEntryInput): Promise<WikiEntry> {
    const res = await this.request<{ entry: WikiEntry }>("/api/admin/wiki/update", {
      method: "POST",
      body: { entryId, ...input },
      token: adminToken,
    });
    return res.entry;
  }

  async adminDeleteWikiEntry(adminToken: string, entryId: string): Promise<void> {
    await this.request<void>("/api/admin/wiki/delete", {
      method: "POST",
      body: { entryId },
      token: adminToken,
    });
  }

  async adminSeedWiki(adminToken: string): Promise<{ seeded: number }> {
    return this.request<{ seeded: number }>("/api/admin/wiki/seed", {
      method: "POST",
      token: adminToken,
    });
  }

  async adminListGm(adminToken: string): Promise<GmEntry[]> {
    const res = await this.request<{ entries: GmEntry[] }>("/api/admin/gm", { token: adminToken });
    return res.entries;
  }

  async adminCreateGmEntry(adminToken: string, input: GmEntryInput): Promise<GmEntry> {
    const res = await this.request<{ entry: GmEntry }>("/api/admin/gm/create", {
      method: "POST",
      body: input,
      token: adminToken,
    });
    return res.entry;
  }

  async adminUpdateGmEntry(adminToken: string, entryId: string, input: GmEntryInput): Promise<GmEntry> {
    const res = await this.request<{ entry: GmEntry }>("/api/admin/gm/update", {
      method: "POST",
      body: { entryId, ...input },
      token: adminToken,
    });
    return res.entry;
  }

  async adminDeleteGmEntry(adminToken: string, entryId: string): Promise<void> {
    await this.request<void>("/api/admin/gm/delete", {
      method: "POST",
      body: { entryId },
      token: adminToken,
    });
  }

  async adminSeedGm(adminToken: string): Promise<{ seeded: number }> {
    return this.request<{ seeded: number }>("/api/admin/gm/seed", {
      method: "POST",
      token: adminToken,
    });
  }

  getProjects(playerToken: string): Promise<ProjectsView> {
    return this.request<ProjectsView>("/api/player/projects", { token: playerToken });
  }
  startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/start", { method: "POST", body: input, token: playerToken });
  }
  enhanceCustomProject(playerToken: string, input: EnhanceCardInput): Promise<CustomCardDraft> {
    return this.request<CustomCardDraft>("/api/player/project/enhance", { method: "POST", body: input, token: playerToken });
  }
  startCustomProject(playerToken: string, draft: CustomCardDraft): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/custom", { method: "POST", body: draft, token: playerToken });
  }
  acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/accept", { method: "POST", body: input, token: playerToken });
  }
  requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/revise", { method: "POST", body: input, token: playerToken });
  }
  submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/submit-gm", { method: "POST", body: input, token: playerToken });
  }
  cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/cancel", { method: "POST", body: input, token: playerToken });
  }
  respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor> {
    return this.request<Favor>("/api/player/favor/respond", { method: "POST", body: input, token: playerToken });
  }
  adminListProjects(adminToken: string): Promise<ProjectCard[]> {
    return this.request<ProjectCard[]>("/api/admin/projects", { token: adminToken });
  }
  adminApproveProject(adminToken: string, input: { projectId: string; note?: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/approve", { method: "POST", body: input, token: adminToken });
  }
  adminRejectProject(adminToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/reject", { method: "POST", body: input, token: adminToken });
  }
  adminPauseProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/pause", { method: "POST", body: input, token: adminToken });
  }
  adminResumeProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/resume", { method: "POST", body: input, token: adminToken });
  }
}
