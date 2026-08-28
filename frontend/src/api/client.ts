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
  CanonSubmission, CanonProposal, CanonReview,
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
  /** Esta Casa procurou o jogador neste turno, sem ter sido escrita antes. */
  escreveuPrimeiro?: boolean;
  /** O elenco endereçável da Casa. O orçamento acima é compartilhado por todos. */
  people: CorrespondencePerson[];
}

/** Uma proposta esperando o sim ou o não do jogador. */
export interface PactProposal {
  id: string;
  comHouseKey: string;
  resumo: string;
  turnNumber: number;
  /** Quem se ofende se este pacto for aceito, e quanto. Mostrado ANTES do sim. */
  custoPolitico?: { casa: string; amizade: number }[];
}

export interface PactRow {
  id: string;
  tipo: string;
  com: string;
  resumo: string;
  turnNumber: number;
  status?: string;
}

export interface PactsView {
  firmados: PactRow[];
  abertos: { id: string; com: string; resumo: string; turnNumber: number }[];
  historico: PactRow[];
  favores: { id: string; status: string; amount: number; reason: string; credor: string }[];
  ativos: string[];
}

export interface SpyTierView {
  level: string;
  label: string;
  quem: string;
  custoRecursos: number;
  custoRiqueza: number;
  seDerCerto: string;
  seDerErrado: string;
}

export interface SpyOperationView {
  id: string;
  /** Presente na visão do Mestre: de quem é a operação. */
  houseId?: string;
  turnNumber: number;
  question: string;
  level: string;
  targetKey: string;
  status: string;
  outcome: string | null;
  report: string;
}

export interface SpyView {
  tiers: SpyTierView[];
  operations: SpyOperationView[];
}

export interface CorrespondenceOverview {
  turnNumber: number;
  open: boolean;
  propostas?: PactProposal[];
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

/** Uma conversa entre uma Casa de jogador e uma Casa NPC, num turno. */
export interface AdminCorrespondenceThread {
  /** Verdadeiro quando foi a Casa NPC que procurou o jogador, e não o inverso. */
  mundoComecou?: boolean;
  turnNumber: number;
  houseId: string;
  houseName: string;
  toHouseKey: string;
  toName: string;
  messages: DiplomaticMessageView[];
}

export interface AdminCorrespondence {
  turnNumber: number;
  threads: AdminCorrespondenceThread[];
  facts: { id: string; text: string; turnNumber: number }[];
}

/** Uma relação direcional entre duas Casas, como o painel a recebe. */
export interface HouseRelationView {
  fromKey: string;
  toKey: string;
  amizade: number;
  comercio: number;
  favores: number;
  note: string;
  updatedAt: string;
  resumo: string;
}

export interface HouseRelationMatrix {
  seats: { key: string; name: string }[];
  relations: HouseRelationView[];
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
  /** Toda a correspondência da campanha — a visão do Mestre. */
  adminGetCorrespondence(adminToken: string): Promise<AdminCorrespondence>;
  /** Quantas Casas procuraram este jogador neste turno. Barato: roda no cabeçalho. */
  countIncomingLetters(playerToken: string): Promise<{ cartas: number; turnNumber: number }>;
  respondToPact(playerToken: string, input: { factId: string; aceitar: boolean }): Promise<{ aceito: boolean; ativo?: string; custoPolitico?: { casa: string; amizade: number }[] }>;
  listPacts(playerToken: string): Promise<PactsView>;
  listSpyOps(playerToken: string): Promise<SpyView>;
  startSpyOp(playerToken: string, input: { question: string; level: string; targetKey: string }): Promise<SpyOperationView>;
  adminListSpyOps(adminToken: string): Promise<SpyView>;
  adminResolveSpyOp(adminToken: string, input: { id: string; outcome: string; report: string }): Promise<SpyOperationView>;
  adminSendWorldLetters(adminToken: string): Promise<{ enviadas: number }>;
  adminWithdrawLetter(adminToken: string, id: string): Promise<{ id: string }>;
  adminGetRelations(adminToken: string): Promise<HouseRelationMatrix>;
  adminPutRelation(
    adminToken: string,
    input: { fromKey: string; toKey: string; amizade: number; comercio: number; favores: number; note: string },
  ): Promise<HouseRelationView>;
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
  adminPublishTurnDraft(adminToken: string): Promise<{ turnId: number; opened: boolean }>;
  adminSetTurnImageUrl(adminToken: string, kind: TurnImageKind, url: string): Promise<{ imageUrl: string }>;
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
  startProjectFromTemplate(playerToken: string, input: { templateId: string; targetHouseKey?: string | null }): Promise<ProjectCard>;
  enhanceCustomProject(playerToken: string, input: EnhanceCardInput): Promise<CustomCardDraft>;
  startCustomProject(playerToken: string, draft: CustomCardDraft): Promise<ProjectCard>;
  acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  setEnergia(playerToken: string, input: { porProjeto: Record<string, number> }): Promise<{ porProjeto: Record<string, number> }>;
  respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor>;
  adminListProjects(adminToken: string): Promise<ProjectCard[]>;
  adminApproveProject(adminToken: string, input: { projectId: string; note?: string }): Promise<ProjectCard>;
  adminRejectProject(adminToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  adminPauseProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
  adminResumeProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
  // review é anulável: se a crítica da IA falhar após a normalização, o backend
  // ainda devolve a proposta com review nulo em vez de perder o trabalho do jogador.
  playerCanonPreview(playerToken: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview | null }>;
  playerCanonUploadImage(playerToken: string, file: File): Promise<{ imageUrl: string; imageKey: string }>;
  playerCanonSubmit(playerToken: string, input: CanonSubmitInput): Promise<CanonSubmission>;
  playerCanonList(playerToken: string): Promise<CanonSubmission[]>;
  adminCanonList(adminToken: string): Promise<CanonSubmission[]>;
  adminCanonApprove(adminToken: string, input: { submissionId: string; proposal?: CanonProposal }): Promise<CanonSubmission>;
  adminCanonReject(adminToken: string, input: { submissionId: string; note: string }): Promise<CanonSubmission>;
  // O Escriba é a autoria direta do Mestre: mesma normalização de IA da prévia
  // do jogador, mas publica na hora e nunca toca em imagem.
  escribaPreview(adminToken: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview | null }>;
  escribaPublicar(adminToken: string, input: EscribaInput): Promise<CanoneEscrito>;
}

export interface EscribaInput {
  proposal: CanonProposal;
  /** Casa dona do cânone, ou null quando não pertence a nenhuma. */
  houseId: string | null;
  /**
   * Chave da tentativa de publicação. A tela a mantém até dar certo, para que
   * republicar depois de uma resposta perdida reescreva em vez de duplicar.
   */
  opId: string;
}

export interface CanoneEscrito {
  wikiEntryId: string;
  /** Null quando a proposta não pede entidade própria. */
  visualEntityId: string | null;
}

export interface CanonSubmitInput {
  rawText: string;
  rawImageUrl: string | null;
  rawImageKey: string | null;
  proposal: CanonProposal;
  /** Parecer da IA da prévia, para o Mestre ler o conflito. Anulável: a crítica é best-effort. */
  review: CanonReview | null;
}
