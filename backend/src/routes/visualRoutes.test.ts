import { describe, it, expect, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createGeneration, getGenerationStatus } from "./visualRoutes";
import type { Deps } from "./publicRoutes";
import type { Config } from "../types/domain";

const config = { tableName: "t", campaignId: "winter-dead", visualWorkerFunctionName: "worker" } as unknown as Config;

function makeDeps(over: Partial<Deps> = {}): Deps {
  const doc = { send: vi.fn(async () => ({ Items: [], Item: undefined })) } as unknown as DynamoDBDocumentClient;
  return { doc, config, invokeWorker: vi.fn(async () => {}), ...over };
}

describe("createGeneration", () => {
  it("writes a PENDING job, invokes the worker, and returns 202 with generationId", async () => {
    const invoke = vi.fn(async () => {});
    const deps = makeDeps({ invokeWorker: invoke });
    const res = await createGeneration(deps, { method: "POST", path: "/api/visual/generations", headers: {}, body: { requestText: "castelo nevado" }, pathParams: {}, sourceIp: "1.2.3.4" });
    expect(res.status).toBe(202);
    expect((res.body as any).generationId).toBeTruthy();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("rate limits after too many requests", async () => {
    const doc = { send: vi.fn(async () => ({ Attributes: { count: 99 } })) } as unknown as DynamoDBDocumentClient;
    const deps = makeDeps({ doc });
    await expect(createGeneration(deps, { method: "POST", path: "/api/visual/generations", headers: {}, body: { requestText: "x" }, pathParams: {}, sourceIp: "1.2.3.4" }))
      .rejects.toThrow();
  });
});

describe("getGenerationStatus", () => {
  it("returns the generation when found", async () => {
    const doc = { send: vi.fn(async () => ({ Item: { PK: "x", SK: "VGEN#g1", id: "g1", status: "COMPLETED", outputAssetIds: ["a1"] } })) } as unknown as DynamoDBDocumentClient;
    const deps = makeDeps({ doc });
    const res = await getGenerationStatus(deps, { method: "GET", path: "/api/visual/generations/g1", headers: {}, body: undefined, pathParams: { id: "g1" }, sourceIp: "1.2.3.4" });
    expect(res.status).toBe(200);
    expect((res.body as any).status).toBe("COMPLETED");
  });
  it("returns 404 when missing", async () => {
    const deps = makeDeps();
    const res = await getGenerationStatus(deps, { method: "GET", path: "/api/visual/generations/x", headers: {}, body: undefined, pathParams: { id: "x" }, sourceIp: "1.2.3.4" });
    expect(res.status).toBe(404);
  });
});
