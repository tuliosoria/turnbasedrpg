import { describe, it, expect, vi } from "vitest";
import { seedVisualEncyclopedia, SEED_ITEMS, type SeedDeps } from "./seed";

function makeDeps(over: Partial<SeedDeps> = {}): SeedDeps {
  return {
    getActiveStyleBible: vi.fn(async () => null),
    putStyleBible: vi.fn(async () => {}),
    getEntity: vi.fn(async () => null),
    putEntity: vi.fn(async () => {}),
    putAsset: vi.fn(async () => {}),
    listAssets: vi.fn(async () => []),
    loadSeedImage: vi.fn(async () => Buffer.from("img")),
    uploadAsset: vi.fn(async (id: string) => ({ key: `visual/${id}/original.png`, url: `https://x/${id}.png`, thumbnailKey: null, thumbnailUrl: null })),
    newId: (() => { let n = 0; return () => `id-${n++}`; })(),
    now: () => "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("seedVisualEncyclopedia", () => {
  it("seeds StyleBible v1, entities and 10 assets on a fresh campaign", async () => {
    const deps = makeDeps();
    const summary = await seedVisualEncyclopedia(deps, "winter-dead");
    expect(deps.putStyleBible).toHaveBeenCalledTimes(1);
    expect(deps.putAsset).toHaveBeenCalledTimes(SEED_ITEMS.length);
    expect(summary.assetsCreated).toBe(SEED_ITEMS.length);
    expect(summary.entitiesCreated).toBeGreaterThan(0);
  });
  it("marks the Mapa Oficial asset as LOCKED", async () => {
    const deps = makeDeps();
    await seedVisualEncyclopedia(deps, "winter-dead");
    const lockedCall = (deps.putAsset as any).mock.calls.find((c: any[]) => c[1].description.includes("Mapa"));
    expect(lockedCall[1].canonicalLevel).toBe("LOCKED");
  });
  it("does not recreate the StyleBible when one is already active", async () => {
    const deps = makeDeps({ getActiveStyleBible: vi.fn(async () => ({ version: 1 } as any)) });
    await seedVisualEncyclopedia(deps, "winter-dead");
    expect(deps.putStyleBible).not.toHaveBeenCalled();
  });
  it("does not recreate an entity that already exists", async () => {
    const deps = makeDeps({ getEntity: vi.fn(async () => ({ id: "exists" } as any)) });
    const summary = await seedVisualEncyclopedia(deps, "winter-dead");
    expect(summary.entitiesCreated).toBe(0);
  });

  it("skips an item that already has a CANONICAL or LOCKED asset of the same type", async () => {
    const deps = makeDeps({
      listAssets: vi.fn(async () => [
        { entityId: "mapa-valdren", assetType: "MAP" as const, canonicalLevel: "LOCKED" as const },
        { entityId: "alic-valerius", assetType: "PORTRAIT" as const, canonicalLevel: "CANONICAL" as const },
        { entityId: "khar-durak", assetType: "ESTABLISHING" as const, canonicalLevel: "DRAFT" as const },
        { entityId: "euralune", assetType: "PORTRAIT" as const, canonicalLevel: "LOCKED" as const },
      ]),
    });
    const summary = await seedVisualEncyclopedia(deps, "winter-dead");
    const uploaded = (deps.putAsset as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1].entityId);
    expect(uploaded).not.toContain("mapa-valdren");
    expect(uploaded).not.toContain("alic-valerius");
    expect(uploaded).toContain("khar-durak");
    expect(uploaded).toContain("euralune");
    expect(deps.loadSeedImage).not.toHaveBeenCalledWith("Mapa Oficial.png");
    expect(deps.loadSeedImage).not.toHaveBeenCalledWith("Principe Alic Valerius.png");
    expect(summary.assetsCreated).toBe(SEED_ITEMS.length - 2);
  });
});
