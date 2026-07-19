import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getHouse } from "../db/houses";
import { getActiveTurn } from "../db/turns";
import { getSubmission, putSubmission } from "../db/submissions";
import { parseSubmitOrderBody } from "../validation/schemas";

export async function getGame(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId;
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");

  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  const visibleTurn = turn && turn.status !== "DRAFT";
  const submission = turn
    ? await getSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, houseId)
    : null;
  const previousResult = turn?.status === "RESOLVED"
    ? {
        publicResult: turn.result?.publicResult,
        privateResult: turn.result?.houseResults[houseId],
        discoveries: turn.result?.discoveries ?? [],
        resultImageUrl: turn.resultImageUrl,
      }
    : null;

  return {
    status: 200,
    body: {
      house,
      turnId: turn?.turnId ?? null,
      turnStatus: turn?.status ?? null,
      publicEvent: visibleTurn ? turn.publicEvent : "",
      eventImageUrl: visibleTurn ? turn.eventImageUrl : undefined,
      privateInformation: visibleTurn ? (turn.privateInfo[houseId] ?? "") : "",
      cards: visibleTurn ? turn.cards : [],
      submission,
      previousResult,
    },
  };
}

export async function submitOrder(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId;
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");

  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "OPEN") {
    throw new HttpError(423, "TURN_LOCKED", "O turno não está aberto para ordens.");
  }

  const body = parseSubmitOrderBody(req.body);
  for (const cr of body.cardResponses) {
    const card = turn.cards.find((c) => c.id === cr.cardId);
    if (!card) throw new HttpError(400, "INVALID_CARD", "Carta desconhecida.");
    if (cr.declaredSpend) {
      if (!card.spend) throw new HttpError(400, "INVALID_SPEND", "Esta carta não permite gasto.");
      if (cr.declaredSpend.attribute !== card.spend.attribute) throw new HttpError(400, "INVALID_SPEND", "Atributo incorreto.");
      if (!Number.isFinite(cr.declaredSpend.amount)) throw new HttpError(400, "INVALID_SPEND", "Gasto inválido.");
      if (cr.declaredSpend.amount < 0 || cr.declaredSpend.amount > card.spend.max) throw new HttpError(400, "INVALID_SPEND", "Gasto acima do permitido.");
      if (cr.declaredSpend.amount > house.attributes[card.spend.attribute]) throw new HttpError(400, "INVALID_SPEND", "Sua Casa não possui esse atributo suficiente.");
    }
    if (cr.declaredChoice && (!card.choice || !card.choice.attributes.includes(cr.declaredChoice.attribute))) {
      throw new HttpError(400, "INVALID_CHOICE", "Escolha inválida.");
    }
  }

  const submittedAt = new Date().toISOString();
  await putSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, {
    houseId,
    orderText: body.orderText,
    cardResponses: body.cardResponses,
    submittedAt,
  });
  return { status: 200, body: { submittedAt } };
}
