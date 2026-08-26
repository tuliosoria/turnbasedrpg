import type { HandlerRequest, HandlerResponse } from "./types/domain";
import { HttpError } from "./types/domain";
import { getCampaign, getHouseExample, createAccountAndHouse, login, getGallery, getWiki, getChronicle, generateHouseImage, type Deps } from "./routes/publicRoutes";
import { getGame, submitOrder } from "./routes/playerRoutes";
import { canonPreview, canonUploadImage, canonSubmit, canonListMine, adminCanonList, adminCanonApprove, adminCanonReject } from "./routes/canonRoutes";
import { getProjects, startProjectFromTemplate, enhanceCustomProject, startCustomProject, acceptProject, requestProjectRevision, submitProjectToGm, cancelProject, respondToFavor, setEnergia } from "./routes/projectRoutes";
import { adminLogin, getDashboard, aiStatus, composeTurn, saveTurnDraft, fetchTurnDraft, discardTurnDraft, publishTurnDraft, setTurnImageUrl, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPublicEvent, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, listNpcState, updateNpcState, listNpcDynamic, updateNpcDynamic, resetCampaign, generateTurnImage, uploadTurnImage, deleteTurnImage, listWiki, createWikiEntry, updateWikiEntry, removeWikiEntry, seedWiki, listGm, createGmEntry, updateGmEntry, removeGmEntry, seedGm, adminListProjects, adminApproveProject, adminRejectProject, adminPauseProject, adminResumeProject , sendWorldLetters } from "./routes/adminRoutes";
import { listRecipients, getThread, sendMessage, adminDiplomacy, revokeFact, countIncoming, withdrawLetter } from "./routes/diplomacyRoutes";
import { adminListRelations, adminPutRelation } from "./routes/houseRelationRoutes";
import { enhancePrompt, createGeneration, getGenerationStatus, listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible, previewContext, seedVisual, getVisualAsset, createVisualEntity, updateVisualEntity, getVisualCoverage, updateStyleBible } from "./routes/visualRoutes";

type Handler = (deps: Deps, req: HandlerRequest) => Promise<HandlerResponse>;

interface Route {
  method: string;
  pattern: RegExp;
  params: string[];
  handler: Handler;
}

function r(method: string, path: string, handler: Handler): Route {
  const params: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:[^/]+/g, (m) => {
        params.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$",
  );
  return { method, pattern, params, handler };
}

const routes: Route[] = [
  r("GET", "/api/campaign", getCampaign),
  r("GET", "/api/house-example", getHouseExample),
  r("GET", "/api/gallery", getGallery),
  r("GET", "/api/wiki", getWiki),
  r("GET", "/api/cronica", getChronicle),
  r("POST", "/api/create-account", createAccountAndHouse),
  r("POST", "/api/house-image/generate", generateHouseImage),
  r("POST", "/api/player/login", login),
  r("GET", "/api/player/game", getGame),
  r("PUT", "/api/player/order", submitOrder),
  r("POST", "/api/player/canonico/preview", canonPreview),
  r("POST", "/api/player/canonico/imagem", canonUploadImage),
  r("POST", "/api/player/canonico", canonSubmit),
  r("GET", "/api/player/canonico", canonListMine),
  r("POST", "/api/admin/login", adminLogin),
  r("GET", "/api/admin/dashboard", getDashboard),
  r("GET", "/api/admin/ai-status", aiStatus),
  r("POST", "/api/admin/turn/compose", composeTurn),
  r("PUT", "/api/admin/turn/draft", saveTurnDraft),
  r("GET", "/api/admin/turn/draft", fetchTurnDraft),
  r("DELETE", "/api/admin/turn/draft", discardTurnDraft),
  r("POST", "/api/admin/turn/draft/publish", publishTurnDraft),
  r("POST", "/api/admin/turn/image/url", setTurnImageUrl),
  r("POST", "/api/admin/turn/open", openTurn),
  r("POST", "/api/admin/turn/lock", lockTurn),
  r("POST", "/api/admin/turn/unlock", unlockTurn),
  r("POST", "/api/admin/turn/draft-event", draftPublicEvent),
  r("POST", "/api/admin/turn/draft-private", draftPrivateInfo),
  r("POST", "/api/admin/turn/draft-resolution", draftResolution),
  r("POST", "/api/admin/turn/apply", applyResolution),
  r("POST", "/api/admin/turn/image", generateTurnImage),
  r("POST", "/api/admin/turn/image/upload", uploadTurnImage),
  r("POST", "/api/admin/turn/image/delete", deleteTurnImage),
  r("POST", "/api/admin/house/create", createHouse),
  r("POST", "/api/admin/house/update", updateHouse),
  r("POST", "/api/admin/house/delete", deleteHouse),
  r("POST", "/api/admin/reset", resetCampaign),
  r("GET", "/api/admin/world-bible", getWorldBible),
  r("PUT", "/api/admin/world-bible", putWorldBible),
  r("GET", "/api/admin/npc-state", listNpcState),
  r("POST", "/api/admin/npc-state/update", updateNpcState),
  r("GET", "/api/admin/npc-dynamic", listNpcDynamic),
  r("POST", "/api/admin/npc-dynamic/update", updateNpcDynamic),
  r("GET", "/api/admin/wiki", listWiki),
  r("POST", "/api/admin/wiki/create", createWikiEntry),
  r("POST", "/api/admin/wiki/update", updateWikiEntry),
  r("POST", "/api/admin/wiki/delete", removeWikiEntry),
  r("POST", "/api/admin/wiki/seed", seedWiki),
  r("GET", "/api/admin/gm", listGm),
  r("POST", "/api/admin/gm/create", createGmEntry),
  r("POST", "/api/admin/gm/update", updateGmEntry),
  r("POST", "/api/admin/gm/delete", removeGmEntry),
  r("POST", "/api/admin/gm/seed", seedGm),
  r("GET", "/api/player/projects", getProjects),
  r("POST", "/api/player/project/start", startProjectFromTemplate),
  r("POST", "/api/player/project/enhance", enhanceCustomProject),
  r("POST", "/api/player/project/custom", startCustomProject),
  r("POST", "/api/player/project/accept", acceptProject),
  r("POST", "/api/player/project/revise", requestProjectRevision),
  r("POST", "/api/player/project/submit-gm", submitProjectToGm),
  r("POST", "/api/player/project/cancel", cancelProject),
  r("POST", "/api/player/project/energia", setEnergia),
  r("POST", "/api/player/favor/respond", respondToFavor),
  r("GET", "/api/admin/projects", adminListProjects),
  r("POST", "/api/admin/project/approve", adminApproveProject),
  r("POST", "/api/admin/project/reject", adminRejectProject),
  r("POST", "/api/admin/project/pause", adminPauseProject),
  r("POST", "/api/admin/project/resume", adminResumeProject),
  r("GET", "/api/admin/canonico", adminCanonList),
  r("POST", "/api/admin/canonico/approve", adminCanonApprove),
  r("POST", "/api/admin/canonico/reject", adminCanonReject),
  r("POST", "/api/visual/prompts/enhance", enhancePrompt),
  r("POST", "/api/visual/generations", createGeneration),
  r("GET", "/api/visual/generations/:id", getGenerationStatus),
  r("POST", "/api/visual/context/preview", previewContext),
  r("GET", "/api/visual/entities", listVisualEntities),
  r("POST", "/api/visual/entities", createVisualEntity),
  r("PUT", "/api/visual/entities/:id", updateVisualEntity),
  r("GET", "/api/visual/entities/:id", getVisualEntity),
  r("GET", "/api/visual/entities/:id/assets", listEntityAssets),
  r("GET", "/api/visual/gallery", listGallery),
  r("GET", "/api/visual/coverage", getVisualCoverage),
  r("GET", "/api/player/correspondencia", listRecipients),
  // Antes da rota com parâmetro: "novas" seria capturado como chave de Casa.
  r("GET", "/api/player/correspondencia/novas", countIncoming),
  r("GET", "/api/player/correspondencia/:houseKey", getThread),
  r("POST", "/api/player/correspondencia", sendMessage),
  r("GET", "/api/admin/correspondencia", adminDiplomacy),
  r("POST", "/api/admin/correspondencia/mundo", sendWorldLetters),
  r("DELETE", "/api/admin/correspondencia/carta/:id", withdrawLetter),
  r("GET", "/api/admin/relacoes", adminListRelations),
  r("PUT", "/api/admin/relacoes", adminPutRelation),
  r("POST", "/api/admin/correspondencia/fatos/:id/revogar", revokeFact),
  r("GET", "/api/visual/style-bible", getStyleBible),
  r("PUT", "/api/visual/style-bible", updateStyleBible),
  r("POST", "/api/admin/visual/seed", seedVisual),
  r("GET", "/api/visual/assets/:id", getVisualAsset),
  r("POST", "/api/visual/assets/:id/canonize", canonizeAsset),
  r("POST", "/api/visual/assets/:id/lock", lockAsset),
  r("POST", "/api/visual/assets/:id/unlock", unlockAsset),
  r("DELETE", "/api/visual/assets/:id", deleteAsset),
];

export async function route(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  try {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(req.path);
      if (!match) continue;
      const pathParams: Record<string, string> = {};
      route.params.forEach((name, i) => (pathParams[name] = match[i + 1]));
      return await route.handler(deps, { ...req, pathParams });
    }
    return { status: 404, body: { code: "NOT_FOUND", message: "Rota não encontrada." } };
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, body: { code: e.code, message: e.message } };
    }
    console.error("Unhandled error", (e as Error)?.name, (e as Error)?.message);
    return { status: 500, body: { code: "INTERNAL", message: "Erro interno." } };
  }
}
