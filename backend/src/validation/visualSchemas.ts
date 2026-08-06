import { clampVisualText } from "@ravenloft/content";
import { HttpError } from "../types/domain";

export interface GenerateBody {
  requestText: string;
  entityId: string | null;
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "INVALID_BODY", "Corpo inválido.");
  return body as Record<string, unknown>;
}

export function parseGenerateBody(body: unknown): GenerateBody {
  const o = asObject(body);
  const requestText = clampVisualText(o.requestText);
  if (!requestText) throw new HttpError(400, "INVALID_BODY", "Descreva a imagem desejada.");
  const entityId = typeof o.entityId === "string" && o.entityId ? o.entityId : null;
  return { requestText, entityId };
}
