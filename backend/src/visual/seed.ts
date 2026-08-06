import { newVisualEntity, type VisualStyleBible, type VisualEntity, type VisualAsset, type VisualEntityType, type CanonicalLevel } from "@ravenloft/content";

export interface SeedItem {
  file: string;
  entityId: string;
  entityType: VisualEntityType;
  name: string;
  slug: string;
  assetType: VisualAsset["assetType"];
  canonicalLevel: CanonicalLevel;
  description: string;
}

export const SEED_ITEMS: SeedItem[] = [
  { file: "Principe Alic Valerius.png", entityId: "alic-valerius", entityType: "CHARACTER", name: "Príncipe Alic Valerius", slug: "alic-valerius", assetType: "PORTRAIT", canonicalLevel: "CANONICAL", description: "Retrato do Príncipe Alic Valerius" },
  { file: "Lady Celene Valerius.png", entityId: "celene-valerius", entityType: "CHARACTER", name: "Lady Celene Valerius", slug: "celene-valerius", assetType: "PORTRAIT", canonicalLevel: "CANONICAL", description: "Retrato de Lady Celene Valerius" },
  { file: "Mapa Oficial.png", entityId: "mapa-valdren", entityType: "MAP", name: "Mapa Oficial de Valdren", slug: "mapa-valdren", assetType: "MAP", canonicalLevel: "LOCKED", description: "Mapa Oficial de Valdren (travado)" },
  { file: "Khar-Durak.png", entityId: "khar-durak", entityType: "CITY", name: "Khar-Durak", slug: "khar-durak", assetType: "ESTABLISHING", canonicalLevel: "CANONICAL", description: "Cidade de Khar-Durak" },
  { file: "Euralune Cidade - Ninho Alto.png", entityId: "euralune", entityType: "CITY", name: "Euralune (Ninho Alto)", slug: "euralune", assetType: "ESTABLISHING", canonicalLevel: "CANONICAL", description: "Cidade de Euralune, o Ninho Alto" },
  { file: "Solarion Sahra-Lun.png", entityId: "solarion", entityType: "CITY", name: "Solarion (Sahra-Lun)", slug: "solarion", assetType: "ESTABLISHING", canonicalLevel: "CANONICAL", description: "Cidade de Solarion, Sahra-Lun" },
  { file: "Elfos de Solarion.png", entityId: "elfos-solarion", entityType: "ANCESTRY", name: "Elfos de Solarion", slug: "elfos-solarion", assetType: "REFERENCE_SHEET", canonicalLevel: "CANONICAL", description: "Elfos de Solarion" },
  { file: "Elfos de Sahra-Lun.png", entityId: "elfos-sahra-lun", entityType: "ANCESTRY", name: "Elfos de Sahra-Lun", slug: "elfos-sahra-lun", assetType: "REFERENCE_SHEET", canonicalLevel: "CANONICAL", description: "Elfos de Sahra-Lun" },
  { file: "Gnomos de Euralune.png", entityId: "gnomos-euralune", entityType: "ANCESTRY", name: "Gnomos de Euralune", slug: "gnomos-euralune", assetType: "REFERENCE_SHEET", canonicalLevel: "CANONICAL", description: "Gnomos de Euralune" },
  { file: "Mandibula de Osso.png", entityId: "mandibula-de-osso", entityType: "CREATURE", name: "Clã Mandíbula de Osso", slug: "mandibula-de-osso", assetType: "REFERENCE_SHEET", canonicalLevel: "CANONICAL", description: "Clã Mandíbula de Osso" },
];

export interface SeedDeps {
  getActiveStyleBible: (campaignId: string) => Promise<VisualStyleBible | null>;
  putStyleBible: (campaignId: string, b: VisualStyleBible) => Promise<void>;
  getEntity: (campaignId: string, id: string) => Promise<VisualEntity | null>;
  putEntity: (campaignId: string, e: VisualEntity) => Promise<void>;
  putAsset: (campaignId: string, a: VisualAsset) => Promise<void>;
  loadSeedImage: (file: string) => Promise<Buffer>;
  uploadAsset: (assetId: string, original: Buffer) => Promise<{ key: string; url: string; thumbnailKey: string | null; thumbnailUrl: string | null }>;
  newId: () => string;
  now: () => string;
}

export interface SeedSummary { styleBibleCreated: boolean; entitiesCreated: number; assetsCreated: number }

export function buildStyleBibleV1(campaignId: string, now: string): VisualStyleBible {
  return {
    campaignId, version: 1, status: "ACTIVE",
    artMedium: "pintura digital cinematográfica",
    renderingStyle: "dark fantasy gótico medieval, Ravenloft, muito detalhado",
    lightingRules: "tons frios, atmosfera pesada, neve, névoa e iluminação dramática",
    colorPalette: "tons frios e sombrios",
    architectureRenderingRules: "arquitetura gótica medieval consistente entre imagens",
    characterRenderingRules: "identidade facial sempre preservada entre imagens",
    prohibitedStyles: ["anime", "cartoon", "fotografia moderna"],
    globalNegativeInstructions: ["sem texto", "sem marca dágua", "sem molduras"],
    referenceAssetIds: [],
    createdAt: now,
  };
}

export async function seedVisualEncyclopedia(deps: SeedDeps, campaignId: string): Promise<SeedSummary> {
  let styleBibleCreated = false;
  const existingBible = await deps.getActiveStyleBible(campaignId);
  if (!existingBible) {
    await deps.putStyleBible(campaignId, buildStyleBibleV1(campaignId, deps.now()));
    styleBibleCreated = true;
  }

  let entitiesCreated = 0;
  let assetsCreated = 0;

  for (const item of SEED_ITEMS) {
    const existing = await deps.getEntity(campaignId, item.entityId);
    if (!existing) {
      const entity = newVisualEntity({ id: item.entityId, campaignId, entityType: item.entityType, canonicalName: item.name, slug: item.slug, publicDescription: item.description });
      entity.status = item.canonicalLevel === "LOCKED" ? "LOCKED" : "CANONICAL";
      await deps.putEntity(campaignId, entity);
      entitiesCreated++;
    }

    const buffer = await deps.loadSeedImage(item.file);
    const assetId = deps.newId();
    const up = await deps.uploadAsset(assetId, buffer);
    const asset: VisualAsset = {
      id: assetId, campaignId, entityId: item.entityId, assetType: item.assetType,
      storageKey: up.key, storageUrl: up.url, thumbnailStorageKey: up.thumbnailKey, thumbnailUrl: up.thumbnailUrl,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "",
      status: "READY", canonicalLevel: item.canonicalLevel, styleBibleVersion: 1, entityVersion: 1,
      generationId: null, parentAssetIds: [], referenceRoles: item.entityType === "MAP" ? ["GEOGRAPHY"] : ["IDENTITY"],
      cameraAngle: "", viewType: "", description: item.description, extractedVisualDescription: "",
      consistencyScore: null, consistencyReport: null, tags: ["seed"], createdAt: deps.now(),
    };
    await deps.putAsset(campaignId, asset);
    assetsCreated++;
  }

  return { styleBibleCreated, entitiesCreated, assetsCreated };
}
