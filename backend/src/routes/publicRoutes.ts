import { CASA_VARGEN_EXAMPLE } from "@ravenloft/content";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config, HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { createAccountAndHouse as dbCreateAccountAndHouse } from "../db/houses";
import { getPlayerByCodeHash } from "../db/players";
import { parseCreateHouseBody, parseLoginBody } from "../validation/schemas";
import { generatePlayerCode, hashCode } from "../auth/codes";
import { signToken, type PlayerTokenPayload } from "../auth/tokens";

export interface Deps {
  doc: DynamoDBDocumentClient;
  config: Config;
}

export function playerToken(config: Config, houseId: string, displayName: string): string {
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
  return {
    status: 200,
    body: {
      id: deps.config.campaignId,
      title: "O Inverno dos Mortos",
      introduction: "Valdren é um reino de Ravenloft cercado pelas Brumas. Cada jogador lidera uma Grande Casa. Suas decisões, escritas em texto livre, criam a história do reino.",
    },
  };
}

export async function getHouseExample(_deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  return { status: 200, body: CASA_VARGEN_EXAMPLE };
}

export async function createAccountAndHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const input = parseCreateHouseBody(req.body);
  const provisionalPrefix = input.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "casa";
  const playerCode = generatePlayerCode(provisionalPrefix);
  const codeHash = hashCode(playerCode);
  const { houseId } = await dbCreateAccountAndHouse(
    deps.doc,
    deps.config.tableName,
    deps.config.campaignId,
    { ...input, codeHash },
  );
  const token = playerToken(deps.config, houseId, input.displayName);
  return { status: 200, body: { playerCode, playerToken: token, houseId, displayName: input.displayName } };
}

export async function login(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { playerCode } = parseLoginBody(req.body);
  const profile = await getPlayerByCodeHash(deps.doc, deps.config.tableName, hashCode(playerCode));
  if (!profile) throw new HttpError(401, "INVALID_CODE", "Código inválido.");
  const token = playerToken(deps.config, profile.houseId, profile.displayName);
  return {
    status: 200,
    body: { playerToken: token, houseId: profile.houseId, displayName: profile.displayName },
  };
}
