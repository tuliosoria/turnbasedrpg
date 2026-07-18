import { houses, turn001, campaign, HOUSE_IDS, type HouseId } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requireAdmin } from "../auth/adminAuth";
import { parseAdminLoginBody } from "../validation/schemas";
import { hashCode } from "../auth/codes";
import { signToken, type AdminTokenPayload } from "../auth/tokens";
import { getTurnStatus, setTurnStatus } from "../db/turns";
import { listHouseClaims } from "../db/players";
import { listChoices } from "../db/choices";

export async function adminLogin(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { adminCode } = parseAdminLoginBody(req.body);
  if (hashCode(adminCode) !== deps.config.adminCodeHash) {
    throw new HttpError(401, "INVALID_CODE", "Código de admin inválido.");
  }
  const payload: AdminTokenPayload = {
    type: "admin",
    campaignId: deps.config.campaignId,
    exp: Date.now() + deps.config.tokenTtlSeconds * 1000,
  };
  return { status: 200, body: { adminToken: signToken(payload, deps.config.tokenSigningSecret) } };
}

export async function getDashboard(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const [claims, choices, turnStatus] = await Promise.all([
    listHouseClaims(deps.doc, tableName, campaignId),
    listChoices(deps.doc, tableName, campaignId, turn001.id),
    getTurnStatus(deps.doc, tableName, campaignId, turn001.id),
  ]);

  const rows = HOUSE_IDS.map((id: HouseId) => {
    const h = houses[id];
    const claim = claims.get(id);
    const choice = choices.get(id);
    const card = choice ? turn001.cards.find((c) => c.id === choice.cardId) : undefined;
    return {
      houseId: id,
      houseName: h.name,
      claimed: !!claim,
      displayName: claim?.displayName,
      cardId: choice?.cardId,
      cardTitle: card?.title,
      categories: card?.categories,
      chosenAt: choice?.chosenAt,
    };
  });

  const summaryText = rows.map((r) => `${r.houseName}: ${r.cardTitle ?? "(sem escolha)"}`).join("\n");

  return {
    status: 200,
    body: {
      activeTurnId: campaign.activeTurnId,
      turnTitle: turn001.title,
      turnStatus,
      kingdomState: turn001.stateBefore,
      rows,
      summaryText,
    },
  };
}

export async function lockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, "LOCKED");
  return { status: 204, body: undefined };
}

export async function unlockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, "OPEN");
  return { status: 204, body: undefined };
}
