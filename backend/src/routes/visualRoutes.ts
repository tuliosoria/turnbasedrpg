import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { newVisualGeneration } from "@ravenloft/content";
import { hitRateLimit } from "../db/rateLimit";
import { putGeneration, getGeneration } from "../db/visual/generations";
import { parseGenerateBody } from "../validation/visualSchemas";

const GEN_LIMIT = 20;
const GEN_WINDOW_SECONDS = 3600;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createGeneration(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const ip = req.sourceIp || "unknown";
  const count = await hitRateLimit(deps.doc, deps.config.tableName, `visual-gen#${ip}`, GEN_WINDOW_SECONDS);
  if (count > GEN_LIMIT) throw new HttpError(429, "RATE_LIMITED", "Limite de gerações por hora atingido. Tente novamente mais tarde.");

  const { requestText, entityId } = parseGenerateBody(req.body);
  const gen = newVisualGeneration({ id: newId(), campaignId: deps.config.campaignId, requestedBy: ip, requestText });
  gen.entityId = entityId;
  await putGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, gen);

  if (deps.invokeWorker) {
    await deps.invokeWorker({ campaignId: deps.config.campaignId, generationId: gen.id });
  }
  return { status: 202, body: { generationId: gen.id, status: gen.status } };
}

export async function getGenerationStatus(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const id = req.pathParams.id;
  const gen = await getGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, id);
  if (!gen) return { status: 404, body: { code: "NOT_FOUND", message: "Geração não encontrada." } };
  return { status: 200, body: gen };
}
