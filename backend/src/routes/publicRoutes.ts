import { campaign, houses, turn001, HOUSE_IDS, CONTENT_VERSION } from "@ravenloft/content";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config, HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { getTurnStatus } from "../db/turns";
import { listHouseClaims, claimHouse as dbClaimHouse, getPlayerByCodeHash } from "../db/players";
import { parseClaimBody, parseLoginBody } from "../validation/schemas";
import { generatePlayerCode, hashCode } from "../auth/codes";
import { signToken, type PlayerTokenPayload } from "../auth/tokens";

export interface Deps {
  doc: DynamoDBDocumentClient;
  config: Config;
}

function playerToken(config: Config, houseId: string, displayName: string): string {
  const payload: PlayerTokenPayload = {
    type: "player",
    campaignId: config.campaignId,
    houseId,
    displayName,
    exp: Date.now() + config.tokenTtlSeconds * 1000,
  };
  return signToken(payload, config.tokenSigningSecret);
}

export async function getCampaign(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const turnStatus = await getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, campaign.activeTurnId);
  return {
    status: 200,
    body: {
      id: campaign.id,
      title: campaign.title,
      introduction: campaign.introduction,
      publicState: turn001.stateBefore,
      activeTurnId: campaign.activeTurnId,
      turnStatus,
      contentVersion: CONTENT_VERSION,
    },
  };
}

export async function getHouses(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const claims = await listHouseClaims(deps.doc, deps.config.tableName, deps.config.campaignId);
  return {
    status: 200,
    body: HOUSE_IDS.map((id) => {
      const h = houses[id];
      return {
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        motto: h.motto,
        strength: h.strength,
        available: !claims.has(id),
      };
    }),
  };
}

export async function claimHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { houseId, displayName } = parseClaimBody(req.body);
  const playerCode = generatePlayerCode(houseId);
  const codeHash = hashCode(playerCode);
  await dbClaimHouse(deps.doc, deps.config.tableName, deps.config.campaignId, {
    houseId,
    displayName,
    codeHash,
    playerToken: "",
  });
  return {
    status: 201,
    body: { playerCode, playerToken: playerToken(deps.config, houseId, displayName), houseId, displayName },
  };
}

export async function login(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { playerCode } = parseLoginBody(req.body);
  const profile = await getPlayerByCodeHash(deps.doc, deps.config.tableName, hashCode(playerCode));
  if (!profile) throw new HttpError(401, "INVALID_CODE", "Código inválido.");
  return {
    status: 200,
    body: {
      playerToken: playerToken(deps.config, profile.houseId, profile.displayName),
      houseId: profile.houseId,
      displayName: profile.displayName,
    },
  };
}
