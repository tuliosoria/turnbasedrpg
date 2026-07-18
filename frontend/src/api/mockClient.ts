import {
  campaign, houses, turn001, HOUSE_IDS, CONTENT_VERSION,
  type HouseId, type TurnCard,
} from "@ravenloft/content";
import {
  ApiError,
  type CampaignSummary, type HouseSummary, type ClaimResult, type LoginResult,
  type PlayerGameView, type CurrentChoice, type CardView, type AdminDashboard,
  type AdminChoiceRow, type TurnStatus,
} from "../types/api";
import type { ApiClient } from "./client";

interface ClaimRecord {
  houseId: HouseId;
  displayName: string;
  playerCode: string;
  playerToken: string;
  choice?: CurrentChoice;
}

function randomSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function toCardView(card: TurnCard): CardView {
  return {
    id: card.id,
    title: card.title,
    categories: card.categories,
    description: card.description,
    contribution: card.contribution,
    risk: card.risk,
    cost: card.cost,
  };
}

export class MockApiClient implements ApiClient {
  private claims = new Map<HouseId, ClaimRecord>();
  private byToken = new Map<string, ClaimRecord>();
  private byCode = new Map<string, ClaimRecord>();
  private turnStatus: TurnStatus = "OPEN";
  private adminToken = "mock-admin-token";

  async getCampaign(): Promise<CampaignSummary> {
    return {
      id: campaign.id,
      title: campaign.title,
      introduction: campaign.introduction,
      publicState: turn001.stateBefore,
      activeTurnId: campaign.activeTurnId,
      turnStatus: this.turnStatus,
      contentVersion: CONTENT_VERSION,
    };
  }

  async getHouses(): Promise<HouseSummary[]> {
    return HOUSE_IDS.map((id) => {
      const h = houses[id];
      return {
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        motto: h.motto,
        strength: h.strength,
        available: !this.claims.has(id),
      };
    });
  }

  async claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult> {
    if (this.claims.has(houseId)) {
      throw new ApiError("HOUSE_TAKEN", "Esta Casa já foi escolhida.");
    }
    const playerCode = `${houseId}-${randomSuffix()}`;
    const playerToken = `tok-${houseId}-${randomSuffix()}`;
    const record: ClaimRecord = { houseId, displayName, playerCode, playerToken };
    this.claims.set(houseId, record);
    this.byToken.set(playerToken, record);
    this.byCode.set(playerCode, record);
    return { playerCode, playerToken, houseId, displayName };
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

  private requirePlayer(playerToken: string): ClaimRecord {
    const record = this.byToken.get(playerToken);
    if (!record) throw new ApiError("SESSION_EXPIRED", "Sessão expirada.");
    return record;
  }

  async getGame(playerToken: string): Promise<PlayerGameView> {
    const record = this.requirePlayer(playerToken);
    const house = houses[record.houseId];
    const content = turn001.houseContent[record.houseId];
    const cards = content.cardIds.map((id) => {
      const card = turn001.cards.find((c) => c.id === id)!;
      return toCardView(card);
    });
    return {
      houseId: house.id,
      houseName: house.name,
      houseSubtitle: house.subtitle,
      privateIntroduction: house.privateIntroduction,
      displayName: record.displayName,
      kingdomState: turn001.stateBefore,
      turnId: turn001.id,
      turnTitle: turn001.title,
      publicEvent: turn001.publicEvent,
      privateInformation: content.privateInformation,
      cards,
      currentChoice: record.choice,
      turnStatus: this.turnStatus,
      previousResult: undefined,
    };
  }

  async submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice> {
    const record = this.requirePlayer(playerToken);
    if (this.turnStatus === "LOCKED") {
      throw new ApiError("TURN_LOCKED", "O Conselho está resolvendo o turno.");
    }
    if (turnId !== turn001.id) {
      throw new ApiError("VERSION_CONFLICT", "Turno desatualizado.");
    }
    const hand = turn001.houseContent[record.houseId].cardIds;
    if (!hand.includes(cardId as (typeof hand)[number])) {
      throw new ApiError("INVALID_CARD", "Esta carta não pertence à sua Casa.");
    }
    const choice: CurrentChoice = { cardId, chosenAt: new Date().toISOString() };
    record.choice = choice;
    return choice;
  }

  async adminLogin(adminCode: string): Promise<{ adminToken: string }> {
    if (!adminCode || adminCode.trim() === "") {
      throw new ApiError("INVALID_CODE", "Código de admin inválido.");
    }
    return { adminToken: this.adminToken };
  }

  private requireAdmin(adminToken: string): void {
    if (adminToken !== this.adminToken) {
      throw new ApiError("SESSION_EXPIRED", "Sessão de admin expirada.");
    }
  }

  async getAdminDashboard(adminToken: string): Promise<AdminDashboard> {
    this.requireAdmin(adminToken);
    const rows: AdminChoiceRow[] = HOUSE_IDS.map((id) => {
      const h = houses[id];
      const record = this.claims.get(id);
      const card = record?.choice
        ? turn001.cards.find((c) => c.id === record.choice!.cardId)
        : undefined;
      return {
        houseId: id,
        houseName: h.name,
        claimed: !!record,
        displayName: record?.displayName,
        cardId: record?.choice?.cardId,
        cardTitle: card?.title,
        categories: card?.categories,
        chosenAt: record?.choice?.chosenAt,
      };
    });
    const summaryText = rows
      .map((r) => `${r.houseName}: ${r.cardTitle ?? "(sem escolha)"}`)
      .join("\n");
    return {
      activeTurnId: turn001.id,
      turnTitle: turn001.title,
      turnStatus: this.turnStatus,
      kingdomState: turn001.stateBefore,
      rows,
      summaryText,
    };
  }

  async lockTurn(adminToken: string): Promise<void> {
    this.requireAdmin(adminToken);
    this.turnStatus = "LOCKED";
  }

  async unlockTurn(adminToken: string): Promise<void> {
    this.requireAdmin(adminToken);
    this.turnStatus = "OPEN";
  }
}

export const mockApi = new MockApiClient();
