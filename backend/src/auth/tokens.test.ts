import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type PlayerTokenPayload } from "./tokens";

const SECRET = "test-secret";
const base: PlayerTokenPayload = {
  type: "player",
  campaignId: "winter-dead",
  houseId: "vargen",
  displayName: "Elira",
  exp: Date.now() + 60_000,
};

describe("tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken(base, SECRET);
    expect(verifyToken(token, SECRET)).toEqual(base);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signToken(base, SECRET);
    expect(verifyToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signToken(base, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, houseId: "ravens" }), "utf8").toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = { ...base, exp: Date.now() - 1 };
    expect(verifyToken(signToken(expired, SECRET), SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyToken("not-a-token", SECRET)).toBeNull();
    expect(verifyToken("a.b.c", SECRET)).toBeNull();
    expect(verifyToken("", SECRET)).toBeNull();
  });
});
