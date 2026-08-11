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

import { listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible, getVisualAsset } from "./visualRoutes";

describe("entity and asset routes", () => {
  const entityItem = { PK: "x", SK: "VENTITY#alic", id: "alic", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", canonicalAssetIds: [] };
  const assetItem = (over: any = {}) => ({ PK: "x", SK: "VASSET#a1", id: "a1", entityId: "alic", canonicalLevel: "DRAFT", ...over });

  it("listVisualEntities returns entities", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [entityItem] })) } as any;
    const res = await listVisualEntities(makeDeps({ doc }), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: {} });
    expect((res.body as any).entries).toHaveLength(1);
  });
  it("getVisualEntity 404 when missing", async () => {
    const res = await getVisualEntity(makeDeps(), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: { id: "nope" } });
    expect(res.status).toBe(404);
  });
  it("listGallery returns only CANONICAL/LOCKED assets", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [assetItem({ canonicalLevel: "CANONICAL" }), assetItem({ id: "a2", canonicalLevel: "DRAFT" })] })) } as any;
    const res = await listGallery(makeDeps({ doc }), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: {} });
    expect((res.body as any).entries).toHaveLength(1);
  });
  it("canonizeAsset promotes DRAFT to CANONICAL", async () => {
    const doc = { send: vi.fn(async () => ({ Item: assetItem(), Attributes: {} })) } as any;
    const res = await canonizeAsset(makeDeps({ doc }), { method: "POST", path: "/x", headers: {}, body: undefined, pathParams: { id: "a1" } });
    expect(res.status).toBe(200);
    const update = doc.send.mock.calls.at(-1)[0];
    expect(update.input.ExpressionAttributeValues[":level"]).toBe("CANONICAL");
  });
  it("deleteAsset is blocked when LOCKED", async () => {
    const doc = { send: vi.fn(async () => ({ Item: assetItem({ canonicalLevel: "LOCKED" }) })) } as any;
    await expect(deleteAsset(makeDeps({ doc }), { method: "DELETE", path: "/x", headers: {}, body: undefined, pathParams: { id: "a1" } })).rejects.toThrow();
  });
  it("getStyleBible returns the active bible or 404", async () => {
    const res = await getStyleBible(makeDeps(), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: {} });
    expect(res.status).toBe(404);
  });
  it("listEntityAssets filters by entityId", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [assetItem(), assetItem({ id: "a2", entityId: "other" })] })) } as any;
    const res = await listEntityAssets(makeDeps({ doc }), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: { id: "alic" } });
    expect((res.body as any).entries).toHaveLength(1);
  });
  it("lockAsset sets canonicalLevel to LOCKED", async () => {
    const doc = { send: vi.fn(async () => ({ Item: assetItem(), Attributes: {} })) } as any;
    const res = await lockAsset(makeDeps({ doc }), { method: "POST", path: "/x", headers: {}, body: undefined, pathParams: { id: "a1" } });
    expect(res.status).toBe(200);
    const update = doc.send.mock.calls.at(-1)[0];
    expect(update.input.ExpressionAttributeValues[":level"]).toBe("LOCKED");
  });
  it("unlockAsset sets canonicalLevel back to CANONICAL", async () => {
    const doc = { send: vi.fn(async () => ({ Item: assetItem({ canonicalLevel: "LOCKED" }), Attributes: {} })) } as any;
    const res = await unlockAsset(makeDeps({ doc }), { method: "POST", path: "/x", headers: {}, body: undefined, pathParams: { id: "a1" } });
    expect(res.status).toBe(200);
    const update = doc.send.mock.calls.at(-1)[0];
    expect(update.input.ExpressionAttributeValues[":level"]).toBe("CANONICAL");
  });
  it("getVisualAsset returns the asset by id", async () => {
    const doc = { send: vi.fn(async () => ({ Item: assetItem({ canonicalLevel: "DRAFT" }) })) } as any;
    const res = await getVisualAsset(makeDeps({ doc }), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: { id: "a1" } });
    expect(res.status).toBe(200);
    expect((res.body as any).id).toBe("a1");
  });
  it("getVisualAsset 404 when missing", async () => {
    const doc = { send: vi.fn(async () => ({ Item: undefined })) } as any;
    const res = await getVisualAsset(makeDeps({ doc }), { method: "GET", path: "/x", headers: {}, body: undefined, pathParams: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

import { previewContext } from "./visualRoutes";

describe("previewContext", () => {
  it("returns operation, warnings and reference count for an entity with a canonical asset", async () => {
    const doc = { send: vi.fn(async (cmd: any) => {
      const sk = cmd?.input?.Key?.SK ?? "";
      if (sk.startsWith("VENTITY#")) return { Item: { PK: "x", SK: sk, id: "alic", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", status: "CANONICAL", immutableTraits: ["cicatriz"], canonicalAssetIds: ["a1"] } };
      return { Items: [{ PK: "x", SK: "VASSET#a1", id: "a1", entityId: "alic", canonicalLevel: "CANONICAL" }] };
    }) } as any;
    const res = await previewContext(makeDeps({ doc }), { method: "POST", path: "/x", headers: {}, body: { requestText: "Alic sorrindo", entityId: "alic" }, pathParams: {}, sourceIp: "1.2.3.4" });
    expect((res.body as any).operation).toBe("EDIT");
    expect((res.body as any).referenceCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray((res.body as any).warnings)).toBe(true);
  });
});
