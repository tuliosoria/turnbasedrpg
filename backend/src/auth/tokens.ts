import { createHmac, timingSafeEqual } from "node:crypto";

export interface PlayerTokenPayload {
  type: "player";
  campaignId: string;
  houseId: string;
  displayName: string;
  exp: number;
}

export interface AdminTokenPayload {
  type: "admin";
  campaignId: string;
  exp: number;
}

export type TokenPayload = PlayerTokenPayload | AdminTokenPayload;

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signToken(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: string, secret: string, now: number = Date.now()): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, providedSig] = parts;
  if (!body || !providedSig) return null;

  const expectedSig = sign(body, secret);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < now) return null;
  if (payload.type !== "player" && payload.type !== "admin") return null;
  return payload;
}
