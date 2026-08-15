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
  GmEntry,
  GmEntryInput,
  Emblem,
  ProjectsView,
  AiStatus,
} from "../types/api";
import type {
  TurnResult, TurnDraft, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft,
  VisualAsset, VisualEntity, VisualGeneration, CanonicalLevel, VisualStyleBible, NpcState, NpcDynamic,
} from "@ravenloft/content";

/** O que o Mestre envia ao ajustar um NPC. */
export interface NpcStateInput {
  houseKey: string;
  characterId: string;
  mood: string;
  favors: string;
  note: string;
  perceptions: Record<string, string>;
}

export type TurnImageKind = "event" | "result";

export interface CorrespondenceRecipient {
  houseKey: string;
  name: string;
  seat: string;
  days: number | null;
  band: string | null;
  sends: number;
  remaining: number;
  playerControlled: boolean;
  /** O elenco endereçável da Casa. O orçamento acima é compartilhado por todos. */
  people: CorrespondencePerson[];
}

export interface CorrespondenceOverview {
  turnNumber: number;
  open: boolean;
  entries: CorrespondenceRecipient[];
}

export interface DiplomaticMessageView {
  id: string;
  turnNumber: number;
  toHouseKey: string;
  /** Pessoa endereçada, ou null para a chancelaria da Casa. */
  toCharacterId: string | null;
  author: "PLAYER" | "AI";
  body: string;
  createdAt: string;
}

/** Uma pessoa endereçável dentro de uma Casa. */
export interface CorrespondencePerson {
  id: string;
  name: string;
  role: string;
}

export interface SendMessageResult {
  sent: DiplomaticMessageView;
  reply: DiplomaticMessageView | null;
  remaining: number;
  replyFailed: boolean;
}

export interface OrchestratedPrompt {
  compiledPrompt: string;
  enhancedBrief: string;
  canonSources: string[];
  entityName: string | null;
  warnings: string[];
}

export interface VisualGenerateInput {
  requestText: string;
  entityId?: string | null;
  /** The prompt the author reviewed and approved in the Estúdio. */
  compiledPrompt?: string;
  /** Framing intent: ESTABLISHING for a place, PORTRAIT for a face, etc. */
  assetType?: string;
}

export interface VisualContextPreview {
  operation: "GENERATE" | "EDIT";
  referenceCount: number;
  warnings: string[];
}

export interface VisualGenerationCreated {
  generationId: string;
  status: VisualGeneration["status"];
}

export interface CreateVisualEntityInput {
  canonicalName: string;
  entityType: VisualEntity["entityType"];
  publicDescription?: string;
  wikiEntryId?: string | null;
}

export type UpdateVisualEntityInput = Partial<
  Pick<
    VisualEntity,
    | "canonicalName" | "publicDescription" | "immutableTraits" | "flexibleTraits"
    | "prohibitedChanges" | "visualKeywords" | "negativeInstructions"
    | "scaleDescription" | "culturalContext" | "aliases" | "status" | "wikiEntryId"
  >
>;

export interface VisualCoverageSection {
  section: string;
  total: number;
  covered: number;
}

export interface VisualCoverage {
  totalEntries: number;
  coveredEntries: number;
  sections: VisualCoverageSection[];
  unlinkedEntities: { id: string; canonicalName: string }[];
}

export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouseExample(): Promise<HouseExample>;
  getGallery(): Promise<GalleryEntry[]>;
  getVisualGallery(): Promise<VisualAsset[]>;
  listVisualEntities(): Promise<VisualEntity[]>;
  getVisualEntity(id: string): Promise<VisualEntity>;
  getVisualEntityAssets(id: string): Promise<VisualAsset[]>;
  createVisualEntity(adminToken: string, input: CreateVisualEntityInput): Promise<VisualEntity>;
  updateVisualEntity(adminToken: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity>;
  getVisualCoverage(): Promise<VisualCoverage>;
  getCorrespondence(playerToken: string): Promise<CorrespondenceOverview>;
  getCorrespondenceThread(playerToken: string, houseKey: string): Promise<DiplomaticMessageView[]>;
  sendCorrespondence(playerToken: string, input: { toHouseKey: string; toCharacterId?: string | null; body: string }): Promise<SendMessageResult>;
  getVisualStyleBible(): Promise<VisualStyleBible>;
  updateVisualStyleBible(adminToken: string, input: Partial<Pick<VisualStyleBible,
    | "artMedium" | "renderingStyle" | "lightingRules" | "colorPalette"
    | "architectureRenderingRules" | "characterRenderingRules"
    | "prohibitedStyles" | "globalNegativeInstructions" | "referenceAssetIds">>): Promise<VisualStyleBible>;
  previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview>;
  enhanceVisualPrompt(input: { requestText: string; entityId?: string | null; assetType?: string }): Promise<OrchestratedPrompt>;
  createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated>;
  getVisualGeneration(id: string): Promise<VisualGeneration>;
  getVisualAsset(id: string): Promise<VisualAsset>;
  canonizeAsset(id: string, input?: { canonicalName?: string; entityType?: string }): Promise<{ id: string; canonicalLevel: CanonicalLevel }>;
  getWiki(): Promise<WikiEntry[]>;
  /** Crônica pública da campanha, usada para saber quem já morreu. */
  getChronicle(): Promise<string>;
  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult>;
  generateHouseImage(input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  adminComposeTurn(adminToken: string, input: ComposeTurnInput): Promise<void>;
  adminGetTurnDraft(adminToken: string): Promise<{ draft: TurnDraft | null }>;
  adminDiscardTurnDraft(adminToken: string): Promise<void>;
  adminOpenTurn(adminToken: string): Promise<void>;
  adminLockTurn(adminToken: string): Promise<void>;
  adminUnlockTurn(adminToken: string): Promise<void>;
  adminDraftPrivateInfo(adminToken: string): Promise<Record<string, string>>;
  adminDraftPublicEvent(adminToken: string): Promise<string>;
  adminDraftResolution(adminToken: string): Promise<TurnResult>;
  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }>;
  adminGenerateTurnImage(adminToken: string, kind: TurnImageKind, sceneDescription?: string): Promise<{ imageUrl: string }>;
  adminUploadTurnImage(adminToken: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }>;
  adminDeleteTurnImage(adminToken: string, kind: TurnImageKind): Promise<void>;
  adminCreateHouse(adminToken: string, input: CreateHouseInput): Promise<{ houseId: string; playerCode: string }>;
  adminUpdateHouse(adminToken: string, input: AdminUpdateHouseInput): Promise<void>;
  adminDeleteHouse(adminToken: string, houseId: string): Promise<{ deleted: number }>;
  adminResetCampaign(adminToken: string): Promise<{ deleted: number }>;
  adminAiStatus(adminToken: string): Promise<AiStatus>;
  adminGetWorldBible(adminToken: string): Promise<WorldBible>;
  adminPutWorldBible(adminToken: string, input: { lore: string; visualDirectives: string }): Promise<void>;
  adminListNpcStates(adminToken: string): Promise<NpcState[]>;
  adminPutNpcState(adminToken: string, input: NpcStateInput): Promise<NpcState>;
  adminListNpcDynamics(adminToken: string): Promise<NpcDynamic[]>;
  adminPutNpcDynamic(adminToken: string, input: NpcDynamic): Promise<NpcDynamic>;
  adminListWiki(adminToken: string): Promise<WikiEntry[]>;
  adminCreateWikiEntry(adminToken: string, input: WikiEntryInput): Promise<WikiEntry>;
  adminUpdateWikiEntry(adminToken: string, entryId: string, input: WikiEntryInput): Promise<WikiEntry>;
  adminDeleteWikiEntry(adminToken: string, entryId: string): Promise<void>;
  adminSeedWiki(adminToken: string): Promise<{ seeded: number }>;
  adminListGm(adminToken: string): Promise<GmEntry[]>;
  adminCreateGmEntry(adminToken: string, input: GmEntryInput): Promise<GmEntry>;
  adminUpdateGmEntry(adminToken: string, entryId: string, input: GmEntryInput): Promise<GmEntry>;
  adminDeleteGmEntry(adminToken: string, entryId: string): Promise<void>;
  adminSeedGm(adminToken: string): Promise<{ seeded: number }>;
  getProjects(playerToken: string): Promise<ProjectsView>;
  startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard>;
  enhanceCustomProject(playerToken: string, input: EnhanceCardInput): Promise<CustomCardDraft>;
  startCustomProject(playerToken: string, draft: CustomCardDraft): Promise<ProjectCard>;
  acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor>;
  adminListProjects(adminToken: string): Promise<ProjectCard[]>;
  adminApproveProject(adminToken: string, input: { projectId: string; note?: string }): Promise<ProjectCard>;
  adminRejectProject(adminToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  adminPauseProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
  adminResumeProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
}
