import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishCanonSubmission } from "./publish";
import { newCanonSubmission, type CanonSubmission } from "@ravenloft/content";

vi.mock("../db/wiki", () => ({ putWikiEntry: vi.fn(async (_d, _t, _c, e) => e), generateWikiId: vi.fn(() => "wiki01") }));
vi.mock("../db/visual/entities", () => ({ putEntity: vi.fn(), listEntities: vi.fn(async () => []) }));
vi.mock("../db/visual/assets", () => ({ putAsset: vi.fn() }));

import * as wikiDb from "../db/wiki";
import * as entitiesDb from "../db/visual/entities";
import * as assetsDb from "../db/visual/assets";

function submission(over: Partial<CanonSubmission> = {}): CanonSubmission {
  return {
    ...newCanonSubmission({
      id: "sub1",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "Quero criar Sera.",
      rawImageUrl: "https://cdn/canon/img1/original.png",
      rawImageKey: "canon/img1/original.png",
      proposal: {
        title: "Sera de Vargen",
        section: "casas",
        body: "Batedora das fronteiras.",
        summary: "Batedora.",
        entityType: "CHARACTER",
        canonicalName: "Sera de Vargen",
        immutableTraits: ["cicatriz no queixo"],
        houseId: "vargen",
      },
    }),
    ...over,
  };
}

let ids = 0;
const deps = () => ({
  doc: {} as never,
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  newId: () => `id${++ids}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  ids = 0;
});

describe("publishCanonSubmission", () => {
  it("creates wiki entry, entity and asset, then marks it approved", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const result = await publishCanonSubmission(deps(), submission(), save);

    expect(result.status).toBe("APPROVED");
    expect(result.resolvedAt).not.toBeNull();
    expect(result.wikiEntryId).toBe("wiki01");
    expect(result.visualEntityId).toBe("id1");
    expect(result.visualAssetId).toBe("id2");

    const entry = vi.mocked(wikiDb.putWikiEntry).mock.calls[0][3];
    expect(entry.section).toBe("casas");
    expect(entry.title).toBe("Sera de Vargen");
    expect(entry.imageUrl).toBe("https://cdn/canon/img1/original.png");

    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.entityType).toBe("CHARACTER");
    expect(entity.slug).toBe("sera-de-vargen");
    expect(entity.wikiEntryId).toBe("wiki01");
    expect(entity.status).toBe("CANONICAL");
    expect(entity.immutableTraits.length).toBe(1);
    expect(entity.canonicalAssetIds).toEqual(["id2"]);

    const asset = vi.mocked(assetsDb.putAsset).mock.calls[0][3];
    expect(asset.entityId).toBe("id1");
    expect(asset.canonicalLevel).toBe("CANONICAL");
    expect(asset.storageKey).toBe("canon/img1/original.png");

    // salva depois de cada passo e no fim
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("skips steps whose id is already recorded", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const partial = submission({ wikiEntryId: "wiki-antigo", visualEntityId: "ent-antiga" });
    const result = await publishCanonSubmission(deps(), partial, save);

    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
    expect(assetsDb.putAsset).toHaveBeenCalledTimes(1);
    expect(result.wikiEntryId).toBe("wiki-antigo");
    expect(result.visualEntityId).toBe("ent-antiga");
    expect(result.status).toBe("APPROVED");
  });

  it("leaves the submission pending when a step throws, keeping earlier ids", async () => {
    vi.mocked(entitiesDb.putEntity).mockRejectedValueOnce(new Error("dynamo down"));
    const save = vi.fn(async (s: CanonSubmission) => s);
    await expect(publishCanonSubmission(deps(), submission(), save)).rejects.toThrow("dynamo down");

    const lastSaved = save.mock.calls[save.mock.calls.length - 1][0];
    expect(lastSaved.wikiEntryId).toBe("wiki01");
    expect(lastSaved.visualEntityId).toBeNull();
    expect(lastSaved.status).toBe("PENDING_GM");
  });

  it("skips entity and asset when the proposal has no entity type", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const sub = submission();
    const result = await publishCanonSubmission(deps(), { ...sub, proposal: { ...sub.proposal, entityType: null } }, save);
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
    expect(assetsDb.putAsset).not.toHaveBeenCalled();
    expect(result.status).toBe("APPROVED");
    expect(result.visualEntityId).toBeNull();
  });

  it("skips the asset when there is no uploaded image", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const result = await publishCanonSubmission(deps(), submission({ rawImageUrl: null, rawImageKey: null }), save);
    expect(entitiesDb.putEntity).toHaveBeenCalledTimes(1);
    expect(assetsDb.putAsset).not.toHaveBeenCalled();
    expect(result.visualAssetId).toBeNull();
    expect(result.status).toBe("APPROVED");
  });

  it("disambiguates a slug that is already taken", async () => {
    vi.mocked(entitiesDb.listEntities).mockResolvedValueOnce([{ slug: "sera-de-vargen" } as never]);
    const save = vi.fn(async (s: CanonSubmission) => s);
    await publishCanonSubmission(deps(), submission(), save);
    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.slug).not.toBe("sera-de-vargen");
    expect(entity.slug.startsWith("sera-de-vargen-")).toBe(true);
  });

  it("refuses to publish into a non-canon wiki section", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const sub = submission();
    await expect(
      publishCanonSubmission(deps(), { ...sub, proposal: { ...sub.proposal, section: "campanha-dnd" } }, save),
    ).rejects.toThrow();
    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
  });

  it("does not duplicate the wiki entry when publish is retried after a mid-run failure", async () => {
    // Primeira tentativa: cria o verbete e a entidade, mas a imagem falha.
    vi.mocked(assetsDb.putAsset).mockRejectedValueOnce(new Error("s3 down"));
    const store: { current: CanonSubmission } = { current: submission() };
    const save = vi.fn(async (s: CanonSubmission) => {
      store.current = s;
      return s;
    });

    await expect(publishCanonSubmission(deps(), store.current, save)).rejects.toThrow("s3 down");
    expect(wikiDb.putWikiEntry).toHaveBeenCalledTimes(1);
    expect(entitiesDb.putEntity).toHaveBeenCalledTimes(1);
    expect(store.current.wikiEntryId).toBe("wiki01");
    expect(store.current.visualEntityId).toBe("id1");
    expect(store.current.visualAssetId).toBeNull();

    // Segunda tentativa (retomada): reaproveita os ids já gravados.
    vi.mocked(wikiDb.putWikiEntry).mockClear();
    vi.mocked(entitiesDb.putEntity).mockClear();
    const result = await publishCanonSubmission(deps(), store.current, save);

    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
    expect(result.wikiEntryId).toBe("wiki01");
    expect(result.visualEntityId).toBe("id1");
    expect(result.visualAssetId).not.toBeNull();
    expect(result.status).toBe("APPROVED");
  });
});
