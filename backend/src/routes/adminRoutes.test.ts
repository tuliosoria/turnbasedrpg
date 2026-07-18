import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { adminLogin, getDashboard, lockTurn, unlockTurn } from "./adminRoutes";
import { hashCode } from "../auth/codes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const ADMIN_CODE = "admin-secret";
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: hashCode(ADMIN_CODE),
  tokenSigningSecret: "secret", allowedOrigin: "*", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const adminToken = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60000 }, "secret");
const authReq = (over = {}) => ({
  method: "GET", path: "/", headers: { authorization: `Bearer ${adminToken}` },
  body: undefined, pathParams: {}, ...over,
});

beforeEach(() => ddb.reset());

describe("adminLogin", () => {
  it("returns a token for the correct code", async () => {
    const res = await adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: ADMIN_CODE } });
    expect(res.status).toBe(200);
    expect((res.body as any).adminToken).toBeTruthy();
  });

  it("rejects a wrong code", async () => {
    await expect(adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: "wrong" } }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("getDashboard", () => {
  it("returns all six rows reflecting claims and choices", async () => {
    ddb.on(QueryCommand).callsFake((input) => {
      if (String(input.ExpressionAttributeValues[":pk"]).includes("TURN")) {
        return { Items: [{ houseId: "vargen", cardId: "vargen-defend-bridge", chosenAt: "t" }] };
      }
      return { Items: [{ SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" }] };
    });
    ddb.on(GetCommand).resolves({}); // turn status OPEN
    const res = await getDashboard(deps, authReq());
    const body = res.body as any;
    expect(body.rows).toHaveLength(6);
    const vargen = body.rows.find((r: any) => r.houseId === "vargen");
    expect(vargen.claimed).toBe(true);
    expect(vargen.cardId).toBe("vargen-defend-bridge");
    expect(body.summaryText).toContain("Defender a Ponte");
  });

  it("rejects a request without an admin token", async () => {
    await expect(getDashboard(deps, { method: "GET", path: "/", headers: {}, pathParams: {}, body: undefined }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("lock/unlock", () => {
  it("locks and unlocks the active turn", async () => {
    ddb.on(PutCommand).resolves({});
    expect((await lockTurn(deps, authReq({ method: "POST" }))).status).toBe(204);
    expect((await unlockTurn(deps, authReq({ method: "POST" }))).status).toBe(204);
    const puts = ddb.commandCalls(PutCommand);
    expect(puts[0].args[0].input.Item!.turnStatus).toBe("LOCKED");
    expect(puts[1].args[0].input.Item!.turnStatus).toBe("OPEN");
  });
});
