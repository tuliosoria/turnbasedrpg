import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { listCanonWikiEntries } from "../db/wiki";
import { putCanonSubmission, listCanonSubmissions, getCanonSubmission } from "../db/canonSubmissions";
import { publishCanonSubmission } from "../canon/publish";
import { hitRateLimit } from "../db/rateLimit";
import { generateJson } from "../ai/openai";
import {
  buildCanonContext,
  buildCanonProposalPrompt,
  parseCanonProposalJson,
  buildCanonReviewPrompt,
  parseCanonReviewJson,
} from "../ai/canonPrompts";
import {
  parseCanonPreviewBody,
  parseCanonSubmitBody,
  parseUploadCanonImageBody,
  parseCanonApproveBody,
  parseCanonRejectBody,
  assertCanonImageOwned,
} from "../validation/schemas";
import { newCanonSubmission, clampText, CANON_GM_NOTE_MAX, type CanonProposal, type CanonReview } from "@ravenloft/content";

/**
 * Teto de prévias de IA por hora por Casa.
 *
 * É guarda de custo contra laço descontrolado, não porteiro de curadoria: o
 * limite é folgado de propósito, porque um jogador que esbarra nele fica sem
 * conseguir propor, e propor é justamente o que ele nunca deve ser impedido
 * de fazer. Quem julga a proposta é o Mestre.
 */
const PREVIEW_LIMIT = 40;
const PREVIEW_WINDOW_SECONDS = 3600;

/** Duas tentativas por chamada: a IA às vezes devolve JSON malformado no primeiro passe. */
const AI_ATTEMPTS = 2;
/** A proposta é o texto do jogador inteiro reescrito, então precisa de folga de tokens. */
const PROPOSAL_MAX_TOKENS = 1600;
/** O parecer é curto (veredito + poucas flags): teto menor economiza custo sem perder qualidade. */
const REVIEW_MAX_TOKENS = 800;

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

  return { status: 200, body: await gerarPropostaCanonica(deps, player.displayName, rawText) };
}

/**
 * Transforma texto livre em proposta de verbete, com parecer da IA.
 *
 * Mora fora das rotas porque tem dois donos: o jogador, em `/canonico`, e o
 * Mestre, no Escriba. Um prompt, um parser, duas portas — o que muda entre elas
 * é a autenticação e o limite de taxa, que ficam com quem chama.
 */
export async function gerarPropostaCanonica(
  deps: Deps,
  autorNome: string,
  rawText: string,
): Promise<{ proposal: CanonProposal; review: CanonReview | null }> {
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");

  // Só verbetes públicos e canônicos entram no prompt: listCanonWikiEntries já
  // exclui as seções não-canônicas (regras de mesa) e nenhuma fonte de Mestre é
  // lida aqui, então nada secreto vaza para a IA voltada ao jogador.
  const wiki = await listCanonWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = buildCanonContext(wiki);

  const proposalPrompt = buildCanonProposalPrompt(autorNome, canon, rawText);
  const proposal = await generateJson(
    deps.chat,
    proposalPrompt.system,
    proposalPrompt.user,
    parseCanonProposalJson,
    AI_ATTEMPTS,
    PROPOSAL_MAX_TOKENS,
  );

  // A proposta é o trabalho do autor e não pode ser perdida; o parecer é só
  // conselho ao Mestre (review é anulável na submissão), então roda em regime
  // best-effort. Se a segunda chamada falhar, devolvemos a proposta com review
  // nulo em vez de descartar tudo e ainda consumir uma das tentativas/hora.
  // Nota de latência: são duas chamadas encadeadas, cada uma com retries
  // internos, dentro de uma única requisição síncrona sujeita ao timeout de
  // integração não-configurável de 29s do API Gateway.
  let review: CanonReview | null = null;
  try {
    const reviewPrompt = buildCanonReviewPrompt(canon, proposal);
    review = await generateJson(
      deps.chat,
      reviewPrompt.system,
      reviewPrompt.user,
      parseCanonReviewJson,
      AI_ATTEMPTS,
      REVIEW_MAX_TOKENS,
    );
  } catch (err) {
    console.warn("gerarPropostaCanonica: revisão da IA falhou, seguindo sem parecer", err);
  }

  return { proposal, review };
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

  // A imagem, se houver, precisa ter sido produzida pelo endpoint de upload deste
  // servidor — a validação estrutural não vê a URL base configurada, então a
  // checagem de posse mora aqui, onde o imageStore a expõe.
  if (input.rawImageUrl || input.rawImageKey) {
    if (!deps.imageStore) throw new HttpError(503, "IMAGE_DISABLED", "Upload de imagens não configurado.");
    assertCanonImageOwned(deps.imageStore.baseUrl, input.rawImageUrl, input.rawImageKey);
  }

  // Não há teto de propostas na fila: o jogador propõe, o Mestre julga. Barrar
  // o envio por causa do tamanho da fila tirava do Mestre a decisão que é dele
  // e deixava o jogador travado sem ter feito nada de errado.

  const submission = newCanonSubmission({
    id: newId(),
    campaignId: deps.config.campaignId,
    houseId: player.houseId,
    authorName: player.displayName,
    rawText: input.rawText,
    rawImageUrl: input.rawImageUrl,
    rawImageKey: input.rawImageKey,
    proposal: input.proposal,
    review: input.review,
  });
  await putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, submission);
  return { status: 200, body: submission };
}

export async function canonListMine(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const submissions = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  return { status: 200, body: submissions };
}

// ---------------------------------------------------------------------------
// Rotas do Mestre: fila de revisão, aprovação e recusa. Só requireAdmin.
// ---------------------------------------------------------------------------

// Só uma proposta ainda PENDING_GM pode ser julgada. A publicação é retomável:
// numa aprovação que morreu no meio o status continua PENDING_GM (só vira
// APPROVED ao final de publishCanonSubmission), então esta checagem deixa o
// Mestre reaprovar de onde parou sem barrar a retomada.
async function loadPending(deps: Deps, submissionId: string) {
  const submission = await getCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, submissionId);
  if (!submission) throw new HttpError(404, "NOT_FOUND", "Proposta não encontrada.");
  if (submission.status !== "PENDING_GM") throw new HttpError(409, "BAD_STATUS", "Proposta já foi julgada.");
  return submission;
}

export async function adminCanonList(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const submissions = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: submissions };
}

export async function adminCanonApprove(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { submissionId, proposal } = parseCanonApproveBody(req.body);
  const submission = await loadPending(deps, submissionId);

  // publishCanonSubmission é retomável: grava cada id criado na submission antes
  // de avançar para a próxima escrita, então uma aprovação que morreu no meio
  // pode ser repetida pelo Mestre. Se a submission já traz ids parciais, estamos
  // retomando — não é erro, mas merece rastro para facilitar o diagnóstico.
  const resumeIds = [
    submission.wikiEntryId && `wikiEntryId=${submission.wikiEntryId}`,
    submission.visualEntityId && `visualEntityId=${submission.visualEntityId}`,
    submission.visualAssetId && `visualAssetId=${submission.visualAssetId}`,
  ].filter(Boolean);
  if (resumeIds.length > 0) {
    console.warn(`adminCanonApprove: retomando publicação parcial da submission ${submission.id} — ids já presentes: ${resumeIds.join(", ")}`);
  }

  // O Mestre pode reescrever o verbete antes de publicar; o que ele mandou é
  // o que vira cânone.
  const toPublish = proposal ? { ...submission, proposal } : submission;
  const published = await publishCanonSubmission(
    { doc: deps.doc, tableName: deps.config.tableName, campaignId: deps.config.campaignId, newId },
    toPublish,
    (s) => putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, s),
  );
  return { status: 200, body: published };
}

export async function adminCanonReject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { submissionId, note } = parseCanonRejectBody(req.body);
  const submission = await loadPending(deps, submissionId);
  const now = new Date().toISOString();
  const rejected = {
    ...submission,
    status: "REJECTED" as const,
    gmNote: clampText(note, CANON_GM_NOTE_MAX),
    resolvedAt: now,
    updatedAt: now,
  };
  await putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, rejected);
  return { status: 200, body: rejected };
}
