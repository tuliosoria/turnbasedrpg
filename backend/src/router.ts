import type { HandlerRequest, HandlerResponse } from "./types/domain";
import { HttpError } from "./types/domain";
import { getCampaign, getHouseExample, createAccountAndHouse, login, type Deps } from "./routes/publicRoutes";
import { getGame, submitOrder } from "./routes/playerRoutes";
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, resetCampaign } from "./routes/adminRoutes";

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
  r("POST", "/api/create-account", createAccountAndHouse),
  r("POST", "/api/player/login", login),
  r("GET", "/api/player/game", getGame),
  r("PUT", "/api/player/order", submitOrder),
  r("POST", "/api/admin/login", adminLogin),
  r("GET", "/api/admin/dashboard", getDashboard),
  r("POST", "/api/admin/turn/compose", composeTurn),
  r("POST", "/api/admin/turn/open", openTurn),
  r("POST", "/api/admin/turn/lock", lockTurn),
  r("POST", "/api/admin/turn/unlock", unlockTurn),
  r("POST", "/api/admin/turn/draft-private", draftPrivateInfo),
  r("POST", "/api/admin/turn/draft-resolution", draftResolution),
  r("POST", "/api/admin/turn/apply", applyResolution),
  r("POST", "/api/admin/house/create", createHouse),
  r("POST", "/api/admin/house/update", updateHouse),
  r("POST", "/api/admin/house/delete", deleteHouse),
  r("POST", "/api/admin/reset", resetCampaign),
  r("GET", "/api/admin/world-bible", getWorldBible),
  r("PUT", "/api/admin/world-bible", putWorldBible),
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
