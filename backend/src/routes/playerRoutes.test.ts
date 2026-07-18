import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getMe, getGame, submitChoice } from "./playerRoutes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: "x",
  tokenSigningSecret: "secret", allowedOrigin: "*", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const token = (houseId: string) =>
  signToken({ type: "player", campaignId: "winter-dead", houseId, displayName: "Elira", exp: Date.now() + 60000 }, "secret");
const authReq = (houseId: string, over = {}) => ({
  method: "GET", path: "/", headers: { authorization: `Bearer ${token(houseId)}` },
  body: undefined, pathParams: {}, ...over,
});

beforeEach(() => ddb.reset());

describe("getGame", () => {
  it("returns only the caller's own house private content and 3 cards", async () => {
    ddb.on(GetCommand).resolves({}); // turn status + no choice
    const res = await getGame(deps, authReq("vargen"));
    const body = res.body as any;
    expect(body.houseId).toBe("vargen");
    expect(body.cards).toHaveLength(3);
    expect(body.privateInformation.length).toBeGreaterThan(0);
    // must not contain another house's private text
    expect(body.cards.every((c: any) => c.id.startsWith("vargen-"))).toBe(true);
  });

  it("rejects a request without a valid token", async () => {
    await expect(getGame(deps, { method: "GET", path: "/", headers: {}, body: undefined, pathParams: {} }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("submitChoice", () => {
  it("saves a valid card for the caller's house while open", async () => {
    ddb.on(GetCommand).resolves({}); // status OPEN
    ddb.on(PutCommand).resolves({});
    const res = await submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "vargen-defend-bridge" },
    }));
    expect(res.status).toBe(200);
    expect((res.body as any).cardId).toBe("vargen-defend-bridge");
  });

  it("rejects a card that does not belong to the house", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "auremont-send-caravans" },
    }))).rejects.toMatchObject({ status: 400, code: "INVALID_CARD" });
  });

  it("rejects a choice for a non-active turn (version conflict)", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "2" }, body: { cardId: "vargen-defend-bridge" },
    }))).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("blocks a choice when the turn is locked", async () => {
    ddb.on(GetCommand).resolves({ Item: { turnStatus: "LOCKED" } });
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "vargen-defend-bridge" },
    }))).rejects.toMatchObject({ status: 423, code: "TURN_LOCKED" });
  });
});

describe("getMe", () => {
  it("returns the house from the token", async () => {
    const res = await getMe(deps, authReq("ravens"));
    expect((res.body as any).houseId).toBe("ravens");
  });
});
