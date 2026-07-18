import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import { verifyToken, type PlayerTokenPayload } from "./tokens";

export function requirePlayer(config: Config, req: HandlerRequest): PlayerTokenPayload {
  const header = req.headers["authorization"] ?? req.headers["Authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = token ? verifyToken(token, config.tokenSigningSecret) : null;
  if (!payload || payload.type !== "player" || payload.campaignId !== config.campaignId) {
    throw new HttpError(401, "SESSION_EXPIRED", "Sessão expirada.");
  }
  return payload;
}
