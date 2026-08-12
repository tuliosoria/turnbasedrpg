import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import { verifyToken } from "./tokens";

/**
 * Non-throwing admin check. Used where a missing token is a legitimate
 * anonymous request rather than an error — the Estúdio is open to players, and
 * the GM merely bypasses its rate limits.
 */
export function isAdminRequest(config: Config, req: HandlerRequest): boolean {
  const header = req.headers["authorization"] ?? req.headers["Authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = token ? verifyToken(token, config.tokenSigningSecret) : null;
  return !!payload && payload.type === "admin" && payload.campaignId === config.campaignId;
}

export function requireAdmin(config: Config, req: HandlerRequest): void {
  if (!isAdminRequest(config, req)) {
    throw new HttpError(401, "SESSION_EXPIRED", "Sessão de admin expirada.");
  }
}
