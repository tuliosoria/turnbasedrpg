import { HOUSE_IDS, type HouseId } from "@ravenloft/content";
import { HttpError } from "../types/domain";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_BODY", "Corpo da requisição inválido.");
  }
  return body as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "INVALID_BODY", `Campo obrigatório ausente ou inválido: ${key}`);
  }
  return value;
}

function requireHouseId(obj: Record<string, unknown>, key: string): HouseId {
  const value = requireString(obj, key);
  if (!(HOUSE_IDS as string[]).includes(value)) {
    throw new HttpError(400, "INVALID_BODY", `Casa desconhecida: ${key}`);
  }
  return value as HouseId;
}

export function parseClaimBody(body: unknown): { houseId: HouseId; displayName: string } {
  const obj = asObject(body);
  return { houseId: requireHouseId(obj, "houseId"), displayName: requireString(obj, "displayName") };
}

export function parseLoginBody(body: unknown): { playerCode: string } {
  return { playerCode: requireString(asObject(body), "playerCode") };
}

export function parseChoiceBody(body: unknown): { cardId: string } {
  return { cardId: requireString(asObject(body), "cardId") };
}

export function parseAdminLoginBody(body: unknown): { adminCode: string } {
  return { adminCode: requireString(asObject(body), "adminCode") };
}
