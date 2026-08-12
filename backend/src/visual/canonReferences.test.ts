import { describe, it, expect } from "vitest";
import { newVisualEntity, type VisualAsset, type VisualEntity, type WikiEntry } from "@ravenloft/content";
import { resolveCanonReferences } from "./canonReferences";

const wiki: WikiEntry[] = [
  {
    entryId: "w-karasoy", section: "casas", order: 0, updatedAt: "",
    title: "Casa Karasoy — As Filhas da Estrela",
    body: "> **Símbolo:** uma estrela de oito pontas sobre um cavalo branco.\n> **Sede:** Ordu-Yildiz.",
  },
  {
    entryId: "w-vargen", section: "casas", order: 0, updatedAt: "",
    title: "Casa Vargen — Os Lobos da Fronteira",
    body: "> **Símbolo:** um lobo cinzento diante de uma fogueira branca.\n> **Sede:** Droskar.",
  },
];

function entity(id: string, name: string, wikiEntryId: string | null): VisualEntity {
  const e = newVisualEntity({ id, campaignId: "winter-dead", entityType: "HOUSE", canonicalName: name, slug: id });
  e.wikiEntryId = wikiEntryId;
  return e;
}

function asset(over: Partial<VisualAsset> & { id: string; entityId: string | null }): VisualAsset {
  return {
    campaignId: "winter-dead", assetType: "EMBLEM", storageKey: "k", storageUrl: "u",
    thumbnailStorageKey: null, thumbnailUrl: null, mimeType: "image/png", width: 1, height: 1,
    aspectRatio: "1:1", checksum: "c", status: "READY", canonicalLevel: "CANONICAL",
    styleBibleVersion: 1, entityVersion: null, generationId: null, parentAssetIds: [],
    referenceRoles: [], cameraAngle: "", viewType: "", description: "",
    extractedVisualDescription: "", consistencyScore: null, consistencyReport: null,
    tags: [], createdAt: "", ...over,
  };
}

const entities = [entity("karasoy", "Casa Karasoy", "w-karasoy"), entity("vargen", "Casa Vargen", "w-vargen")];
const emblemKarasoy = asset({ id: "em-karasoy", entityId: "karasoy" });
const emblemVargen = asset({ id: "em-vargen", entityId: "vargen" });

describe("resolveCanonReferences", () => {
  it("attaches the emblem of the House the request names", () => {
    // Prose cannot pin heraldry: "estrela de oito pontas sobre um cavalo branco"
    // is satisfied by countless drawings, so only the image holds it steady.
    const out = resolveCanonReferences({
      requestText: "a capital de Karasoy, Ordu-Yildiz",
      entity: null, wikiEntries: wiki, entities, assets: [emblemKarasoy, emblemVargen],
    });
    expect(out.map((a) => a.id)).toEqual(["em-karasoy"]);
  });

  it("does not attach a House the request never mentions", () => {
    const out = resolveCanonReferences({
      requestText: "a capital de Karasoy",
      entity: null, wikiEntries: wiki, entities, assets: [emblemKarasoy, emblemVargen],
    });
    expect(out.map((a) => a.id)).not.toContain("em-vargen");
  });

  it("prefers an explicit emblem over an unrelated canonical image", () => {
    const cityShot = asset({ id: "city", entityId: "karasoy", assetType: "ESTABLISHING" });
    const out = resolveCanonReferences({
      requestText: "Karasoy", entity: null, wikiEntries: wiki, entities,
      assets: [cityShot, emblemKarasoy],
    });
    expect(out.map((a) => a.id)).toEqual(["em-karasoy"]);
  });

  it("falls back to any canonical image when no emblem exists", () => {
    const cityShot = asset({ id: "city", entityId: "karasoy", assetType: "ESTABLISHING" });
    const out = resolveCanonReferences({
      requestText: "Karasoy", entity: null, wikiEntries: wiki, entities, assets: [cityShot],
    });
    expect(out.map((a) => a.id)).toEqual(["city"]);
  });

  it("ignores drafts, which are not canon", () => {
    const draft = asset({ id: "d", entityId: "karasoy", canonicalLevel: "DRAFT" });
    const out = resolveCanonReferences({
      requestText: "Karasoy", entity: null, wikiEntries: wiki, entities, assets: [draft],
    });
    expect(out).toEqual([]);
  });

  it("skips the entity being drawn, whose identity refs are attached separately", () => {
    const out = resolveCanonReferences({
      requestText: "Karasoy", entity: entities[0], wikiEntries: wiki, entities,
      assets: [emblemKarasoy],
    });
    expect(out).toEqual([]);
  });

  it("returns nothing when no entity is linked to the matched entry", () => {
    const unlinked = [entity("karasoy", "Casa Karasoy", null)];
    const out = resolveCanonReferences({
      requestText: "Karasoy", entity: null, wikiEntries: wiki, entities: unlinked, assets: [emblemKarasoy],
    });
    expect(out).toEqual([]);
  });

  it("caps how many emblems it attaches", () => {
    const out = resolveCanonReferences({
      requestText: "Karasoy e Vargen", entity: null, wikiEntries: wiki, entities,
      assets: [emblemKarasoy, emblemVargen], limit: 1,
    });
    expect(out).toHaveLength(1);
  });
});
