import {
  ATTRIBUTE_KEYS,
  CASA_VARGEN_EXAMPLE,
  DEFAULT_WIKI_ENTRIES,
  DEFAULT_GM_ENTRIES,
  isCanonWikiSection,
  validateAttributes,
  type Attributes,
  type AttributeKey,
  type TurnAttributeChange,
  type House,
  type Submission,
  type Turn,
  type TurnResult,
  type TurnDraft,
  type TurnStatus,
  type Emblem,
  DEFAULT_PROJECT_TEMPLATES,
  getTemplate,
  projectSlotLimit,
  energiaDoTurno,
  energiaMaximaPara,
  validarAlocacao,
  activeProjectCount,
  canAffordStart,
  applyStartCharges,
  houseStability,
  recommendStarterCards,
  type ProjectCard,
  type Favor,
  type EnhanceCardInput,
  type CustomCardDraft,
  clampText,
  CARD_TITLE_MAX,
  CARD_DESCRIPTION_MAX,
  newVisualEntity,
  type CanonTrait,
  type VisualAsset,
  type VisualEntity,
  type VisualStyleBible,
  type VisualGeneration,
  type CanonicalLevel,
  type CanonSubmission,
  type CanonProposal,
  type CanonReview,
  SEATS,
  clampRelationValue,
  describeRelation,
  emptyHouseRelation,
} from "@ravenloft/content";
import {
  ApiError,
  type AdminDashboard,
  type AiStatus,
  type CampaignSummary,
  type ComposeTurnInput,
  type CreateAccountResult,
  type CreateHouseInput,
  type AdminUpdateHouseInput,
  type GalleryEntry,
  type HouseExample,
  type LoginResult,
  type PlayerGameView,
  type SubmitOrderInput,
  type WorldBible,
  type NpcState,
  type NpcDynamic,
  type WikiEntry,
  type WikiEntryInput,
  type GmEntry,
  type GmEntryInput,
  type ProjectsView,
} from "../types/api";
import type {
  ApiClient,
  CreateVisualEntityInput,
  TurnImageKind,
  UpdateVisualEntityInput,
  VisualContextPreview,
  VisualCoverage,
  VisualCoverageSection,
  VisualGenerateInput,
  OrchestratedPrompt,
  CorrespondenceOverview,
  AdminCorrespondence,
  HouseRelationMatrix,
  PactsView,
  HouseRelationView,
  AdminCorrespondenceThread,
  DiplomaticMessageView,
  SendMessageResult,
  NpcStateInput,
  VisualGenerationCreated,
  CanonSubmitInput,
  EscribaInput,
  CanoneEscrito,
} from "./client";

interface PlayerRecord {
  houseId: string;
  displayName: string;
  playerCode: string;
  playerToken: string;
}

const MOCK_RECIPIENTS = [
  { houseKey: "casa-karasoy", name: "Casa Karasoy", seat: "Ordu-Yildiz", days: 7.8, band: "PROXIMA", sends: 2, remaining: 2, playerControlled: false, people: [{ id: "selma-karasoy", name: "Selma Karasoy", role: "Herdeira" }] },
  { houseKey: "casa-rimerberg", name: "Casa Rimerberg", seat: "Rimewatch", days: 25.7, band: "EXTREMA", sends: 1, remaining: 1, playerControlled: false, people: [] },
  { houseKey: "casa-khazdrun", name: "Casa Khazdrun", seat: "Khar-Durak", days: 9, band: "DISTANTE", sends: 1, remaining: 1, playerControlled: true, people: [] },
];

const adminToken = "mock-admin-token";

function randomSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function clampAttribute(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function assertValidAttributes(attributes: Attributes): void {
  const result = validateAttributes(attributes);
  if (!result.valid) {
    throw new ApiError("INVALID_ATTRIBUTES", result.error ?? "Atributos inválidos.");
  }
}

function makeHouse(houseId: string, input: Omit<CreateHouseInput, "displayName">): House {
  return {
    houseId,
    name: input.name,
    motto: input.motto,
    emblem: input.emblem,
    leaderName: input.leaderName,
    heirName: input.heirName,
    castleName: input.castleName,
    townsText: input.townsText,
    historyText: input.historyText,
    specialty: input.specialty,
    weakness: input.weakness,
    attributes: { ...input.attributes },
    createdAt: new Date().toISOString(),
    imageUrls: input.images ?? [],
  };
}

function wikiImageFields(input: WikiEntryInput): Pick<WikiEntry, "imageUrl" | "imageUrls"> {
  const imageUrls = input.imageUrls?.length ? input.imageUrls : input.imageUrl ? [input.imageUrl] : undefined;
  const imageUrl = input.imageUrl ?? imageUrls?.[0];
  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageUrls ? { imageUrls } : {}),
  };
}

// Mirrors backend/src/validation/visualSchemas.ts so mock slugs match real ones.
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeStarterTurn(): Turn {
  return {
    turnId: 1,
    status: "OPEN",
    publicEvent:
      "A neve cobre as estradas de Baróvia, e mensageiros juram ter visto mortos caminhando ao luar.",
    privateInfo: {
      "seed-vargen": "A Casa Vargen reconhece pegadas antigas sob a neve fresca.",
    },
    createdAt: new Date().toISOString(),
  };
}

export class MockApiClient implements ApiClient {
  private houses = new Map<string, House>();
  private byToken = new Map<string, PlayerRecord>();
  private byCode = new Map<string, PlayerRecord>();
  private submissions = new Map<string, Submission>();
  private activeTurn: Turn = makeStarterTurn();
  private projects = new Map<string, ProjectCard[]>();
  private favors: Favor[] = [];
  private projectSeq = 0;
  // Chaveada por turno e Casa, como o SK ENERGY#<turno>#<casa> do backend. Sem
  // o turno na chave a alocação nunca seria limpa na virada, e o mock passaria
  // a mentir justamente sobre o que a tela promete ao jogador.
  private energia = new Map<string, Record<string, number>>();

  private chaveEnergia(houseId: string): string {
    return `${this.activeTurn.turnId}#${houseId}`;
  }
  private resolvedTurns: Array<{ turnId: number; result: TurnResult; resultImageUrl?: string }> = [];
  private galleryEntries: GalleryEntry[] = [];
  private worldBible: WorldBible = { lore: "", visualDirectives: "", updatedAt: "" };
  private turnDraft: TurnDraft | null = null;
  private npcStates: NpcState[] = [];
  private npcDynamics: NpcDynamic[] = [];
  private wikiEntries: WikiEntry[] = [];
  private canonSubmissions: CanonSubmission[] = [];
  private styleBible: VisualStyleBible = {
    campaignId: "winter-dead", version: 1, status: "ACTIVE",
    artMedium: "pintura digital cinematográfica",
    renderingStyle: "dark fantasy gótico medieval",
    lightingRules: "tons frios, névoa, neve",
    colorPalette: "tons frios e sombrios",
    architectureRenderingRules: "gótica medieval",
    characterRenderingRules: "identidade facial preservada",
    prohibitedStyles: ["anime"], globalNegativeInstructions: ["sem texto"],
    referenceAssetIds: [], createdAt: "2026-01-01T00:00:00.000Z",
  };
  private wikiSeq = 0;
  private gmEntries: GmEntry[] = [];
  private gmSeq = 0;
  private visualEntities: VisualEntity[] = [
    {
      id: "e1", campaignId: "winter-dead", entityType: "CHARACTER",
      canonicalName: "Príncipe Alic Valerius", aliases: [], slug: "alic-valerius",
      publicDescription: "O jovem herdeiro de Valdren.",
      immutableTraits: [
        { id: "t1", text: "cicatriz no olho esquerdo", source: "AUTHORED", originAssetId: null, createdAt: "" },
      ],
      wikiEntryId: null, flexibleTraits: [],
      prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "",
      culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
      status: "CANONICAL", canonicalAssetIds: ["a1"], supportingAssetIds: [], referenceSheetAssetId: null,
      mapAssetId: null, version: 1, profile: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "e2", campaignId: "winter-dead", entityType: "CITY",
      canonicalName: "Khar-Durak", aliases: [], slug: "khar-durak",
      publicDescription: "A Cidade da Montanha Viva.",
      immutableTraits: [
        { id: "t1", text: "cidade escavada na montanha viva", source: "AUTHORED", originAssetId: null, createdAt: "" },
      ],
      wikiEntryId: null, flexibleTraits: [],
      prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "",
      culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
      status: "CANONICAL", canonicalAssetIds: ["a2"], supportingAssetIds: [], referenceSheetAssetId: null,
      mapAssetId: null, version: 1, profile: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "e3", campaignId: "winter-dead", entityType: "CHARACTER",
      canonicalName: "Princesa Akumon", aliases: [], slug: "princesa-akumon",
      publicDescription: "A herdeira de Solarion, conselheira do Faraó.",
      immutableTraits: [
        { id: "t1", text: "manto solar bordado a ouro", source: "AUTHORED", originAssetId: null, createdAt: "" },
      ],
      // Um personagem publicado pelo Adicionar Canônico: é o wikiEntryId que o
      // distingue das entidades seedadas para os NPCs do Codex.
      wikiEntryId: "wiki-canon-akumon", flexibleTraits: [],
      prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "",
      culturalContext: "", houseId: "solarion-k0hc", regionId: null, parentEntityId: null, relatedEntityIds: [],
      status: "CANONICAL", canonicalAssetIds: [], supportingAssetIds: [], referenceSheetAssetId: null,
      mapAssetId: null, version: 1, profile: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  private visualAssets: VisualAsset[] = [
    {
      id: "a1", campaignId: "winter-dead", entityId: "e1", assetType: "PORTRAIT", storageKey: "k1",
      storageUrl: "https://img.test/alic.png", thumbnailStorageKey: null, thumbnailUrl: null,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c1",
      status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
      generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
      description: "Retrato do Príncipe Alic.", extractedVisualDescription: "", consistencyScore: null,
      consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a2", campaignId: "winter-dead", entityId: "e2", assetType: "ESTABLISHING", storageKey: "k2",
      storageUrl: "https://img.test/khar.png", thumbnailStorageKey: null, thumbnailUrl: null,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c2",
      status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
      generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
      description: "Vista de Khar-Durak.", extractedVisualDescription: "", consistencyScore: null,
      consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  private visualGenerations = new Map<string, VisualGeneration>();
  private visualPollCounts = new Map<string, number>();
  private visualEntitySeq = 2;
  private visualTraitSeq = 0;

  constructor() {
    this.houses.set("seed-vargen", makeHouse("seed-vargen", {
      ...CASA_VARGEN_EXAMPLE,
    }));
  }

  async getCampaign(): Promise<CampaignSummary> {
    return {
      id: "winter-dead",
      title: "Valdren",
      introduction:
        "Casas nobres isoladas pela neve precisam sobreviver a uma ameaça que retorna dos túmulos.",
    };
  }

  async getHouseExample(): Promise<HouseExample> {
    return CASA_VARGEN_EXAMPLE;
  }

  async createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult> {
    assertValidAttributes(input.attributes);
    const houseId = `house-${this.houses.size + 1}-${randomSuffix().toLowerCase()}`;
    const playerCode = `RVN-${randomSuffix()}`;
    const playerToken = `player-${randomSuffix()}-${randomSuffix()}`;
    const house = makeHouse(houseId, input);
    const record: PlayerRecord = { houseId, displayName: input.displayName, playerCode, playerToken };

    this.houses.set(houseId, house);
    this.byToken.set(playerToken, record);
    this.byCode.set(playerCode, record);
    this.activeTurn.privateInfo[houseId] = `${input.name} recebe rumores de mortos rondando ${input.castleName}.`;

    return { playerCode, playerToken, houseId, displayName: input.displayName };
  }

  async generateHouseImage(_input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }> {
    return { image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
  }

  async login(playerCode: string): Promise<LoginResult> {
    const record = this.byCode.get(playerCode);
    if (!record) throw new ApiError("INVALID_CODE", "Código inválido.");
    return {
      playerToken: record.playerToken,
      houseId: record.houseId,
      displayName: record.displayName,
    };
  }

  private requirePlayer(playerToken: string): PlayerRecord {
    const record = this.byToken.get(playerToken);
    if (!record) throw new ApiError("SESSION_EXPIRED", "Sessão expirada.");
    return record;
  }

  private requireAdmin(token: string): void {
    if (token !== adminToken) throw new ApiError("SESSION_EXPIRED", "Sessão de admin expirada.");
  }

  async getGame(playerToken: string): Promise<PlayerGameView> {
    const record = this.requirePlayer(playerToken);
    const house = this.houses.get(record.houseId);
    if (!house) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    const visibleTurn = this.activeTurn.status !== "DRAFT";
    const turnHistory = this.resolvedTurns
      .slice()
      .sort((a, b) => a.turnId - b.turnId)
      .map((entry) => {
        const snapshot = entry.result.attributeChanges;
        const attributeChanges = snapshot
          ? (snapshot[record.houseId] ?? []).map((c) => ({ key: c.key, before: c.before, after: c.after, delta: c.after - c.before }))
          : Object.entries(entry.result.attributeDeltas?.[record.houseId] ?? {})
              .filter(([, d]) => typeof d === "number" && d !== 0)
              .map(([key, d]) => ({ key: key as AttributeKey, delta: d as number }));
        return {
          turnId: entry.turnId,
          publicResult: entry.result.publicResult,
          privateResult: entry.result.houseResults[record.houseId],
          discoveries: entry.result.discoveries,
          resultImageUrl: entry.resultImageUrl,
          attributeChanges,
        };
      });

    return {
      house,
      turnId: this.activeTurn.turnId,
      turnStatus: this.activeTurn.status,
      publicEvent: visibleTurn ? this.activeTurn.publicEvent : "",
      eventImageUrl: visibleTurn ? this.activeTurn.eventImageUrl : undefined,
      privateInformation: visibleTurn ? (this.activeTurn.privateInfo[record.houseId] ?? "") : "",
      submission: this.submissions.get(record.houseId) ?? null,
      turnHistory,
    };
  }

  async submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }> {
    const record = this.requirePlayer(playerToken);
    const house = this.houses.get(record.houseId);
    if (!house) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    if (this.activeTurn.status !== "OPEN") {
      throw new ApiError("TURN_LOCKED", "O turno não está aberto para ordens.");
    }

    const submittedAt = new Date().toISOString();
    this.submissions.set(record.houseId, {
      houseId: record.houseId,
      orderText: input.orderText,
      submittedAt,
    });
    return { submittedAt };
  }

  async adminLogin(adminCode: string): Promise<{ adminToken: string }> {
    if (!adminCode.trim()) throw new ApiError("INVALID_CODE", "Código de admin inválido.");
    return { adminToken };
  }

  async getAdminDashboard(token: string): Promise<AdminDashboard> {
    this.requireAdmin(token);
    return {
      turnId: this.activeTurn.turnId,
      turnStatus: this.activeTurn.status,
      publicEvent: this.activeTurn.publicEvent,
      eventImageUrl: this.activeTurn.eventImageUrl,
      resultImageUrl: this.activeTurn.resultImageUrl,
      privateInfo: this.activeTurn.privateInfo,
      result: this.activeTurn.result ?? null,
      houses: Array.from(this.houses.values()),
      submissions: Array.from(this.submissions.values()),
    };
  }

  async adminComposeTurn(token: string, input: ComposeTurnInput): Promise<void> {
    this.requireAdmin(token);
    this.requireTurnStatus("DRAFT");
    this.activeTurn = {
      ...this.activeTurn,
      status: "DRAFT",
      publicEvent: input.publicEvent,
      privateInfo: { ...input.privateInfo },
      result: undefined,
    };
    this.submissions.clear();
  }

  async adminGetTurnDraft(token: string): Promise<{ draft: TurnDraft | null }> {
    this.requireAdmin(token);
    return { draft: this.turnDraft };
  }

  async adminDiscardTurnDraft(token: string): Promise<void> {
    this.requireAdmin(token);
    this.turnDraft = null;
  }

  async adminPublishTurnDraft(token: string): Promise<{ turnId: number; opened: boolean }> {
    this.requireAdmin(token);
    const d = this.turnDraft;
    if (d) {
      this.activeTurn = { ...this.activeTurn, publicEvent: d.publicEvent, privateInfo: { ...d.privateInfo }, status: "OPEN", ...(d.eventImageUrl ? { eventImageUrl: d.eventImageUrl } : {}) };
      this.turnDraft = null;
    }
    return { turnId: this.activeTurn.turnId ?? 0, opened: true };
  }

  async adminSetTurnImageUrl(token: string, kind: TurnImageKind, url: string): Promise<{ imageUrl: string }> {
    this.requireAdmin(token);
    if (kind === "event") this.activeTurn = { ...this.activeTurn, eventImageUrl: url };
    else this.activeTurn = { ...this.activeTurn, resultImageUrl: url };
    return { imageUrl: url };
  }

  /** Só para testes: injeta um rascunho pendente. */
  setTurnDraftForTest(draft: TurnDraft): void {
    this.turnDraft = draft;
  }

  async adminOpenTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "DRAFT", "OPEN");
  }

  async adminLockTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "OPEN", "LOCKED");
  }

  async adminUnlockTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "LOCKED", "OPEN");
  }

  private setTurnStatus(token: string, expected: TurnStatus, status: TurnStatus): void {
    this.requireAdmin(token);
    this.requireTurnStatus(expected);
    this.activeTurn = { ...this.activeTurn, status };
  }

  private requireTurnStatus(expected: TurnStatus): void {
    if (this.activeTurn.status !== expected) {
      throw new ApiError("BAD_STATUS", "Status do turno inválido para esta ação.");
    }
  }

  async adminDraftPrivateInfo(token: string): Promise<Record<string, string>> {
    this.requireAdmin(token);
    this.requireTurnStatus("DRAFT");
    return Object.fromEntries(
      Array.from(this.houses.values()).map((house) => [
        house.houseId,
        `${house.name} descobre uma trilha sob a geada que ninguém mais viu.`,
      ]),
    );
  }

  async adminDraftPublicEvent(token: string): Promise<string> {
    this.requireAdmin(token);
    this.requireTurnStatus("DRAFT");
    return "As Brumas avançam sobre o vale ao amanhecer, e um sino distante ecoa sob o gelo.";
  }

  async adminDraftResolution(token: string): Promise<TurnResult> {
    this.requireAdmin(token);
    this.requireTurnStatus("LOCKED");
    return {
      publicResult: "As Casas resistem à primeira noite, mas a neve fica mais escura.",
      houseResults: Object.fromEntries(
        Array.from(this.houses.values()).map((house) => [
          house.houseId,
          `${house.name} paga o preço de suas ordens.`,
        ]),
      ),
      attributeDeltas: Object.fromEntries(
        Array.from(this.houses.values()).map((house) => [house.houseId, { controle: 1 }]),
      ),
      discoveries: ["Os mortos seguem um sino enterrado sob a capela."],
    };
  }

  async adminApplyResolution(token: string, result: TurnResult): Promise<{ nextTurnId: number }> {
    this.requireAdmin(token);
    this.requireTurnStatus("LOCKED");
    const attributeChanges: Record<string, TurnAttributeChange[]> = {};
    for (const [houseId, delta] of Object.entries(result.attributeDeltas)) {
      const house = this.houses.get(houseId);
      if (!house) continue;
      const attributes: Attributes = { ...house.attributes };
      const changes: TurnAttributeChange[] = [];
      for (const key of ATTRIBUTE_KEYS) {
        const change = delta[key];
        if (typeof change === "number") {
          const before = attributes[key];
          const after = clampAttribute(before + change);
          attributes[key] = after;
          if (after !== before) changes.push({ key, before, after });
        }
      }
      if (changes.length > 0) attributeChanges[houseId] = changes;
      this.houses.set(houseId, { ...house, attributes });
    }

    this.resolvedTurns.push({
      turnId: this.activeTurn.turnId,
      result: { ...result, attributeChanges },
      resultImageUrl: this.activeTurn.resultImageUrl,
    });
    if (this.activeTurn.eventImageUrl || this.activeTurn.resultImageUrl) {
      this.galleryEntries.push({
        turnId: this.activeTurn.turnId,
        publicEvent: this.activeTurn.publicEvent,
        eventImageUrl: this.activeTurn.eventImageUrl,
        publicResult: result.publicResult,
        resultImageUrl: this.activeTurn.resultImageUrl,
      });
    }
    const nextTurnId = this.activeTurn.turnId + 1;
    this.activeTurn = {
      turnId: nextTurnId,
      status: "DRAFT",
      publicEvent: "",
      privateInfo: {},
      createdAt: new Date().toISOString(),
    };
    this.submissions.clear();
    return { nextTurnId };
  }

  async getGallery(): Promise<GalleryEntry[]> {
    const liveEventImageUrl = this.activeTurn.status === "DRAFT" ? undefined : this.activeTurn.eventImageUrl;
    const liveResultImageUrl =
      this.activeTurn.status === "RESOLVED" && this.activeTurn.result ? this.activeTurn.resultImageUrl : undefined;
    const live: GalleryEntry[] =
      liveEventImageUrl || liveResultImageUrl
        ? [{
            turnId: this.activeTurn.turnId,
            publicEvent: this.activeTurn.publicEvent,
            eventImageUrl: liveEventImageUrl,
            publicResult: this.activeTurn.result?.publicResult ?? "",
            resultImageUrl: liveResultImageUrl,
          }]
        : [];
    return [...this.galleryEntries, ...live];
  }

  async getVisualGallery(): Promise<VisualAsset[]> {
    return this.visualAssets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
  }

  async listVisualEntities(): Promise<VisualEntity[]> {
    return [...this.visualEntities];
  }

  async getVisualEntity(id: string): Promise<VisualEntity> {
    const e = this.visualEntities.find((x) => x.id === id);
    if (!e) throw new ApiError("NOT_FOUND", "Entidade não encontrada.");
    return e;
  }

  async getVisualEntityAssets(id: string): Promise<VisualAsset[]> {
    return this.visualAssets.filter((a) => a.entityId === id);
  }

  async createVisualEntity(_token: string, input: CreateVisualEntityInput): Promise<VisualEntity> {
    const entity = newVisualEntity({
      id: `e-${++this.visualEntitySeq}`,
      campaignId: "winter-dead",
      entityType: input.entityType,
      canonicalName: input.canonicalName,
      slug: slugify(input.canonicalName),
      publicDescription: input.publicDescription,
      wikiEntryId: input.wikiEntryId ?? null,
    });
    this.visualEntities = [...this.visualEntities, entity];
    return { ...entity };
  }

  async updateVisualEntity(_token: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity> {
    const idx = this.visualEntities.findIndex((e) => e.id === id);
    if (idx === -1) throw new ApiError("NOT_FOUND", "Entidade não encontrada.");
    const current = this.visualEntities[idx];

    // Provenance is server-owned: an existing trait keeps the source and origin
    // asset it was stored with and only its text may change; anything new is
    // AUTHORED. Mirrors updateVisualEntity in backend/src/routes/visualRoutes.ts.
    const existingById = new Map(current.immutableTraits.map((t) => [t.id, t]));
    const traits: CanonTrait[] | undefined = input.immutableTraits?.map((t) => {
      const prior = existingById.get(t.id);
      if (prior) return { ...prior, text: t.text };
      return {
        id: `t-${++this.visualTraitSeq}`,
        text: t.text,
        source: "AUTHORED" as const,
        originAssetId: null,
        createdAt: new Date().toISOString(),
      };
    });

    const updated: VisualEntity = {
      ...current,
      ...input,
      ...(traits ? { immutableTraits: traits } : {}),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.visualEntities = [
      ...this.visualEntities.slice(0, idx),
      updated,
      ...this.visualEntities.slice(idx + 1),
    ];
    return { ...updated };
  }

  private correspondence: DiplomaticMessageView[] = [];

  /** Só os pares que o Mestre tocou, como no servidor. */
  private relations = new Map<string, HouseRelationView>();

  async countIncomingLetters(playerToken: string): Promise<{ cartas: number; turnNumber: number }> {
    const rec = this.requirePlayer(playerToken);
    const porCasa = new Map<string, DiplomaticMessageView[]>();
    for (const m of this.correspondence) porCasa.set(m.toHouseKey, [...(porCasa.get(m.toHouseKey) ?? []), m]);
    let cartas = 0;
    for (const fio of porCasa.values()) if (fio[0]?.author === "AI") cartas += 1;
    void rec;
    return { cartas, turnNumber: this.activeTurn.turnId };
  }

  async respondToPact(playerToken: string, input: { factId: string; aceitar: boolean }): Promise<{ aceito: boolean; ativo?: string; custoPolitico?: { casa: string; amizade: number }[] }> {
    this.requirePlayer(playerToken);
    return { aceito: input.aceitar, ativo: input.aceitar ? "Entreposto em Raven's Cross" : undefined };
  }

  async listPacts(playerToken: string): Promise<PactsView> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId);
    return {
      firmados: [], abertos: [], historico: [],
      favores: this.favors.map((f) => ({
        id: f.id, status: f.status, amount: f.amount, reason: f.reason, credor: f.fromHouseId,
      })),
      ativos: house?.assets ?? [],
    };
  }

  async adminSendWorldLetters(token: string): Promise<{ enviadas: number }> {
    this.requireAdmin(token);
    return { enviadas: 0 };
  }

  async adminWithdrawLetter(token: string, id: string): Promise<{ id: string }> {
    this.requireAdmin(token);
    this.correspondence = this.correspondence.filter((m) => !(m.id === id && m.author === "AI"));
    return { id };
  }

  async adminGetRelations(token: string): Promise<HouseRelationMatrix> {
    this.requireAdmin(token);
    return {
      seats: SEATS.map((s) => ({ key: s.key, name: s.name })),
      relations: [...this.relations.values()],
    };
  }

  async adminPutRelation(
    token: string,
    input: { fromKey: string; toKey: string; amizade: number; comercio: number; favores: number; note: string },
  ): Promise<HouseRelationView> {
    this.requireAdmin(token);
    const saved: HouseRelationView = {
      ...emptyHouseRelation(input.fromKey, input.toKey),
      amizade: clampRelationValue(input.amizade),
      comercio: clampRelationValue(input.comercio),
      favores: clampRelationValue(input.favores),
      note: input.note,
      updatedAt: new Date().toISOString(),
      resumo: "",
    };
    saved.resumo = describeRelation(saved);
    this.relations.set(`${input.fromKey}#${input.toKey}`, saved);
    return saved;
  }


  async adminGetCorrespondence(token: string): Promise<AdminCorrespondence> {
    this.requireAdmin(token);
    const porFio = new Map<string, AdminCorrespondenceThread>();
    for (const m of this.correspondence) {
      const chave = `${m.turnNumber}#${m.toHouseKey}`;
      const fio = porFio.get(chave) ?? {
        turnNumber: m.turnNumber,
        houseId: "casa-do-jogador",
        houseName: "Casa do Jogador",
        toHouseKey: m.toHouseKey,
        toName: MOCK_RECIPIENTS.find((r) => r.houseKey === m.toHouseKey)?.name ?? m.toHouseKey,
        messages: [],
      };
      fio.messages.push(m);
      porFio.set(chave, fio);
    }
    const threads = [...porFio.values()].sort((a, b) => b.turnNumber - a.turnNumber);
    return { turnNumber: 2, threads, facts: [] };
  }

  async getCorrespondence(token: string): Promise<CorrespondenceOverview> {
    this.requirePlayer(token);
    const entries = MOCK_RECIPIENTS.map((e) => ({
      ...e,
      remaining: Math.max(0, e.sends - this.correspondence.filter((m) => m.toHouseKey === e.houseKey && m.author === "PLAYER").length),
    }));
    return { turnNumber: 2, open: true, entries };
  }

  async getCorrespondenceThread(token: string, houseKey: string): Promise<DiplomaticMessageView[]> {
    this.requirePlayer(token);
    return this.correspondence.filter((m) => m.toHouseKey === houseKey);
  }

  async sendCorrespondence(token: string, input: { toHouseKey: string; toCharacterId?: string | null; body: string }): Promise<SendMessageResult> {
    this.requirePlayer(token);
    const now = new Date().toISOString();
    const toCharacterId = input.toCharacterId ?? null;
    const sent: DiplomaticMessageView = { id: `m${this.correspondence.length + 1}`, turnNumber: 2, toHouseKey: input.toHouseKey, toCharacterId, author: "PLAYER", body: input.body, createdAt: now };
    const reply: DiplomaticMessageView = { id: `m${this.correspondence.length + 2}`, turnNumber: 2, toHouseKey: input.toHouseKey, toCharacterId, author: "AI", body: toCharacterId ? "A pessoa responde na própria voz, guardando o que esconde." : "A Casa responde com cautela e cita antigas dívidas.", createdAt: now };
    this.correspondence.push(sent, reply);
    const used = this.correspondence.filter((m) => m.toHouseKey === input.toHouseKey && m.author === "PLAYER").length;
    // O orçamento é por Casa: Rimewatch tem uma carta, Karasoy tem duas.
    const budget = MOCK_RECIPIENTS.find((r) => r.houseKey === input.toHouseKey)?.sends ?? 1;
    return { sent, reply, remaining: Math.max(0, budget - used), replyFailed: false };
  }

  async getVisualStyleBible(): Promise<VisualStyleBible> {
    return { ...this.styleBible };
  }

  async updateVisualStyleBible(token: string, input: Record<string, unknown>): Promise<VisualStyleBible> {
    this.requireAdmin(token);
    this.styleBible = {
      ...this.styleBible,
      ...(input as Partial<VisualStyleBible>),
      version: this.styleBible.version + 1,
      status: "ACTIVE",
    };
    return { ...this.styleBible };
  }

  async getVisualCoverage(): Promise<VisualCoverage> {
    const linked = new Set(
      this.visualEntities.map((e) => e.wikiEntryId).filter((id): id is string => !!id),
    );
    const bySection = new Map<string, VisualCoverageSection>();
    for (const entry of this.wikiEntries) {
      const row = bySection.get(entry.section) ?? { section: entry.section, total: 0, covered: 0 };
      row.total += 1;
      if (linked.has(entry.entryId)) row.covered += 1;
      bySection.set(entry.section, row);
    }
    return {
      totalEntries: this.wikiEntries.length,
      coveredEntries: this.wikiEntries.filter((e) => linked.has(e.entryId)).length,
      sections: [...bySection.values()],
      unlinkedEntities: this.visualEntities
        .filter((e) => !e.wikiEntryId)
        .map((e) => ({ id: e.id, canonicalName: e.canonicalName })),
    };
  }

  async previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview> {
    const has = !!input.entityId && this.visualAssets.some((a) => a.entityId === input.entityId);
    return {
      operation: has ? "EDIT" : "GENERATE",
      referenceCount: has ? 2 : 1,
      warnings: has ? ["Esta geração continua a identidade canônica existente."] : [],
    };
  }

  async enhanceVisualPrompt(input: { requestText: string; entityId?: string | null; assetType?: string }): Promise<OrchestratedPrompt> {
    const entity = input.entityId ? this.visualEntities.find((e) => e.id === input.entityId) ?? null : null;
    const canonSources = this.wikiEntries
      .filter((w) => input.requestText.toLowerCase().includes(w.title.split(/\s*[—–]\s*/)[0].toLowerCase()))
      .map((w) => w.title);
    const warnings: string[] = [];
    if (!canonSources.length) warnings.push("Nenhum verbete do cânone foi reconhecido neste pedido.");
    return {
      compiledPrompt: [
        "DIREÇÃO DE ARTE OBRIGATÓRIA — prioridade máxima:",
        "- Paleta: use EXCLUSIVAMENTE tons frios e sombrios.",
        canonSources.length ? `CÂNONE DO LOCAL:\n${canonSources.join("; ")}` : "",
        `${input.assetType === "ESTABLISHING" ? "LUGAR A RETRATAR" : "CENA A ILUSTRAR"} (${input.assetType ?? "SCENE"}):\n${input.requestText}`,
        "LEMBRETE FINAL — obrigatório:\n- A paleta permanece tons frios e sombrios.",
      ].filter(Boolean).join("\n\n"),
      enhancedBrief: `Descrição visual de: ${input.requestText}`,
      canonSources,
      entityName: entity?.canonicalName ?? null,
      warnings,
    };
  }

  async createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated> {
    const id = `g-${this.visualGenerations.size + 1}`;
    const gen: VisualGeneration = {
      id, campaignId: "winter-dead", requestedBy: "mock", requestText: input.requestText,
      enhancedRequest: "", entityId: input.entityId ?? null, assetType: (input.assetType ?? "SCENE") as VisualGeneration["assetType"], compiledPrompt: input.compiledPrompt ?? "", operationType: "GENERATE", model: "gpt-image-1",
      inputFidelity: "high", size: "1536x1024", quality: "medium", styleBibleVersion: 1, entityVersions: {},
      referenceAssetIds: [], sceneThreadId: null, outputAssetIds: [], status: "RUNNING", retryCount: 0,
      usage: null, estimatedCost: null, latencyMs: null, consistencyReport: null, error: null,
      createdAt: new Date().toISOString(), completedAt: null,
    };
    this.visualGenerations.set(id, gen);
    this.visualPollCounts.set(id, 0);
    return { generationId: id, status: gen.status };
  }

  async getVisualGeneration(id: string): Promise<VisualGeneration> {
    const gen = this.visualGenerations.get(id);
    if (!gen) throw new ApiError("NOT_FOUND", "Geração não encontrada.");
    const polls = (this.visualPollCounts.get(id) ?? 0) + 1;
    this.visualPollCounts.set(id, polls);
    if (polls >= 2 && gen.status === "RUNNING") {
      const newAsset: VisualAsset = {
        ...this.visualAssets[0], id: `gen-${id}`, entityId: gen.entityId,
        storageUrl: "https://img.test/generated.png", canonicalLevel: "DRAFT",
        description: "Imagem gerada.", generationId: id, consistencyScore: 75,
      };
      this.visualAssets = [...this.visualAssets, newAsset];
      const done: VisualGeneration = { ...gen, status: "COMPLETED", outputAssetIds: [newAsset.id], completedAt: new Date().toISOString() };
      this.visualGenerations.set(id, done);
      return done;
    }
    return gen;
  }

  async getVisualAsset(id: string): Promise<VisualAsset> {
    const asset = this.visualAssets.find((a) => a.id === id);
    if (!asset) throw new ApiError("NOT_FOUND", "Imagem não encontrada.");
    return asset;
  }

  async canonizeAsset(id: string, _input?: { canonicalName?: string; entityType?: string }): Promise<{ id: string; canonicalLevel: CanonicalLevel }> {
    const idx = this.visualAssets.findIndex((a) => a.id === id);
    if (idx === -1) throw new ApiError("NOT_FOUND", "Imagem não encontrada.");
    const updated: VisualAsset = { ...this.visualAssets[idx], canonicalLevel: "CANONICAL" };
    this.visualAssets = [...this.visualAssets.slice(0, idx), updated, ...this.visualAssets.slice(idx + 1)];
    return { id, canonicalLevel: "CANONICAL" };
  }

  async adminGenerateTurnImage(token: string, kind: TurnImageKind, sceneDescription?: string): Promise<{ imageUrl: string }> {
    this.requireAdmin(token);
    void sceneDescription;
    const imageUrl = `https://mock.images/turns/${this.activeTurn.turnId}/${kind}.png?v=${Date.now()}`;
    if (kind === "event") this.activeTurn = { ...this.activeTurn, eventImageUrl: imageUrl };
    else this.activeTurn = { ...this.activeTurn, resultImageUrl: imageUrl };
    return { imageUrl };
  }

  async adminUploadTurnImage(token: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }> {
    this.requireAdmin(token);
    const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
    const imageUrl = `https://mock.images/turns/${this.activeTurn.turnId}/${kind}.${extension}?v=${Date.now()}`;
    if (kind === "event") this.activeTurn = { ...this.activeTurn, eventImageUrl: imageUrl };
    else this.activeTurn = { ...this.activeTurn, resultImageUrl: imageUrl };
    return { imageUrl };
  }

  async adminDeleteTurnImage(token: string, kind: TurnImageKind): Promise<void> {
    this.requireAdmin(token);
    if (kind === "event") this.activeTurn = { ...this.activeTurn, eventImageUrl: undefined };
    else this.activeTurn = { ...this.activeTurn, resultImageUrl: undefined };
  }

  async adminCreateHouse(token: string, input: CreateHouseInput): Promise<{ houseId: string; playerCode: string }> {
    this.requireAdmin(token);
    const houseId = `house-${this.houses.size + 1}-${randomSuffix().toLowerCase()}`;
    const playerCode = `RVN-${randomSuffix()}`;
    const playerToken = `player-${randomSuffix()}-${randomSuffix()}`;
    const house = makeHouse(houseId, input);
    const record: PlayerRecord = { houseId, displayName: input.displayName, playerCode, playerToken };
    this.houses.set(houseId, house);
    this.byToken.set(playerToken, record);
    this.byCode.set(playerCode, record);
    return { houseId, playerCode };
  }

  async adminUpdateHouse(token: string, input: AdminUpdateHouseInput): Promise<void> {
    this.requireAdmin(token);
    const house = this.houses.get(input.houseId);
    if (!house) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    const { houseId, ...fields } = input;
    void houseId;
    this.houses.set(input.houseId, { ...house, ...fields, attributes: { ...input.attributes }, emblem: { ...input.emblem } });
  }

  async adminDeleteHouse(token: string, houseId: string): Promise<{ deleted: number }> {
    this.requireAdmin(token);
    if (!this.houses.has(houseId)) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    let deleted = 1;
    this.houses.delete(houseId);
    for (const [code, record] of this.byCode) {
      if (record.houseId === houseId) {
        this.byCode.delete(code);
        this.byToken.delete(record.playerToken);
        deleted += 1;
      }
    }
    for (const [key, submission] of this.submissions) {
      if (submission.houseId === houseId) {
        this.submissions.delete(key);
        deleted += 1;
      }
    }
    return { deleted };
  }

  async adminResetCampaign(token: string): Promise<{ deleted: number }> {
    this.requireAdmin(token);
    const deleted = this.houses.size + this.byToken.size + this.submissions.size + 1;
    this.houses.clear();
    this.byToken.clear();
    this.byCode.clear();
    this.submissions.clear();
    this.resolvedTurns = [];
    this.galleryEntries = [];
    this.activeTurn = { turnId: 1, status: "DRAFT", publicEvent: "", privateInfo: {}, createdAt: new Date().toISOString() };
    return { deleted };
  }

  async adminAiStatus(token: string): Promise<AiStatus> {
    this.requireAdmin(token);
    return { configured: true, status: "OK", model: "mock-model" };
  }

  async adminGetWorldBible(token: string): Promise<WorldBible> {
    this.requireAdmin(token);
    return { ...this.worldBible };
  }

  async adminPutWorldBible(token: string, input: { lore: string; visualDirectives: string }): Promise<void> {
    this.requireAdmin(token);
    this.worldBible = { ...input, updatedAt: new Date().toISOString() };
  }

  async adminListNpcStates(token: string): Promise<NpcState[]> {
    this.requireAdmin(token);
    return this.npcStates.map((s) => ({ ...s }));
  }

  async adminPutNpcState(token: string, input: NpcStateInput): Promise<NpcState> {
    this.requireAdmin(token);
    const state: NpcState = { ...input, updatedAt: new Date().toISOString() };
    const i = this.npcStates.findIndex((s) => s.houseKey === input.houseKey && s.characterId === input.characterId);
    if (i >= 0) this.npcStates[i] = state;
    else this.npcStates.push(state);
    return state;
  }

  async adminListNpcDynamics(token: string): Promise<NpcDynamic[]> {
    this.requireAdmin(token);
    return this.npcDynamics.map((d) => ({ ...d }));
  }

  async adminPutNpcDynamic(token: string, input: NpcDynamic): Promise<NpcDynamic> {
    this.requireAdmin(token);
    const state: NpcDynamic = { ...input, updatedAt: new Date().toISOString() };
    const i = this.npcDynamics.findIndex((d) => d.affiliation === input.affiliation && d.id === input.id);
    if (i >= 0) this.npcDynamics[i] = state;
    else this.npcDynamics.push(state);
    return state;
  }

  async getWiki(): Promise<WikiEntry[]> {
    return this.wikiEntries.map((e) => ({ ...e }));
  }

  async playerCanonPreview(token: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview | null }> {
    this.requirePlayer(token);
    const title = rawText.trim().slice(0, 60) || "Proposta sem título";
    const proposal: CanonProposal = {
      title,
      section: "casas",
      body: `${rawText.trim()}\n\n(Texto normalizado pela IA no ambiente de mock.)`,
      summary: title,
      entityType: "CHARACTER",
      canonicalName: title,
      immutableTraits: [],
      houseId: null,
    };
    return { proposal, review: this.mockCanonReview(rawText) };
  }

  // Só o ambiente de mock: um pedido que menciona "conflito" devolve um parecer
  // de conflito realista (com ids em conflito) para que a UI e o e2e exercitem
  // o caminho "o Mestre resolve conflito". Qualquer outro texto segue OK, para
  // não quebrar quem depende do caminho feliz. Um dos ids aponta para um verbete
  // que pode não existir, cobrindo a degradação graciosa no painel do Mestre.
  private mockCanonReview(rawText: string): CanonReview {
    const wantsConflict = rawText.toLowerCase().includes("conflito");
    if (!wantsConflict) return { verdict: "OK", flags: [], conflictingEntryIds: [] };
    const canonEntry = this.wikiEntries.find((e) => isCanonWikiSection(e.section));
    const conflictingEntryIds = [
      ...(canonEntry ? [canonEntry.entryId] : []),
      "wiki-removido-999",
    ];
    return {
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "A proposta contradiz um verbete já existente no cânone." }],
      conflictingEntryIds,
    };
  }

  async playerCanonUploadImage(token: string, file: File): Promise<{ imageUrl: string; imageKey: string }> {
    this.requirePlayer(token);
    const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
    const key = `canon/mock-${this.canonSubmissions.length}/original.${extension}`;
    return { imageUrl: `https://mock.images/${key}?v=${Date.now()}`, imageKey: key };
  }

  async playerCanonSubmit(token: string, input: CanonSubmitInput): Promise<CanonSubmission> {
    const player = this.requirePlayer(token);
    const now = new Date().toISOString();
    const submission: CanonSubmission = {
      id: `canon-${this.canonSubmissions.length + 1}`,
      campaignId: "winter-dead",
      houseId: player.houseId,
      authorName: player.displayName,
      rawText: input.rawText,
      rawImageUrl: input.rawImageUrl,
      rawImageKey: input.rawImageKey,
      proposal: input.proposal,
      review: input.review,
      status: "PENDING_GM",
      gmNote: "",
      wikiEntryId: null,
      visualEntityId: null,
      visualAssetId: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.canonSubmissions = [submission, ...this.canonSubmissions];
    return submission;
  }

  async playerCanonList(token: string): Promise<CanonSubmission[]> {
    const player = this.requirePlayer(token);
    return this.canonSubmissions.filter((s) => s.houseId === player.houseId);
  }

  async adminCanonList(token: string): Promise<CanonSubmission[]> {
    this.requireAdmin(token);
    return this.canonSubmissions;
  }

  async adminCanonApprove(token: string, input: { submissionId: string; proposal?: CanonProposal }): Promise<CanonSubmission> {
    this.requireAdmin(token);
    const found = this.canonSubmissions.find((s) => s.id === input.submissionId);
    if (!found) throw new ApiError("NOT_FOUND", "Proposta não encontrada.");
    const proposal = input.proposal ?? found.proposal;
    const entryId = `wiki-${++this.wikiSeq}`;
    this.wikiEntries = [
      ...this.wikiEntries,
      { entryId, section: proposal.section, title: proposal.title, body: proposal.body, order: 999, updatedAt: new Date().toISOString() },
    ];
    const now = new Date().toISOString();
    const updated: CanonSubmission = { ...found, proposal, status: "APPROVED", wikiEntryId: entryId, resolvedAt: now, updatedAt: now };
    this.canonSubmissions = this.canonSubmissions.map((s) => (s.id === updated.id ? updated : s));
    return updated;
  }

  async escribaPreview(token: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview | null }> {
    this.requireAdmin(token);
    const title = rawText.trim().slice(0, 60) || "Proposta sem título";
    return {
      proposal: {
        title,
        section: "casas",
        body: `${rawText.trim()}\n\n(Texto normalizado pela IA no ambiente de mock.)`,
        summary: title,
        entityType: "CHARACTER",
        canonicalName: title,
        immutableTraits: [],
        houseId: null,
      },
      review: this.mockCanonReview(rawText),
    };
  }

  async escribaPublicar(token: string, input: EscribaInput): Promise<CanoneEscrito> {
    this.requireAdmin(token);
    const { proposal } = input;
    if (!isCanonWikiSection(proposal.section)) {
      throw new ApiError("INVALID_BODY", `Seção "${proposal.section}" é fora do cânone.`);
    }
    const entryId = `wiki-${++this.wikiSeq}`;
    this.wikiEntries = [
      ...this.wikiEntries,
      { entryId, section: proposal.section, title: proposal.title, body: proposal.body, order: 999, updatedAt: new Date().toISOString() },
    ];
    return { wikiEntryId: entryId, visualEntityId: proposal.entityType ? `ent-${entryId}` : null };
  }

  async adminCanonReject(token: string, input: { submissionId: string; note: string }): Promise<CanonSubmission> {
    this.requireAdmin(token);
    const note = (input.note ?? "").trim();
    if (!note) throw new ApiError("INVALID_BODY", "A recusa exige uma nota para o jogador.");
    const found = this.canonSubmissions.find((s) => s.id === input.submissionId);
    if (!found) throw new ApiError("NOT_FOUND", "Proposta não encontrada.");
    const now = new Date().toISOString();
    const updated: CanonSubmission = { ...found, status: "REJECTED", gmNote: note, resolvedAt: now, updatedAt: now };
    this.canonSubmissions = this.canonSubmissions.map((s) => (s.id === updated.id ? updated : s));
    return updated;
  }

  async getChronicle(): Promise<string> {
    return this.resolvedTurns
      .map((t) => t.result.publicResult)
      .concat(this.activeTurn.publicEvent ?? [])
      .join("\n\n");
  }

  async adminListWiki(token: string): Promise<WikiEntry[]> {
    this.requireAdmin(token);
    return this.wikiEntries.map((e) => ({ ...e }));
  }

  async adminCreateWikiEntry(token: string, input: WikiEntryInput): Promise<WikiEntry> {
    this.requireAdmin(token);
    const entry: WikiEntry = {
      entryId: `wiki-${++this.wikiSeq}`,
      section: input.section,
      title: input.title,
      body: input.body,
      order: input.order,
      updatedAt: new Date().toISOString(),
      ...wikiImageFields(input),
    };
    this.wikiEntries.push(entry);
    return { ...entry };
  }

  async adminUpdateWikiEntry(token: string, entryId: string, input: WikiEntryInput): Promise<WikiEntry> {
    this.requireAdmin(token);
    const idx = this.wikiEntries.findIndex((e) => e.entryId === entryId);
    if (idx === -1) throw new ApiError("INVALID_BODY", "Entrada não encontrada.");
    const entry: WikiEntry = {
      entryId,
      section: input.section,
      title: input.title,
      body: input.body,
      order: input.order,
      updatedAt: new Date().toISOString(),
      ...wikiImageFields(input),
    };
    this.wikiEntries[idx] = entry;
    return { ...entry };
  }

  async adminDeleteWikiEntry(token: string, entryId: string): Promise<void> {
    this.requireAdmin(token);
    this.wikiEntries = this.wikiEntries.filter((e) => e.entryId !== entryId);
  }

  async adminSeedWiki(token: string): Promise<{ seeded: number }> {
    this.requireAdmin(token);
    if (this.wikiEntries.length > 0) return { seeded: 0 };
    const now = new Date().toISOString();
    for (const def of DEFAULT_WIKI_ENTRIES) {
      this.wikiEntries.push({
        entryId: `wiki-${++this.wikiSeq}`,
        section: def.section,
        title: def.title,
        body: def.body,
        order: def.order,
        updatedAt: now,
        ...wikiImageFields(def),
      });
    }
    return { seeded: DEFAULT_WIKI_ENTRIES.length };
  }

  async adminListGm(token: string): Promise<GmEntry[]> {
    this.requireAdmin(token);
    return this.gmEntries.map((e) => ({ ...e }));
  }

  async adminCreateGmEntry(token: string, input: GmEntryInput): Promise<GmEntry> {
    this.requireAdmin(token);
    const entry: GmEntry = {
      entryId: `gm-${++this.gmSeq}`,
      section: input.section,
      title: input.title,
      body: input.body,
      order: input.order,
      updatedAt: new Date().toISOString(),
    };
    this.gmEntries.push(entry);
    return { ...entry };
  }

  async adminUpdateGmEntry(token: string, entryId: string, input: GmEntryInput): Promise<GmEntry> {
    this.requireAdmin(token);
    const idx = this.gmEntries.findIndex((e) => e.entryId === entryId);
    if (idx === -1) throw new ApiError("INVALID_BODY", "Entrada não encontrada.");
    const entry: GmEntry = { entryId, ...input, updatedAt: new Date().toISOString() };
    this.gmEntries[idx] = entry;
    return { ...entry };
  }

  async adminDeleteGmEntry(token: string, entryId: string): Promise<void> {
    this.requireAdmin(token);
    this.gmEntries = this.gmEntries.filter((e) => e.entryId !== entryId);
  }

  async adminSeedGm(token: string): Promise<{ seeded: number }> {
    this.requireAdmin(token);
    if (this.gmEntries.length > 0) return { seeded: 0 };
    const now = new Date().toISOString();
    for (const def of DEFAULT_GM_ENTRIES) {
      this.gmEntries.push({ entryId: `gm-${++this.gmSeq}`, ...def, updatedAt: now });
    }
    return { seeded: DEFAULT_GM_ENTRIES.length };
  }

  async getProjects(playerToken: string): Promise<ProjectsView> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const cartas = this.projects.get(rec.houseId) ?? [];
    return {
      templates: DEFAULT_PROJECT_TEMPLATES,
      recommended: recommendStarterCards(house).map((t) => t.id),
      projects: cartas,
      favors: this.favors.filter((f) => f.toHouseId === rec.houseId && f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
      attributes: house.attributes,
      energia: {
        total: energiaDoTurno(cartas),
        porProjeto: this.energia.get(this.chaveEnergia(rec.houseId)) ?? {},
        tetoPorProjeto: Object.fromEntries(
          cartas.filter((p) => p.status === "ACTIVE").map((p) => [p.id, energiaMaximaPara(p)]),
        ),
        distribuiu: this.energia.has(this.chaveEnergia(rec.houseId)),
      },
    };
  }

  async startProjectFromTemplate(playerToken: string, input: { templateId: string; targetHouseKey?: string | null }): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const t = getTemplate(input.templateId);
    if (!t) throw new ApiError("NOT_FOUND", "Modelo não encontrado.");
    const list = this.projects.get(rec.houseId) ?? [];
    if (activeProjectCount(list) >= projectSlotLimit(house)) throw new ApiError("BAD_STATUS", "Limite de projetos ativos atingido.");
    const now = new Date().toISOString();
    const card: ProjectCard = {
      id: `proj-${++this.projectSeq}`, campaignId: "winter-dead", houseId: rec.houseId, title: t.title,
      description: t.description, publicDescription: t.description, category: t.category, status: "DRAFT",
      durationTurns: t.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null, costs: t.costs,
      requirements: t.requirements, completionEffects: t.completionEffects, risks: t.risks, complications: [],
      targetHouseId: null, requiresTargetApproval: t.requiresTargetApproval, requiresGmApproval: t.requiresGmApproval,
      aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: t.id,
      createdBy: "PLAYER", createdAtTurn: this.activeTurn.turnId, createdAt: now, updatedAt: now, completedAt: null,
    };
    if (t.requiresGmApproval) card.status = "PENDING_GM";
    else if (t.requiresTargetApproval) {
      if (!input.targetHouseKey) throw new ApiError("INVALID_BODY", "Escolha a Casa com quem esta carta é feita.");
      card.targetHouseId = input.targetHouseKey;
      card.status = "PENDING_TARGET";
    }
    else {
      const afford = canAffordStart(house, card);
      if (!afford.ok) throw new ApiError("BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
      const charged = applyStartCharges(house, card);
      this.houses.set(rec.houseId, charged);
      card.status = "ACTIVE";
    }
    this.projects.set(rec.houseId, [...list, card]);
    return card;
  }

  async enhanceCustomProject(playerToken: string, input: EnhanceCardInput): Promise<CustomCardDraft> {
    this.requirePlayer(playerToken);
    const title = clampText(input.title || "Projeto da Casa", CARD_TITLE_MAX);
    const description = clampText(input.body, CARD_DESCRIPTION_MAX);
    return {
      title,
      description,
      publicDescription: description,
      category: "INFRASTRUCTURE",
      durationTurns: 3,
      costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }],
      requirements: [],
      risks: ["A execução pode atrair atenção indesejada."],
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["Efeito proposto pela IA."], unlocks: [] },
      targetHouseId: input.targetHouseId ?? null,
      playerOriginalRequest: input.body,
      playerEditedRules: false,
      aiBalanceStatus: "BALANCED",
      aiBalanceExplanation: "Proposta simulada equilibrada.",
    };
  }

  async startCustomProject(playerToken: string, draft: CustomCardDraft): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const now = new Date().toISOString();
    const card: ProjectCard = {
      id: `proj-${++this.projectSeq}`, campaignId: "winter-dead", houseId: rec.houseId,
      title: draft.title, description: draft.description, publicDescription: draft.publicDescription,
      category: draft.category, status: "DRAFT", durationTurns: draft.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null,
      costs: draft.costs, requirements: draft.requirements, completionEffects: draft.completionEffects, risks: draft.risks, complications: [],
      targetHouseId: draft.targetHouseId, requiresTargetApproval: !!draft.targetHouseId, requiresGmApproval: draft.playerEditedRules,
      aiBalanceStatus: draft.aiBalanceStatus, aiBalanceExplanation: draft.aiBalanceExplanation,
      playerOriginalRequest: draft.playerOriginalRequest, gmNotes: null, templateId: null, createdBy: "PLAYER",
      createdAtTurn: this.activeTurn.turnId, createdAt: now, updatedAt: now, completedAt: null,
    };
    const list = this.projects.get(rec.houseId) ?? [];
    if (draft.playerEditedRules) card.status = "PENDING_GM";
    else if (draft.targetHouseId) card.status = "PENDING_TARGET";
    else {
      if (activeProjectCount(list) >= projectSlotLimit(house)) throw new ApiError("BAD_STATUS", "Limite de projetos ativos atingido.");
      const afford = canAffordStart(house, card);
      if (!afford.ok) throw new ApiError("BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
      this.houses.set(rec.houseId, applyStartCharges(house, card));
      card.status = "ACTIVE";
    }
    this.projects.set(rec.houseId, [...list, card]);
    return card;
  }

  private mutateProject(playerToken: string, projectId: string, fn: (p: ProjectCard) => void): ProjectCard {
    const rec = this.requirePlayer(playerToken);
    const list = this.projects.get(rec.houseId) ?? [];
    const p = list.find((x) => x.id === projectId);
    if (!p) throw new ApiError("NOT_FOUND", "Projeto não encontrado.");
    fn(p);
    p.updatedAt = new Date().toISOString();
    this.projects.set(rec.houseId, [...list]);
    return p;
  }

  async acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    return this.mutateProject(playerToken, input.projectId, (p) => {
      if (p.requiresGmApproval) p.status = "PENDING_GM";
      else if (p.requiresTargetApproval) p.status = "PENDING_TARGET";
      else {
        const list = this.projects.get(rec.houseId) ?? [];
        if (activeProjectCount(list) >= projectSlotLimit(house)) throw new ApiError("BAD_STATUS", "Limite de projetos ativos atingido.");
        const afford = canAffordStart(house, p);
        if (!afford.ok) throw new ApiError("BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
        this.houses.set(rec.houseId, applyStartCharges(house, p));
        p.status = "ACTIVE";
      }
    });
  }

  async requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "PENDING_PLAYER"; p.aiBalanceExplanation = `Ajustado: ${input.note}`; });
  }

  async submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "PENDING_GM"; });
  }

  async cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "CANCELLED"; });
  }

  async setEnergia(playerToken: string, input: { porProjeto: Record<string, number> }): Promise<{ porProjeto: Record<string, number> }> {
    const rec = this.requirePlayer(playerToken);
    const cartas = this.projects.get(rec.houseId) ?? [];
    const conferido = validarAlocacao(input.porProjeto, cartas);
    if (!conferido.ok) throw new ApiError("BAD_STATUS", conferido.motivo ?? "Alocação inválida.");
    this.energia.set(this.chaveEnergia(rec.houseId), input.porProjeto);
    return { porProjeto: input.porProjeto };
  }

  async respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor> {
    const rec = this.requirePlayer(playerToken);
    const favor = this.favors.find((f) => f.id === input.favorId && f.toHouseId === rec.houseId);
    if (!favor) throw new ApiError("NOT_FOUND", "Favor não encontrado.");
    favor.status = input.accept ? "ACCEPTED" : "DECLINED";
    favor.updatedAt = new Date().toISOString();
    return favor;
  }

  async adminListProjects(adminTokenArg: string): Promise<ProjectCard[]> {
    this.requireAdmin(adminTokenArg);
    return Array.from(this.projects.values()).flat();
  }

  private mutateAnyProject(projectId: string, fn: (p: ProjectCard) => void): ProjectCard {
    for (const [houseId, list] of this.projects.entries()) {
      const p = list.find((x) => x.id === projectId);
      if (p) { fn(p); p.updatedAt = new Date().toISOString(); this.projects.set(houseId, [...list]); return p; }
    }
    throw new ApiError("NOT_FOUND", "Projeto não encontrado.");
  }

  async adminApproveProject(adminTokenArg: string, input: { projectId: string; note?: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "ACTIVE"; if (input.note) p.gmNotes = input.note; });
  }
  async adminRejectProject(adminTokenArg: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "REJECTED"; p.gmNotes = input.note; });
  }
  async adminPauseProject(adminTokenArg: string, input: { projectId: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "PAUSED"; });
  }
  async adminResumeProject(adminTokenArg: string, input: { projectId: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "ACTIVE"; });
  }
}

export const mockApi = new MockApiClient();
