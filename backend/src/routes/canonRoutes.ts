import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { listCanonWikiEntries } from "../db/wiki";
import { putCanonSubmission, listCanonSubmissions } from "../db/canonSubmissions";
import { hitRateLimit } from "../db/rateLimit";
import { generateJson } from "../ai/openai";
import {
  buildCanonContext,
  buildCanonProposalPrompt,
  parseCanonProposalJson,
  buildCanonReviewPrompt,
  parseCanonReviewJson,
} from "../ai/canonPrompts";
import { parseCanonPreviewBody, parseCanonSubmitBody, parseUploadCanonImageBody } from "../validation/schemas";
import { newCanonSubmission } from "@ravenloft/content";

/** Dez prévias de IA por hora por Casa: a chamada é cara e o texto é curto. */
const PREVIEW_LIMIT = 10;
const PREVIEW_WINDOW_SECONDS = 3600;
/** Uma fila de revisão que não acaba nunca não é uma fila. */
const MAX_PENDING_PER_HOUSE = 5;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function canonPreview(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { rawText } = parseCanonPreviewBody(req.body);

  const hits = await hitRateLimit(deps.doc, deps.config.tableName, `canon-preview:${player.houseId}`, PREVIEW_WINDOW_SECONDS);
  if (hits > PREVIEW_LIMIT) {
    throw new HttpError(429, "RATE_LIMITED", "Limite de prévias por hora atingido. Tente mais tarde.");
  }

  // Só verbetes públicos e canônicos entram no prompt: listCanonWikiEntries já
  // exclui as seções não-canônicas (regras de mesa) e nenhuma fonte de Mestre é
  // lida aqui, então nada secreto vaza para a IA voltada ao jogador.
  const wiki = await listCanonWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = buildCanonContext(wiki);

  const proposalPrompt = buildCanonProposalPrompt(player.displayName, canon, rawText);
  const proposal = await generateJson(deps.chat, proposalPrompt.system, proposalPrompt.user, parseCanonProposalJson, 2, 1600);

  const reviewPrompt = buildCanonReviewPrompt(canon, proposal);
  const review = await generateJson(deps.chat, reviewPrompt.system, reviewPrompt.user, parseCanonReviewJson, 2, 800);

  return { status: 200, body: { proposal, review } };
}

export async function canonUploadImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requirePlayer(deps.config, req);
  if (!deps.imageStore) throw new HttpError(503, "IMAGE_DISABLED", "Upload de imagens não configurado.");
  const { body, contentType } = parseUploadCanonImageBody(req.headers, req.rawBody);
  const { key, url } = await deps.imageStore.uploadCanonImage(newId(), body, contentType);
  return { status: 200, body: { imageUrl: url, imageKey: key } };
}

export async function canonSubmit(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const input = parseCanonSubmitBody(req.body);

  const mine = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (mine.filter((s) => s.status === "PENDING_GM").length >= MAX_PENDING_PER_HOUSE) {
    throw new HttpError(409, "BAD_STATUS", "Você já tem cinco propostas aguardando o Mestre.");
  }

  const submission = newCanonSubmission({
    id: newId(),
    campaignId: deps.config.campaignId,
    houseId: player.houseId,
    authorName: player.displayName,
    rawText: input.rawText,
    rawImageUrl: input.rawImageUrl,
    rawImageKey: input.rawImageKey,
    proposal: input.proposal,
  });
  await putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, submission);
  return { status: 200, body: submission };
}

export async function canonListMine(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const submissions = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  return { status: 200, body: submissions };
}
