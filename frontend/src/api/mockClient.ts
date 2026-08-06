import {
  ATTRIBUTE_KEYS,
  CASA_VARGEN_EXAMPLE,
  DEFAULT_WIKI_ENTRIES,
  DEFAULT_GM_ENTRIES,
  validateAttributes,
  type Attributes,
  type House,
  type Submission,
  type Turn,
  type TurnResult,
  type TurnStatus,
  type Emblem,
  DEFAULT_PROJECT_TEMPLATES,
  getTemplate,
  projectSlotLimit,
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
} from "@ravenloft/content";
import {
  ApiError,
  type AdminDashboard,
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
  type WikiEntry,
  type WikiEntryInput,
  type GmEntry,
  type GmEntryInput,
  type ProjectsView,
} from "../types/api";
import type { ApiClient, TurnImageKind } from "./client";

interface PlayerRecord {
  houseId: string;
  displayName: string;
  playerCode: string;
  playerToken: string;
}

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
  private resolvedTurns: Array<{ turnId: number; result: TurnResult; resultImageUrl?: string }> = [];
  private galleryEntries: GalleryEntry[] = [];
  private worldBible: WorldBible = { lore: "", visualDirectives: "", updatedAt: "" };
  private wikiEntries: WikiEntry[] = [];
  private wikiSeq = 0;
  private gmEntries: GmEntry[] = [];
  private gmSeq = 0;

  constructor() {
    this.houses.set("seed-vargen", makeHouse("seed-vargen", {
      ...CASA_VARGEN_EXAMPLE,
    }));
  }

  async getCampaign(): Promise<CampaignSummary> {
    return {
      id: "winter-dead",
      title: "Ravenloft: O Inverno dos Mortos",
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
      .map((entry) => ({
        turnId: entry.turnId,
        publicResult: entry.result.publicResult,
        privateResult: entry.result.houseResults[record.houseId],
        discoveries: entry.result.discoveries,
        resultImageUrl: entry.resultImageUrl,
      }));

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
    for (const [houseId, delta] of Object.entries(result.attributeDeltas)) {
      const house = this.houses.get(houseId);
      if (!house) continue;
      const attributes: Attributes = { ...house.attributes };
      for (const key of ATTRIBUTE_KEYS) {
        const change = delta[key];
        if (typeof change === "number") attributes[key] = clampAttribute(attributes[key] + change);
      }
      this.houses.set(houseId, { ...house, attributes });
    }

    this.resolvedTurns.push({
      turnId: this.activeTurn.turnId,
      result,
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

  async adminGetWorldBible(token: string): Promise<WorldBible> {
    this.requireAdmin(token);
    return { ...this.worldBible };
  }

  async adminPutWorldBible(token: string, input: { lore: string; visualDirectives: string }): Promise<void> {
    this.requireAdmin(token);
    this.worldBible = { ...input, updatedAt: new Date().toISOString() };
  }

  async getWiki(): Promise<WikiEntry[]> {
    return this.wikiEntries.map((e) => ({ ...e }));
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
    return {
      templates: DEFAULT_PROJECT_TEMPLATES,
      recommended: recommendStarterCards(house).map((t) => t.id),
      projects: this.projects.get(rec.houseId) ?? [],
      favors: this.favors.filter((f) => f.toHouseId === rec.houseId && f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
    };
  }

  async startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard> {
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
    else if (t.requiresTargetApproval) card.status = "PENDING_TARGET";
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
