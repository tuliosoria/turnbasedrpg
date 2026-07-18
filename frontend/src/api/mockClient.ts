import {
  ATTRIBUTE_KEYS,
  CASA_VARGEN_EXAMPLE,
  type Attributes,
  type CardResponse,
  type House,
  type NarrativeCard,
  type Submission,
  type Turn,
  type TurnResult,
  type TurnStatus,
} from "@ravenloft/content";
import {
  ApiError,
  type AdminDashboard,
  type CampaignSummary,
  type ComposeTurnInput,
  type CreateAccountResult,
  type CreateHouseInput,
  type HouseExample,
  type LoginResult,
  type PlayerGameView,
  type SubmitOrderInput,
} from "../types/api";
import type { ApiClient } from "./client";

interface PlayerRecord {
  houseId: string;
  displayName: string;
  playerCode: string;
  playerToken: string;
}

const adminToken = "mock-admin-token";

const starterCards: NarrativeCard[] = [
  {
    id: "winter-watch",
    title: "Vigília na Estrada Congelada",
    constraintText: "Gaste até 3 Soldados.",
    narrativeQuestion: "Quem guarda a passagem quando os mortos avançam?",
    consequenceText: "Mais soldados reduzem o risco, mas deixam o castelo exposto.",
    spend: { attribute: "soldados", max: 3 },
  },
  {
    id: "frozen-stores",
    title: "Celeiros sob Gelo",
    constraintText: "Escolha Riqueza, Recursos ou Controle.",
    narrativeQuestion: "Qual força da Casa sustenta o povo durante a fome?",
    consequenceText: "A escolha define quem cobrará o preço depois.",
    choice: { attributes: ["riqueza", "recursos", "controle"], amount: 1 },
  },
];

function randomSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function clampAttribute(value: number): number {
  return Math.max(0, Math.min(5, value));
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
    cards: starterCards,
    createdAt: new Date().toISOString(),
  };
}

export class MockApiClient implements ApiClient {
  private houses = new Map<string, House>();
  private byToken = new Map<string, PlayerRecord>();
  private byCode = new Map<string, PlayerRecord>();
  private submissions = new Map<string, Submission>();
  private activeTurn: Turn = makeStarterTurn();
  private lastResult: TurnResult | null = null;

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
    const previousResult = this.lastResult
      ? {
          publicResult: this.lastResult.publicResult,
          privateResult: this.lastResult.houseResults[record.houseId],
          discoveries: this.lastResult.discoveries,
        }
      : null;

    return {
      house,
      turnId: this.activeTurn.turnId,
      turnStatus: this.activeTurn.status,
      publicEvent: visibleTurn ? this.activeTurn.publicEvent : "",
      privateInformation: visibleTurn ? (this.activeTurn.privateInfo[record.houseId] ?? "") : "",
      cards: visibleTurn ? this.activeTurn.cards : [],
      submission: this.submissions.get(record.houseId) ?? null,
      previousResult,
    };
  }

  async submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }> {
    const record = this.requirePlayer(playerToken);
    const house = this.houses.get(record.houseId);
    if (!house) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    if (this.activeTurn.status !== "OPEN") {
      throw new ApiError("TURN_LOCKED", "O turno não está aberto para ordens.");
    }

    for (const response of input.cardResponses) this.validateCardResponse(response, house);

    const submittedAt = new Date().toISOString();
    this.submissions.set(record.houseId, {
      houseId: record.houseId,
      orderText: input.orderText,
      cardResponses: input.cardResponses,
      submittedAt,
    });
    return { submittedAt };
  }

  private validateCardResponse(response: CardResponse, house: House): void {
    const card = this.activeTurn.cards.find((item) => item.id === response.cardId);
    if (!card) throw new ApiError("INVALID_CARD", "Carta desconhecida.");
    if (response.declaredSpend) {
      if (!card.spend || card.spend.attribute !== response.declaredSpend.attribute) {
        throw new ApiError("INVALID_SPEND", "Gasto inválido para esta carta.");
      }
      if (
        response.declaredSpend.amount < 0 ||
        response.declaredSpend.amount > card.spend.max ||
        response.declaredSpend.amount > house.attributes[response.declaredSpend.attribute]
      ) {
        throw new ApiError("INVALID_SPEND", "Gasto acima do permitido.");
      }
    }
    if (
      response.declaredChoice &&
      (!card.choice || !card.choice.attributes.includes(response.declaredChoice.attribute))
    ) {
      throw new ApiError("INVALID_CHOICE", "Escolha inválida.");
    }
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
      privateInfo: this.activeTurn.privateInfo,
      cards: this.activeTurn.cards,
      result: this.activeTurn.result ?? null,
      houses: Array.from(this.houses.values()),
      submissions: Array.from(this.submissions.values()),
    };
  }

  async adminComposeTurn(token: string, input: ComposeTurnInput): Promise<void> {
    this.requireAdmin(token);
    this.activeTurn = {
      ...this.activeTurn,
      status: "DRAFT",
      publicEvent: input.publicEvent,
      privateInfo: { ...input.privateInfo },
      cards: input.cards,
      result: undefined,
    };
    this.submissions.clear();
  }

  async adminOpenTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "OPEN");
  }

  async adminLockTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "LOCKED");
  }

  async adminUnlockTurn(token: string): Promise<void> {
    this.setTurnStatus(token, "OPEN");
  }

  private setTurnStatus(token: string, status: TurnStatus): void {
    this.requireAdmin(token);
    this.activeTurn = { ...this.activeTurn, status };
  }

  async adminDraftPrivateInfo(token: string): Promise<Record<string, string>> {
    this.requireAdmin(token);
    return Object.fromEntries(
      Array.from(this.houses.values()).map((house) => [
        house.houseId,
        `${house.name} descobre uma trilha sob a geada que ninguém mais viu.`,
      ]),
    );
  }

  async adminDraftResolution(token: string): Promise<TurnResult> {
    this.requireAdmin(token);
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

    this.lastResult = result;
    const nextTurnId = this.activeTurn.turnId + 1;
    this.activeTurn = {
      turnId: nextTurnId,
      status: "DRAFT",
      publicEvent: "",
      privateInfo: {},
      cards: [],
      createdAt: new Date().toISOString(),
    };
    this.submissions.clear();
    return { nextTurnId };
  }

  async adminEditHouse(token: string, houseId: string, attributes: Attributes): Promise<void> {
    this.requireAdmin(token);
    const house = this.houses.get(houseId);
    if (!house) throw new ApiError("NO_HOUSE", "Casa não encontrada.");
    this.houses.set(houseId, { ...house, attributes: { ...attributes } });
  }
}

export const mockApi = new MockApiClient();
