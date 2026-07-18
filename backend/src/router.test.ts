import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { route } from "./router";
import type { Config } from "./types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: "x",
  tokenSigningSecret: "secret", allowedOrigin: "http://localhost:5173", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const req = (method: string, path: string, over = {}) => ({ method, path, headers: {}, body: undefined, pathParams: {}, ...over });

beforeEach(() => ddb.reset());

describe("route", () => {
  it("dispatches GET /api/campaign", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await route(deps, req("GET", "/api/campaign"));
    expect(res.status).toBe(200);
    expect((res.body as any).contentVersion).toBeTruthy();
  });

  it("dispatches PUT /api/turns/:turnId/choice with a path param", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await route(deps, req("PUT", "/api/turns/2/choice", {
      headers: {}, body: { cardId: "x" },
    }));
    // no auth header -> 401 from requirePlayer (proves routing reached the handler)
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await route(deps, req("GET", "/api/nope"));
    expect(res.status).toBe(404);
  });

  it("maps HttpError to its status without leaking internals", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    const res = await route(deps, req("POST", "/api/claim-house", { body: { houseId: "nope" } }));
    expect(res.status).toBe(400);
    expect((res.body as any).code).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/stack|DynamoDB/i);
  });
});
