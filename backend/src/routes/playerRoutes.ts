import { houses, turn001, type HouseId, type TurnCard } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getTurnStatus } from "../db/turns";
import { getChoice, putChoice } from "../db/choices";

function toCardView(card: TurnCard) {
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

export async function getMe(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const house = houses[player.houseId as HouseId];
  return { status: 200, body: { houseId: house.id, houseName: house.name, displayName: player.displayName } };
}

export async function getGame(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId as HouseId;
  const house = houses[houseId];
  const content = turn001.houseContent[houseId];
  const [turnStatus, choice] = await Promise.all([
    getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id),
    getChoice(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, houseId),
  ]);
  const cards = content.cardIds.map((id) => toCardView(turn001.cards.find((c) => c.id === id)!));
  return {
    status: 200,
    body: {
      houseId: house.id,
      houseName: house.name,
      houseSubtitle: house.subtitle,
      privateIntroduction: house.privateIntroduction,
      displayName: player.displayName,
      kingdomState: turn001.stateBefore,
      turnId: turn001.id,
      turnTitle: turn001.title,
      publicEvent: turn001.publicEvent,
      privateInformation: content.privateInformation,
      cards,
      currentChoice: choice ? { cardId: choice.cardId, chosenAt: choice.chosenAt } : undefined,
      turnStatus,
      previousResult: undefined,
    },
  };
}

export async function submitChoice(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId as HouseId;
  const turnId = Number(req.pathParams.turnId);

  if (turnId !== turn001.id) {
    throw new HttpError(409, "VERSION_CONFLICT", "Turno desatualizado.");
  }
  const body = req.body;
  const cardId = typeof body === "object" && body !== null ? (body as { cardId?: unknown }).cardId : undefined;
  if (typeof cardId !== "string") {
    throw new HttpError(400, "INVALID_BODY", "cardId obrigatório.");
  }

  const status = await getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turnId);
  if (status === "LOCKED") {
    throw new HttpError(423, "TURN_LOCKED", "O Conselho está resolvendo o turno.");
  }

  const hand = turn001.houseContent[houseId].cardIds as readonly string[];
  if (!hand.includes(cardId)) {
    throw new HttpError(400, "INVALID_CARD", "Esta carta não pertence à sua Casa.");
  }

  const chosenAt = new Date().toISOString();
  await putChoice(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, houseId, cardId, chosenAt);
  return { status: 200, body: { cardId, chosenAt } };
}
