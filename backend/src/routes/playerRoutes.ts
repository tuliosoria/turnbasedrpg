import type { HandlerRequest, HandlerResponse } from "../types/domain";
import type { AttributeKey } from "@ravenloft/content";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getHouse } from "../db/houses";
import { getActiveTurn, listTurns } from "../db/turns";
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
  const allTurns = await listTurns(deps.doc, deps.config.tableName, deps.config.campaignId);
  const turnHistory = allTurns
    .filter((t) => t.status === "RESOLVED" && t.result)
    .sort((a, b) => a.turnId - b.turnId)
    .map((t) => {
      const snapshot = t.result!.attributeChanges;
      const attributeChanges = snapshot
        // O motivo viaja junto: sem ele o jogador vê o atributo subir e não
        // sabe o que fez para merecer, nem o que fazer para repetir.
        ? (snapshot[houseId] ?? []).map((c) => ({
            key: c.key, before: c.before, after: c.after, delta: c.after - c.before,
            ...(c.motivo ? { motivo: c.motivo } : {}),
          }))
        : Object.entries(t.result!.attributeDeltas?.[houseId] ?? {})
            .filter(([, d]) => typeof d === "number" && d !== 0)
            .map(([key, d]) => ({ key: key as AttributeKey, delta: d as number }));
      return {
        turnId: t.turnId,
        publicResult: t.result!.publicResult,
        privateResult: t.result!.houseResults[houseId],
        discoveries: t.result!.discoveries ?? [],
        resultImageUrl: t.resultImageUrl,
        attributeChanges,
      };
    });

  return {
    status: 200,
    body: {
      house,
      turnId: turn?.turnId ?? null,
      turnStatus: turn?.status ?? null,
      publicEvent: visibleTurn ? turn.publicEvent : "",
      eventImageUrl: visibleTurn ? turn.eventImageUrl : undefined,
      privateInformation: visibleTurn ? (turn.privateInfo[houseId] ?? "") : "",
      submission,
      turnHistory,
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

  const submittedAt = new Date().toISOString();
  await putSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, {
    houseId,
    orderText: body.orderText,
    submittedAt,
  });
  return { status: 200, body: { submittedAt } };
}
