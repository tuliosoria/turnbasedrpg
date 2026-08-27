import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requireAdmin } from "../auth/adminAuth";
import { escreverCanone, ErroDeEscrita } from "../canon/escriba";
import { gerarPropostaCanonica } from "./canonRoutes";
import { parseEscribaBody, parseCanonPreviewBody } from "../validation/schemas";

/** Como o Escriba assina o que escreve, no prompt da IA. */
const AUTOR = "Mestre";

/**
 * Prévia do Escriba: texto livre do Mestre vira proposta de verbete.
 *
 * Sem limite de taxa, ao contrário da prévia do jogador: é uma pessoa só, e é
 * quem paga a conta da IA.
 */
export async function escribaPreview(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { rawText } = parseCanonPreviewBody(req.body);
  return { status: 200, body: await gerarPropostaCanonica(deps, AUTOR, rawText) };
}

export async function escribaPublicar(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { proposal, houseId, opId } = parseEscribaBody(req.body);

  try {
    const escrito = await escreverCanone(
      { doc: deps.doc, tableName: deps.config.tableName, campaignId: deps.config.campaignId },
      { proposal, houseId, opId },
    );
    return { status: 200, body: escrito };
  } catch (err) {
    if (err instanceof ErroDeEscrita) {
      // 409 e não 500: nada está quebrado, o cânone ficou pela metade. A
      // mensagem carrega o id do verbete porque o conserto é manual, no Acervo.
      throw new HttpError(
        409,
        "CANONE_PARCIAL",
        `${err.message} (verbete ${err.wikiEntryId})`,
      );
    }
    throw err;
  }
}
