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

describe("createGeneration rate limits", () => {
  /**
   * Counts real hits per rate-limit bucket, so a test can drive the same
   * endpoint repeatedly and see the ceilings trip where they actually would.
   * Buckets are keyed `RATELIMIT#<bucketKey>` by rateLimitPk.
   */
  function makeCountingDeps(over: Partial<Deps> = {}) {
    const hits = new Map<string, number>();
    const doc = {
      send: vi.fn(async (cmd: any) => {
        const pk = cmd?.input?.Key?.PK;
        const sk = cmd?.input?.Key?.SK;
        if (typeof pk === "string" && pk.startsWith("RATELIMIT#")) {
          // Key on PK+SK like the real table: SK carries the window bucket, so
          // two different windows are two different counters.
          const key = `${pk}|${sk}`;
          const n = (hits.get(key) ?? 0) + 1;
          hits.set(key, n);
          return { Attributes: { count: n } };
        }
        return { Items: [], Item: undefined };
      }),
    } as unknown as DynamoDBDocumentClient;
    return { deps: { doc, config, invokeWorker: vi.fn(async () => {}), ...over } as unknown as Deps, hits };
  }

  function playerReq(ip = "1.2.3.4") {
    return { method: "POST", path: "/api/visual/generations", headers: {}, body: { requestText: "castelo nevado" }, pathParams: {}, sourceIp: ip };
  }

  function adminReqGen(ip = "1.2.3.4") {
    const token = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60000 }, "s3cret");
    return { method: "POST", path: "/api/visual/generations", headers: { authorization: `Bearer ${token}` }, body: { requestText: "castelo nevado" }, pathParams: {}, sourceIp: ip };
  }

  const limitConfig = { tableName: "t", campaignId: "winter-dead", tokenSigningSecret: "s3cret" } as unknown as Config;

  it("blocks a second generation from the same IP within the cooldown", async () => {
    const { deps } = makeCountingDeps({ config: limitConfig } as Partial<Deps>);
    const first = await createGeneration(deps, playerReq() as any);
    expect(first.status).toBe(202);
    await expect(createGeneration(deps, playerReq() as any)).rejects.toThrow(/Aguarde um minuto/);
  });

  it("blocks the 6th generation in an hour from one IP", async () => {
    const { deps, hits } = makeCountingDeps({ config: limitConfig } as Partial<Deps>);
    // Satisfy the cooldown each time so the hourly ceiling is what trips.
    for (let i = 0; i < 5; i++) {
      for (const k of [...hits.keys()]) if (k.startsWith("RATELIMIT#visual-gen-cd#1.2.3.4|")) hits.set(k, 0);
      const res = await createGeneration(deps, playerReq() as any);
      expect(res.status).toBe(202);
    }
    for (const k of [...hits.keys()]) if (k.startsWith("RATELIMIT#visual-gen-cd#1.2.3.4|")) hits.set(k, 0);
    await expect(createGeneration(deps, playerReq() as any)).rejects.toThrow(/5 gerações por hora/);
  });

  it("blocks past the campaign-wide daily ceiling even from fresh IPs", async () => {
    const { deps } = makeCountingDeps({ config: limitConfig } as Partial<Deps>);
    // A different IP every time: per-IP buckets never trip, so only the
    // campaign-wide counter can stop this. This is the rotation case that
    // per-IP limiting cannot catch.
    for (let i = 0; i < 30; i++) {
      const res = await createGeneration(deps, playerReq(`10.0.0.${i}`) as any);
      expect(res.status).toBe(202);
    }
    await expect(createGeneration(deps, playerReq("10.0.1.1") as any)).rejects.toThrow(/limite diário/i);
  });

  it("keys the daily ceiling per campaign, not per IP", async () => {
    const { deps, hits } = makeCountingDeps({ config: limitConfig } as Partial<Deps>);
    await createGeneration(deps, playerReq("9.9.9.9") as any);
    const dailyKey = [...hits.keys()].find((k) => k.startsWith("RATELIMIT#visual-gen-daily#winter-dead|"));
    expect(dailyKey).toBeTruthy();
    expect(hits.get(dailyKey!)).toBe(1);
  });

  it("lets the admin bypass every limit", async () => {
    const { deps, hits } = makeCountingDeps({ config: limitConfig } as Partial<Deps>);
    for (let i = 0; i < 40; i++) {
      const res = await createGeneration(deps, adminReqGen() as any);
      expect(res.status).toBe(202);
    }
    // No rate-limit bucket was ever touched for the admin.
    expect([...hits.keys()]).toHaveLength(0);
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

import { previewContext, createVisualEntity, updateVisualEntity } from "./visualRoutes";
import { signToken } from "../auth/tokens";

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

const adminConfig = {
  tableName: "t",
  campaignId: "winter-dead",
  tokenSigningSecret: "s3cret",
} as unknown as Config;

function adminReq(body: unknown, pathParams: Record<string, string> = {}) {
  const token = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60000 }, "s3cret");
  return {
    method: "POST",
    path: "/api/visual/entities",
    headers: { authorization: `Bearer ${token}` },
    body,
    pathParams,
    sourceIp: "1.2.3.4",
  };
}

describe("createVisualEntity", () => {
  it("creates an entity and returns 201", async () => {
    const doc = {
      send: vi.fn(async () => ({ Items: [], Item: undefined })),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await createVisualEntity(deps, adminReq({ canonicalName: "Ordem do Sino", entityType: "HOUSE" }) as any);

    expect(res.status).toBe(201);
    expect((res.body as any).canonicalName).toBe("Ordem do Sino");
    expect((res.body as any).immutableTraits).toEqual([]);
    expect((res.body as any).wikiEntryId).toBeNull();
  });

  it("rejects a request without an admin token", async () => {
    const doc = { send: vi.fn(async () => ({})) } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    await expect(
      createVisualEntity(deps, {
        method: "POST", path: "/api/visual/entities", headers: {},
        body: { canonicalName: "X", entityType: "CITY" }, pathParams: {}, sourceIp: "1.2.3.4",
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate slug", async () => {
    const doc = {
      send: vi.fn(async () => ({ Items: [{ id: "e0", slug: "ordem-do-sino", immutableTraits: [] }] })),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    await expect(
      createVisualEntity(deps, adminReq({ canonicalName: "Ordem do Sino", entityType: "HOUSE" }) as any),
    ).rejects.toThrow();
  });
});

describe("updateVisualEntity", () => {
  function withEntity(entity: Record<string, unknown>) {
    const doc = {
      send: vi.fn(async (cmd: any) => (cmd?.input?.Key ? { Item: entity } : {})),
    } as unknown as DynamoDBDocumentClient;
    return { doc, config: adminConfig } as unknown as Deps;
  }

  it("merges provided fields and bumps the version", async () => {
    const deps = withEntity({
      PK: "p", SK: "VENTITY#e1", id: "e1", campaignId: "winter-dead",
      canonicalName: "Khar-Durak", publicDescription: "antiga", entityType: "CITY",
      immutableTraits: [], version: 1, updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await updateVisualEntity(deps, adminReq({ publicDescription: "cidade escavada na montanha" }, { id: "e1" }) as any);

    expect(res.status).toBe(200);
    expect((res.body as any).publicDescription).toBe("cidade escavada na montanha");
    expect((res.body as any).canonicalName).toBe("Khar-Durak");
    expect((res.body as any).version).toBe(2);
  });

  it("mints a real id for a brand-new trait", async () => {
    const deps = withEntity({ PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K", immutableTraits: [], version: 1 });

    const res = await updateVisualEntity(deps, adminReq({ immutableTraits: [{ text: "porto interno protegido" }] }, { id: "e1" }) as any);

    const trait = (res.body as any).immutableTraits[0];
    expect(trait.text).toBe("porto interno protegido");
    expect(trait.id).not.toMatch(/^legacy-/);
    expect(trait.createdAt).toBeTruthy();
  });

  it("mints distinct ids for several brand-new traits at once", async () => {
    const deps = withEntity({ PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K", immutableTraits: [], version: 1 });

    const res = await updateVisualEntity(
      deps,
      adminReq({ immutableTraits: [{ text: "porto interno" }, { text: "muralha dupla" }, { text: "farol negro" }] }, { id: "e1" }) as any,
    );

    const ids = (res.body as any).immutableTraits.map((t: any) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("forces a client-claimed DISCOVERED trait to AUTHORED", async () => {
    const deps = withEntity({ PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K", immutableTraits: [], version: 1 });

    const res = await updateVisualEntity(
      deps,
      adminReq({
        immutableTraits: [
          { id: "forged", text: "o mar é verde", source: "DISCOVERED", originAssetId: "asset-i-do-not-own", createdAt: "2020-01-01T00:00:00.000Z" },
        ],
      }, { id: "e1" }) as any,
    );

    const trait = (res.body as any).immutableTraits[0];
    expect(trait.source).toBe("AUTHORED");
    expect(trait.originAssetId).toBeNull();
    expect(trait.id).not.toBe("forged");
  });

  it("preserves stored provenance on an existing trait and edits only its text", async () => {
    const deps = withEntity({
      PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K", version: 1,
      immutableTraits: [
        { id: "t1", text: "o mar é verde-escuro", source: "DISCOVERED", originAssetId: "a9", createdAt: "2026-02-02T00:00:00.000Z" },
      ],
    });

    const res = await updateVisualEntity(
      deps,
      adminReq({
        immutableTraits: [
          { id: "t1", text: "o mar é verde-escuro e opaco", source: "AUTHORED", originAssetId: null, createdAt: "1999-01-01T00:00:00.000Z" },
        ],
      }, { id: "e1" }) as any,
    );

    const trait = (res.body as any).immutableTraits[0];
    expect(trait.text).toBe("o mar é verde-escuro e opaco");
    expect(trait.source).toBe("DISCOVERED");
    expect(trait.originAssetId).toBe("a9");
    expect(trait.createdAt).toBe("2026-02-02T00:00:00.000Z");
  });

  it("rejects a request without an admin token", async () => {
    const deps = withEntity({ PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K", immutableTraits: [], version: 1 });
    await expect(
      updateVisualEntity(deps, {
        method: "PUT", path: "/api/visual/entities/e1", headers: {},
        body: { publicDescription: "x" }, pathParams: { id: "e1" }, sourceIp: "1.2.3.4",
      }),
    ).rejects.toThrow();
  });

  it("returns 404 for an unknown entity", async () => {
    const doc = { send: vi.fn(async () => ({ Item: undefined })) } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    const res = await updateVisualEntity(deps, adminReq({ publicDescription: "x" }, { id: "nope" }) as any);
    expect(res.status).toBe(404);
  });
});

import { getVisualCoverage } from "./visualRoutes";

describe("getVisualCoverage", () => {
  it("reports totals, per-section counts, and unlinked entities", async () => {
    const wiki = [
      { entryId: "w1", section: "casas", title: "Ordem do Sino", body: "", order: 0, updatedAt: "" },
      { entryId: "w2", section: "cidades", title: "Khar-Durak", body: "", order: 0, updatedAt: "" },
    ];
    const entities = [
      { id: "e1", canonicalName: "Khar-Durak", wikiEntryId: "w2", immutableTraits: [] },
      { id: "e2", canonicalName: "Mapa Oficial", wikiEntryId: null, immutableTraits: [] },
    ];
    const doc = {
      send: vi.fn(async (cmd: any) => {
        const sk = cmd?.input?.ExpressionAttributeValues?.[":sk"];
        if (sk === "WIKI#") return { Items: wiki };
        if (sk === "VENTITY#") return { Items: entities };
        return { Items: [] };
      }),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await getVisualCoverage(deps, {
      method: "GET", path: "/api/visual/coverage", headers: {}, body: undefined, pathParams: {}, sourceIp: "1.2.3.4",
    });

    expect(res.status).toBe(200);
    const b = res.body as any;
    expect(b.totalEntries).toBe(2);
    expect(b.coveredEntries).toBe(1);
    expect(b.sections).toContainEqual({ section: "cidades", total: 1, covered: 1 });
    expect(b.sections).toContainEqual({ section: "casas", total: 1, covered: 0 });
    expect(b.unlinkedEntities).toEqual([{ id: "e2", canonicalName: "Mapa Oficial" }]);
  });
});

import { updateStyleBible } from "./visualRoutes";

describe("updateStyleBible", () => {
  const active = {
    PK: "p", SK: "VSTYLE#0002", campaignId: "winter-dead", version: 2, status: "ACTIVE",
    artMedium: "pintura digital", renderingStyle: "dark fantasy", lightingRules: "fria",
    colorPalette: "fria", architectureRenderingRules: "gótica",
    characterRenderingRules: "identidade preservada", prohibitedStyles: [],
    globalNegativeInstructions: [], referenceAssetIds: [], createdAt: "",
  };

  it("publishes before archiving so a crash never leaves zero active bibles", async () => {
    const puts: any[] = [];
    const doc = {
      send: vi.fn(async (cmd: any) => {
        if (cmd?.input?.Item) { puts.push(cmd.input.Item); return {}; }
        return { Items: [active] };
      }),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await updateStyleBible(deps, adminReq({ renderingStyle: "dark fantasy invernal" }) as any);

    expect(res.status).toBe(200);
    expect((res.body as any).version).toBe(3);
    expect((res.body as any).renderingStyle).toBe("dark fantasy invernal");
    expect((res.body as any).status).toBe("ACTIVE");
    expect(puts.map((i) => [i.version, i.status])).toEqual([
      [3, "ACTIVE"],
      [2, "ARCHIVED"],
    ]);
    expect((res.body as any).artMedium).toBe("pintura digital");
  });

  it("rejects a request without an admin token", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [active] })) } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    await expect(
      updateStyleBible(deps, {
        method: "PUT", path: "/api/visual/style-bible", headers: {},
        body: { renderingStyle: "x" }, pathParams: {}, sourceIp: "1.2.3.4",
      }),
    ).rejects.toThrow();
  });

  it("returns 404 when no style bible exists yet", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [] })) } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    const res = await updateStyleBible(deps, adminReq({ renderingStyle: "x" }) as any);
    expect(res.status).toBe(404);
  });
});


describe("canonizeAsset cria a entidade que faltava", () => {
  function depsWithAsset(asset: Record<string, unknown>) {
    const written: any[] = [];
    const doc = {
      send: vi.fn(async (cmd: any) => {
        if (cmd?.input?.Item) { written.push(cmd.input.Item); return {}; }
        if (cmd?.input?.Key?.SK?.startsWith?.("VASSET#")) return { Item: asset };
        return { Items: [] };
      }),
    } as unknown as DynamoDBDocumentClient;
    return { deps: { doc, config: adminConfig } as unknown as Deps, written };
  }

  const orphan = { PK: "p", SK: "VASSET#a1", id: "a1", entityId: null, assetType: "ESTABLISHING", description: "Capital de Karasoy", canonicalLevel: "DRAFT" };

  it("cria a entidade quando a imagem não pertence a nenhuma", async () => {
    // Uma geração feita por "Adicionar Novo Canônico" não tem entidade. Antes,
    // canonizar deixava a imagem órfã: visível na Galeria e ausente do
    // dropdown, sem como ser continuada.
    const { deps, written } = depsWithAsset(orphan);
    const res = await canonizeAsset(deps, adminReq({ canonicalName: "Ordu-Yildiz" }, { id: "a1" }) as any);

    expect((res.body as any).entityId).toBeTruthy();
    const entity = written.find((w) => w.SK?.startsWith("VENTITY#"));
    expect(entity.canonicalName).toBe("Ordu-Yildiz");
    expect(entity.canonicalAssetIds).toContain("a1");
  });

  it("liga a imagem à entidade recém-criada", async () => {
    const { deps, written } = depsWithAsset(orphan);
    await canonizeAsset(deps, adminReq({ canonicalName: "Ordu-Yildiz" }, { id: "a1" }) as any);
    const saved = written.find((w) => w.SK === "VASSET#a1");
    expect(saved.entityId).toBeTruthy();
    expect(saved.canonicalLevel).toBe("CANONICAL");
  });

  it("usa a descrição do pedido quando o autor não dá nome", async () => {
    // Falta de rótulo não pode impedir a canonização.
    const { deps, written } = depsWithAsset(orphan);
    await canonizeAsset(deps, adminReq({}, { id: "a1" }) as any);
    expect(written.find((w) => w.SK?.startsWith("VENTITY#")).canonicalName).toBe("Capital de Karasoy");
  });

  it("deduz o tipo pelo enquadramento: plano geral vira cidade", async () => {
    const { deps, written } = depsWithAsset(orphan);
    await canonizeAsset(deps, adminReq({}, { id: "a1" }) as any);
    expect(written.find((w) => w.SK?.startsWith("VENTITY#")).entityType).toBe("CITY");
  });

  it("não cria entidade quando a imagem já tem uma", async () => {
    const { deps, written } = depsWithAsset({ ...orphan, entityId: "alic" });
    await canonizeAsset(deps, adminReq({}, { id: "a1" }) as any);
    expect(written.find((w) => w.SK?.startsWith("VENTITY#"))).toBeUndefined();
  });
});
