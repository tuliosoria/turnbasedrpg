import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient, QueryCommand, GetCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { getCampaign, getHouses, claimHouse, login } from "./publicRoutes";
import { verifyToken } from "../auth/tokens";
import { hashCode } from "../auth/codes";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: "x",
  tokenSigningSecret: "secret",
  allowedOrigin: "*",
  tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const req = (over = {}) => ({ method: "GET", path: "/", headers: {}, body: undefined, pathParams: {}, ...over });

beforeEach(() => ddb.reset());

describe("getCampaign", () => {
  it("returns campaign summary with contentVersion and default OPEN status", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await getCampaign(deps, req());
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.title).toMatch(/Inverno dos Mortos/);
    expect(body.contentVersion).toBeTruthy();
    expect(body.turnStatus).toBe("OPEN");
    expect(body.activeTurnId).toBe(1);
  });
});

describe("getHouses", () => {
  it("marks claimed houses unavailable and never leaks private intros", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" }] });
    const res = await getHouses(deps, req());
    const body = res.body as any[];
    expect(body).toHaveLength(6);
    expect(body.find((h) => h.id === "vargen").available).toBe(false);
    expect(body.find((h) => h.id === "ravens").available).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/privateIntroduction/);
  });
});

describe("claimHouse", () => {
  it("claims a free house and returns a code + a valid player token", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    const res = await claimHouse(deps, req({ method: "POST", body: { houseId: "vargen", displayName: "Elira" } }));
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.playerCode).toMatch(/^vargen-[A-Z0-9]{4}$/);
    expect(body.houseId).toBe("vargen");
    const payload = verifyToken(body.playerToken, config.tokenSigningSecret) as any;
    expect(payload.type).toBe("player");
    expect(payload.houseId).toBe("vargen");
  });

  it("rejects an invalid body with 400", async () => {
    await expect(claimHouse(deps, req({ method: "POST", body: { houseId: "nope" } }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("login", () => {
  it("returns a token for a valid code", async () => {
    const code = "vargen-4K7P";
    ddb.on(GetCommand).resolves({ Item: { houseId: "vargen", displayName: "Elira", codeHash: hashCode(code) } });
    const res = await login(deps, req({ method: "POST", body: { playerCode: code } }));
    expect(res.status).toBe(200);
    expect((res.body as any).houseId).toBe("vargen");
  });

  it("rejects an unknown code with INVALID_CODE", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(login(deps, req({ method: "POST", body: { playerCode: "nope-0000" } }))).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CODE",
    });
  });
});
