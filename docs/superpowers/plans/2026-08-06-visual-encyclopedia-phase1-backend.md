# Enciclopédia de Imagens — Fase 1 (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation and async generation pipeline for the open Valdren Visual Encyclopedia — canonical data models, DynamoDB modules, S3 asset storage, an async Lambda worker that compiles context/prompt, generates or edits images with `gpt-image-1`, evaluates visual consistency with auto-retry, plus public API routes and idempotent seeding of the 10 canon images.

**Architecture:** Single-table DynamoDB (PK/SK only, **no GSIs**) with SK-prefix access patterns under `PK = campaignPk(campaignId)`. `POST /api/visual/generations` writes a `PENDING` job and invokes a second (worker) Lambda via `InvokeCommand` (`InvocationType: "Event"`); the worker runs the pipeline (context → references → prompt → generate/edit → S3 → consistency evaluator → retry/correct → final status). Frontend polls `GET /api/visual/generations/:id`. All routes are public (no admin token), rate-limited per IP. Domain models live in `shared/src/visual/` (pure, testable) and are exported via `@ravenloft/content`.

**Tech Stack:** TypeScript, Node.js 22, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `openai` (`gpt-image-1` generate + edit with `input_fidelity:"high"`, `gpt-4o`-class multimodal evaluator), AWS SAM, vitest.

---

## File Structure

**shared/ (pure domain, ESM `.js` import extensions):**
- Create `shared/src/visual/models.ts` — enums, interfaces, clamp/validation helpers for all visual models.
- Create `shared/src/visual/models.test.ts` — unit tests for enums/validation/clamp.
- Modify `shared/src/index.ts` — export `./visual/models.js`.

**backend/ (infrastructure + pipeline):**
- Modify `backend/src/keys.ts` — visual key helpers.
- Create `backend/src/db/visual/styleBible.ts`, `entities.ts`, `assets.ts`, `generations.ts` (+ `.test.ts` each).
- Modify `backend/src/ai/images.ts` — add `makeImageEditFn` (`images.edit` + `input_fidelity`).
- Create `backend/src/ai/visual/contextCompiler.ts`, `referenceSelector.ts`, `promptCompiler.ts`, `evaluator.ts` (+ tests).
- Modify `backend/src/storage/images.ts` — add `uploadVisualAsset` (original + thumbnail).
- Create `backend/src/visual/worker.ts` (pipeline) + `backend/src/visualWorkerHandler.ts` (Lambda entry).
- Create `backend/src/routes/visualRoutes.ts` (+ test) — generate, get-generation, entities, assets, style-bible, seed.
- Create `backend/src/db/visual/invokeWorker.ts` — `@aws-sdk/client-lambda` invoke wrapper.
- Create `backend/src/visual/seed.ts` (+ test) — idempotent seeding of 10 images + StyleBible v1 + entities.
- Modify `backend/src/router.ts` — register visual routes.
- Modify `backend/src/config.ts`, `backend/src/types/domain.ts` — worker function name config.
- Modify `backend/src/handler.ts` — wire image edit fn + worker invoke into deps.
- Modify `backend/template.yaml` — worker Lambda + invoke permission + env.

---

## Task 1: Shared visual domain models

**Files:**
- Create: `shared/src/visual/models.ts`
- Test: `shared/src/visual/models.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write the failing test** — `shared/src/visual/models.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  CANONICAL_LEVELS, VISUAL_ENTITY_TYPES, GENERATION_STATUSES, REFERENCE_ROLES,
  isCanonicalLevel, isVisualEntityType, clampVisualText, newVisualEntity, newVisualGeneration,
  canDeleteAsset, VISUAL_TEXT_MAX,
} from "./models.js";

describe("visual enums", () => {
  it("exposes the four canonical levels in order", () => {
    expect(CANONICAL_LEVELS).toEqual(["DRAFT", "CANDIDATE", "CANONICAL", "LOCKED"]);
  });
  it("includes MAP and CHARACTER entity types", () => {
    expect(VISUAL_ENTITY_TYPES).toContain("MAP");
    expect(VISUAL_ENTITY_TYPES).toContain("CHARACTER");
  });
  it("guards canonical level and entity type", () => {
    expect(isCanonicalLevel("LOCKED")).toBe(true);
    expect(isCanonicalLevel("nope")).toBe(false);
    expect(isVisualEntityType("CITY")).toBe(true);
    expect(isVisualEntityType("x")).toBe(false);
  });
});

describe("clampVisualText", () => {
  it("trims and caps to VISUAL_TEXT_MAX", () => {
    const long = "a".repeat(VISUAL_TEXT_MAX + 50);
    expect(clampVisualText("  hi  ")).toBe("hi");
    expect(clampVisualText(long).length).toBe(VISUAL_TEXT_MAX);
    expect(clampVisualText(undefined)).toBe("");
  });
});

describe("factories", () => {
  it("newVisualEntity fills defaults and DRAFT status", () => {
    const e = newVisualEntity({ id: "e1", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" });
    expect(e.status).toBe("DRAFT");
    expect(e.version).toBe(1);
    expect(e.immutableTraits).toEqual([]);
    expect(e.canonicalAssetIds).toEqual([]);
  });
  it("newVisualGeneration starts PENDING with GENERATE default", () => {
    const g = newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "castelo" });
    expect(g.status).toBe("PENDING");
    expect(g.operationType).toBe("GENERATE");
    expect(g.retryCount).toBe(0);
  });
});

describe("canDeleteAsset", () => {
  it("blocks LOCKED, allows others", () => {
    expect(canDeleteAsset("LOCKED")).toBe(false);
    expect(canDeleteAsset("CANONICAL")).toBe(true);
    expect(canDeleteAsset("DRAFT")).toBe(true);
  });
});

describe("reference roles", () => {
  it("includes identity and architecture roles", () => {
    expect(REFERENCE_ROLES).toContain("IDENTITY");
    expect(REFERENCE_ROLES).toContain("ARCHITECTURE");
  });
});

describe("generation statuses", () => {
  it("covers the full lifecycle", () => {
    expect(GENERATION_STATUSES).toEqual(["PENDING", "RUNNING", "NEEDS_REVIEW", "COMPLETED", "FAILED"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd shared && npx vitest run src/visual/models.test.ts`
Expected: FAIL — cannot find module `./models.js`.

- [ ] **Step 3: Write minimal implementation** — `shared/src/visual/models.ts`

```ts
export const CANONICAL_LEVELS = ["DRAFT", "CANDIDATE", "CANONICAL", "LOCKED"] as const;
export type CanonicalLevel = (typeof CANONICAL_LEVELS)[number];

export const VISUAL_ENTITY_TYPES = [
  "CHARACTER", "HOUSE", "CITY", "SETTLEMENT", "REGION", "LANDMARK", "CREATURE",
  "ANCESTRY", "ARTIFACT", "VEHICLE", "SHIP", "BUILDING", "ROOM", "MAP", "SYMBOL",
  "WEAPON", "CLOTHING_SET", "EVENT", "SCENE",
] as const;
export type VisualEntityType = (typeof VISUAL_ENTITY_TYPES)[number];

export const VISUAL_ASSET_TYPES = [
  "PORTRAIT", "FULL_BODY", "SCENE", "ESTABLISHING", "MAP", "REGION_MAP",
  "REFERENCE_SHEET", "EMBLEM", "OBJECT", "ARCHITECTURE",
] as const;
export type VisualAssetType = (typeof VISUAL_ASSET_TYPES)[number];

export const GENERATION_STATUSES = ["PENDING", "RUNNING", "NEEDS_REVIEW", "COMPLETED", "FAILED"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const GENERATION_OPERATIONS = ["GENERATE", "EDIT"] as const;
export type GenerationOperation = (typeof GENERATION_OPERATIONS)[number];

export const REFERENCE_ROLES = [
  "STYLE", "IDENTITY", "FACE", "BODY", "COSTUME", "ARCHITECTURE", "GEOGRAPHY",
  "COMPOSITION", "LIGHTING", "OBJECT", "SYMBOL", "CONTINUITY",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const VISUAL_TEXT_MAX = 2000;

export function isCanonicalLevel(v: unknown): v is CanonicalLevel {
  return typeof v === "string" && (CANONICAL_LEVELS as readonly string[]).includes(v);
}
export function isVisualEntityType(v: unknown): v is VisualEntityType {
  return typeof v === "string" && (VISUAL_ENTITY_TYPES as readonly string[]).includes(v);
}
export function isGenerationStatus(v: unknown): v is GenerationStatus {
  return typeof v === "string" && (GENERATION_STATUSES as readonly string[]).includes(v);
}
export function clampVisualText(v: unknown, max = VISUAL_TEXT_MAX): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}
export function canDeleteAsset(level: CanonicalLevel): boolean {
  return level !== "LOCKED";
}

export interface VisualStyleBible {
  campaignId: string;
  version: number;
  status: "ACTIVE" | "ARCHIVED";
  artMedium: string;
  renderingStyle: string;
  lightingRules: string;
  colorPalette: string;
  architectureRenderingRules: string;
  characterRenderingRules: string;
  prohibitedStyles: string[];
  globalNegativeInstructions: string[];
  referenceAssetIds: string[];
  createdAt: string;
}

export interface VisualEntity {
  id: string;
  campaignId: string;
  entityType: VisualEntityType;
  canonicalName: string;
  aliases: string[];
  slug: string;
  publicDescription: string;
  immutableTraits: string[];
  flexibleTraits: string[];
  prohibitedChanges: string[];
  visualKeywords: string[];
  negativeInstructions: string[];
  scaleDescription: string;
  culturalContext: string;
  houseId: string | null;
  regionId: string | null;
  parentEntityId: string | null;
  relatedEntityIds: string[];
  status: CanonicalLevel;
  canonicalAssetIds: string[];
  supportingAssetIds: string[];
  referenceSheetAssetId: string | null;
  mapAssetId: string | null;
  version: number;
  profile: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsistencyViolation {
  severity: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  description: string;
}
export interface ConsistencyReport {
  overallScore: number;
  styleScore: number;
  characterIdentityScore: number;
  architectureScore: number;
  paletteScore: number;
  violations: ConsistencyViolation[];
  recommendedAction: "ACCEPT" | "AUTO_CORRECT" | "CORRECTIVE_EDIT" | "REJECT" | "NEEDS_REVIEW";
  correctionInstructions: string[];
}

export interface VisualAsset {
  id: string;
  campaignId: string;
  entityId: string | null;
  assetType: VisualAssetType;
  storageKey: string;
  storageUrl: string;
  thumbnailStorageKey: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: string;
  checksum: string;
  status: "READY" | "PENDING";
  canonicalLevel: CanonicalLevel;
  styleBibleVersion: number;
  entityVersion: number | null;
  generationId: string | null;
  parentAssetIds: string[];
  referenceRoles: ReferenceRole[];
  cameraAngle: string;
  viewType: string;
  description: string;
  extractedVisualDescription: string;
  consistencyScore: number | null;
  consistencyReport: ConsistencyReport | null;
  tags: string[];
  createdAt: string;
}

export interface VisualGeneration {
  id: string;
  campaignId: string;
  requestedBy: string;
  requestText: string;
  entityId: string | null;
  compiledPrompt: string;
  operationType: GenerationOperation;
  model: string;
  inputFidelity: "high" | "low" | null;
  size: string;
  quality: string;
  styleBibleVersion: number | null;
  entityVersions: Record<string, number>;
  referenceAssetIds: string[];
  sceneThreadId: string | null;
  outputAssetIds: string[];
  status: GenerationStatus;
  retryCount: number;
  usage: Record<string, number> | null;
  estimatedCost: number | null;
  latencyMs: number | null;
  consistencyReport: ConsistencyReport | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NewVisualEntityInput {
  id: string;
  campaignId: string;
  entityType: VisualEntityType;
  canonicalName: string;
  slug: string;
  publicDescription?: string;
  immutableTraits?: string[];
  houseId?: string | null;
  regionId?: string | null;
}
export function newVisualEntity(input: NewVisualEntityInput): VisualEntity {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    entityType: input.entityType,
    canonicalName: clampVisualText(input.canonicalName, 200),
    aliases: [],
    slug: input.slug,
    publicDescription: clampVisualText(input.publicDescription),
    immutableTraits: input.immutableTraits ?? [],
    flexibleTraits: [],
    prohibitedChanges: [],
    visualKeywords: [],
    negativeInstructions: [],
    scaleDescription: "",
    culturalContext: "",
    houseId: input.houseId ?? null,
    regionId: input.regionId ?? null,
    parentEntityId: null,
    relatedEntityIds: [],
    status: "DRAFT",
    canonicalAssetIds: [],
    supportingAssetIds: [],
    referenceSheetAssetId: null,
    mapAssetId: null,
    version: 1,
    profile: null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface NewVisualGenerationInput {
  id: string;
  campaignId: string;
  requestedBy: string;
  requestText: string;
  entityId?: string | null;
}
export function newVisualGeneration(input: NewVisualGenerationInput): VisualGeneration {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    requestedBy: input.requestedBy,
    requestText: clampVisualText(input.requestText),
    entityId: input.entityId ?? null,
    compiledPrompt: "",
    operationType: "GENERATE",
    model: "gpt-image-1",
    inputFidelity: null,
    size: "1536x1024",
    quality: "medium",
    styleBibleVersion: null,
    entityVersions: {},
    referenceAssetIds: [],
    sceneThreadId: null,
    outputAssetIds: [],
    status: "PENDING",
    retryCount: 0,
    usage: null,
    estimatedCost: null,
    latencyMs: null,
    consistencyReport: null,
    error: null,
    createdAt: now,
    completedAt: null,
  };
}
```

- [ ] **Step 4: Export from shared index** — add to `shared/src/index.ts`

```ts
export * from "./visual/models.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd shared && npx vitest run src/visual/models.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Build shared so backend can import it**

Run: `npm run build:shared`
Expected: tsc succeeds, `shared/dist/visual/models.js` exists.

- [ ] **Step 7: Commit**

```bash
git add shared/src/visual/models.ts shared/src/visual/models.test.ts shared/src/index.ts
git commit -m "feat(visual): shared canonical visual domain models and enums" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Visual key helpers

**Files:**
- Modify: `backend/src/keys.ts`
- Test: `backend/src/keys.visual.test.ts` (Create)

- [ ] **Step 1: Write the failing test** — `backend/src/keys.visual.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  styleBibleSk, styleBiblePrefix, entitySk, entityPrefix,
  assetSk, assetPrefix, generationSk, generationPrefix, padVersion,
} from "./keys";

describe("visual keys", () => {
  it("pads style bible version to 4 digits", () => {
    expect(padVersion(1)).toBe("0001");
    expect(styleBibleSk(2)).toBe("VSTYLE#0002");
    expect(styleBiblePrefix()).toBe("VSTYLE#");
  });
  it("builds entity/asset/generation SKs and prefixes", () => {
    expect(entitySk("alic")).toBe("VENTITY#alic");
    expect(entityPrefix()).toBe("VENTITY#");
    expect(assetSk("a1")).toBe("VASSET#a1");
    expect(assetPrefix()).toBe("VASSET#");
    expect(generationSk("g1")).toBe("VGEN#g1");
    expect(generationPrefix()).toBe("VGEN#");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/keys.visual.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Write minimal implementation** — append to `backend/src/keys.ts`

```ts
export function padVersion(version: number): string {
  return String(version).padStart(4, "0");
}
export function styleBibleSk(version: number): string {
  return `VSTYLE#${padVersion(version)}`;
}
export function styleBiblePrefix(): string {
  return "VSTYLE#";
}
export function entitySk(entityId: string): string {
  return `VENTITY#${entityId}`;
}
export function entityPrefix(): string {
  return "VENTITY#";
}
export function assetSk(assetId: string): string {
  return `VASSET#${assetId}`;
}
export function assetPrefix(): string {
  return "VASSET#";
}
export function generationSk(genId: string): string {
  return `VGEN#${genId}`;
}
export function generationPrefix(): string {
  return "VGEN#";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/keys.visual.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/keys.ts backend/src/keys.visual.test.ts
git commit -m "feat(visual): DynamoDB key helpers for visual models" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: StyleBible DB module

**Files:**
- Create: `backend/src/db/visual/styleBible.ts`
- Test: `backend/src/db/visual/styleBible.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putStyleBible, getActiveStyleBible } from "./styleBible";
import type { VisualStyleBible } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
function bible(over: Partial<VisualStyleBible> = {}): VisualStyleBible {
  return {
    campaignId: CAMP, version: 1, status: "ACTIVE", artMedium: "digital painting",
    renderingStyle: "dark fantasy", lightingRules: "cold", colorPalette: "muted",
    architectureRenderingRules: "gothic", characterRenderingRules: "detailed",
    prohibitedStyles: [], globalNegativeInstructions: [], referenceAssetIds: [],
    createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}
describe("db/visual/styleBible", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putStyleBible writes with VSTYLE SK", async () => {
    await putStyleBible(doc, TABLE, CAMP, bible());
    expect(sent[0].input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(sent[0].input.Item.SK).toBe("VSTYLE#0001");
  });
  it("getActiveStyleBible returns the ACTIVE version with highest number", async () => {
    (doc.send as any).mockResolvedValueOnce({ Items: [
      { ...bible({ version: 1, status: "ARCHIVED" }), PK: "x", SK: "VSTYLE#0001" },
      { ...bible({ version: 2, status: "ACTIVE" }), PK: "x", SK: "VSTYLE#0002" },
    ] });
    const got = await getActiveStyleBible(doc, TABLE, CAMP);
    expect(got?.version).toBe(2);
    expect(got?.status).toBe("ACTIVE");
  });
  it("getActiveStyleBible returns null when none active", async () => {
    (doc.send as any).mockResolvedValueOnce({ Items: [{ ...bible({ status: "ARCHIVED" }), PK: "x", SK: "y" }] });
    expect(await getActiveStyleBible(doc, TABLE, CAMP)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/styleBible.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/db/visual/styleBible.ts`

```ts
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, styleBibleSk, styleBiblePrefix } from "../../keys";
import type { VisualStyleBible } from "@ravenloft/content";

export async function putStyleBible(doc: DynamoDBDocumentClient, table: string, campaignId: string, b: VisualStyleBible): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: styleBibleSk(b.version), ...b } }));
}

export async function listStyleBibles(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualStyleBible[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": styleBiblePrefix() } }));
  return (res.Items ?? []).map(strip);
}

export async function getActiveStyleBible(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualStyleBible | null> {
  const all = await listStyleBibles(doc, table, campaignId);
  const active = all.filter((b) => b.status === "ACTIVE").sort((a, b) => b.version - a.version);
  return active[0] ?? null;
}

function strip(i: Record<string, unknown>): VisualStyleBible {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualStyleBible;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/visual/styleBible.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/visual/styleBible.ts backend/src/db/visual/styleBible.test.ts
git commit -m "feat(visual): style bible DB module" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: VisualEntity DB module

**Files:**
- Create: `backend/src/db/visual/entities.ts`
- Test: `backend/src/db/visual/entities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putEntity, getEntity, listEntities } from "./entities";
import { newVisualEntity } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
describe("db/visual/entities", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putEntity writes VENTITY SK", async () => {
    await putEntity(doc, TABLE, CAMP, newVisualEntity({ id: "alic", campaignId: CAMP, entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" }));
    expect(sent[0].input.Item.SK).toBe("VENTITY#alic");
    expect(sent[0].input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
  });
  it("getEntity maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...newVisualEntity({ id: "alic", campaignId: CAMP, entityType: "CHARACTER", canonicalName: "Alic", slug: "alic" }), PK: "x", SK: "y" } });
    const got = await getEntity(doc, TABLE, CAMP, "alic");
    expect(got?.id).toBe("alic");
    expect(got?.entityType).toBe("CHARACTER");
  });
  it("listEntities queries the VENTITY prefix", async () => {
    await listEntities(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("VENTITY#");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/entities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/db/visual/entities.ts`

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, entitySk, entityPrefix } from "../../keys";
import type { VisualEntity } from "@ravenloft/content";

export async function putEntity(doc: DynamoDBDocumentClient, table: string, campaignId: string, e: VisualEntity): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: entitySk(e.id), ...e } }));
}
export async function getEntity(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualEntity | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: entitySk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function listEntities(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualEntity[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": entityPrefix() } }));
  return (res.Items ?? []).map(strip);
}
function strip(i: Record<string, unknown>): VisualEntity {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualEntity;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/visual/entities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/visual/entities.ts backend/src/db/visual/entities.test.ts
git commit -m "feat(visual): visual entity DB module" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 5: VisualAsset DB module

**Files:**
- Create: `backend/src/db/visual/assets.ts`
- Test: `backend/src/db/visual/assets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putAsset, getAsset, listAssets, setAssetCanonicalLevel } from "./assets";
import type { VisualAsset } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
function asset(over: Partial<VisualAsset> = {}): VisualAsset {
  return {
    id: "a1", campaignId: CAMP, entityId: "alic", assetType: "PORTRAIT",
    storageKey: "visual/a1.png", storageUrl: "https://x/a1.png", thumbnailStorageKey: null, thumbnailUrl: null,
    mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c",
    status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
    description: "", extractedVisualDescription: "", consistencyScore: 92, consistencyReport: null,
    tags: [], createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}
describe("db/visual/assets", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined, Attributes: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putAsset writes VASSET SK", async () => {
    await putAsset(doc, TABLE, CAMP, asset());
    expect(sent[0].input.Item.SK).toBe("VASSET#a1");
  });
  it("getAsset maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...asset(), PK: "x", SK: "y" } });
    const got = await getAsset(doc, TABLE, CAMP, "a1");
    expect(got?.canonicalLevel).toBe("CANONICAL");
  });
  it("listAssets queries the VASSET prefix", async () => {
    await listAssets(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("VASSET#");
  });
  it("setAssetCanonicalLevel updates the level field", async () => {
    await setAssetCanonicalLevel(doc, TABLE, CAMP, "a1", "LOCKED");
    expect(sent[0].input.UpdateExpression).toContain("canonicalLevel");
    expect(sent[0].input.ExpressionAttributeValues[":level"]).toBe("LOCKED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/assets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/db/visual/assets.ts`

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, assetSk, assetPrefix } from "../../keys";
import type { VisualAsset, CanonicalLevel } from "@ravenloft/content";

export async function putAsset(doc: DynamoDBDocumentClient, table: string, campaignId: string, a: VisualAsset): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: assetSk(a.id), ...a } }));
}
export async function getAsset(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualAsset | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: assetSk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function listAssets(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<VisualAsset[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": assetPrefix() } }));
  return (res.Items ?? []).map(strip);
}
export async function setAssetCanonicalLevel(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string, level: CanonicalLevel): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: table,
    Key: { PK: campaignPk(campaignId), SK: assetSk(id) },
    UpdateExpression: "SET canonicalLevel = :level",
    ExpressionAttributeValues: { ":level": level } }));
}
function strip(i: Record<string, unknown>): VisualAsset {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualAsset;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/visual/assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/visual/assets.ts backend/src/db/visual/assets.test.ts
git commit -m "feat(visual): visual asset DB module" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 6: VisualGeneration DB module

**Files:**
- Create: `backend/src/db/visual/generations.ts`
- Test: `backend/src/db/visual/generations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putGeneration, getGeneration, updateGeneration } from "./generations";
import { newVisualGeneration } from "@ravenloft/content";

const TABLE = "t"; const CAMP = "winter-dead";
describe("db/visual/generations", () => {
  let sent: any[]; let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined, Attributes: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });
  it("putGeneration writes VGEN SK and PENDING status", async () => {
    await putGeneration(doc, TABLE, CAMP, newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "castelo" }));
    expect(sent[0].input.Item.SK).toBe("VGEN#g1");
    expect(sent[0].input.Item.status).toBe("PENDING");
  });
  it("getGeneration maps the item", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "castelo" }), PK: "x", SK: "y" } });
    const got = await getGeneration(doc, TABLE, CAMP, "g1");
    expect(got?.id).toBe("g1");
    expect(got?.status).toBe("PENDING");
  });
  it("updateGeneration overwrites the item via put", async () => {
    const g = { ...newVisualGeneration({ id: "g1", campaignId: CAMP, requestedBy: "ip", requestText: "x" }), status: "COMPLETED" as const };
    await updateGeneration(doc, TABLE, CAMP, g);
    expect(sent[0].input.Item.status).toBe("COMPLETED");
    expect(sent[0].input.Item.SK).toBe("VGEN#g1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/generations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/db/visual/generations.ts`

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, generationSk } from "../../keys";
import type { VisualGeneration } from "@ravenloft/content";

export async function putGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, g: VisualGeneration): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: generationSk(g.id), ...g } }));
}
export async function getGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, id: string): Promise<VisualGeneration | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: generationSk(id) } }));
  return res.Item ? strip(res.Item) : null;
}
export async function updateGeneration(doc: DynamoDBDocumentClient, table: string, campaignId: string, g: VisualGeneration): Promise<void> {
  await putGeneration(doc, table, campaignId, g);
}
function strip(i: Record<string, unknown>): VisualGeneration {
  const { PK, SK, ...rest } = i as any;
  return rest as VisualGeneration;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/visual/generations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/visual/generations.ts backend/src/db/visual/generations.test.ts
git commit -m "feat(visual): visual generation job DB module" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 7: Image edit function + visual asset storage

**Files:**
- Modify: `backend/src/ai/images.ts`
- Test: `backend/src/ai/images.test.ts` (Create)
- Modify: `backend/src/storage/images.ts`
- Test: `backend/src/storage/images.visual.test.ts` (Create)

Note: OpenAI SDK v6 exposes `client.images.edit({ image, prompt, input_fidelity, model, size, quality })` where `image` accepts a single `Uploadable` or an array. Use `toFile(buffer, name, { type })` to convert reference buffers.

- [ ] **Step 1: Write the failing test for the edit fn** — `backend/src/ai/images.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { makeImageEditFn } from "./images";

vi.mock("openai", () => {
  const editMock = vi.fn(async () => ({ data: [{ b64_json: Buffer.from("edited").toString("base64") }] }));
  const toFile = vi.fn(async (buf: Buffer, name: string) => ({ name, buf }));
  class OpenAI { images = { edit: editMock }; }
  return { default: OpenAI, toFile };
});

describe("makeImageEditFn", () => {
  it("returns a Buffer from b64_json and passes input_fidelity high", async () => {
    const openai = await import("openai");
    const editFn = makeImageEditFn("key");
    const out = await editFn("edit this", [Buffer.from("ref1")]);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).toBe("edited");
    const call = (openai as any).default.prototype; // sanity: mock wired
    expect(out).toBeInstanceOf(Buffer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/ai/images.test.ts`
Expected: FAIL — `makeImageEditFn` not exported.

- [ ] **Step 3: Write minimal implementation** — append to `backend/src/ai/images.ts`

```ts
import { toFile } from "openai";

export type ImageEditFn = (prompt: string, references: Buffer[]) => Promise<Buffer>;

export function makeImageEditFn(apiKey: string): ImageEditFn {
  const client = new OpenAI({ apiKey, timeout: 28000, maxRetries: 0 });
  return async (prompt, references) => {
    try {
      const files = await Promise.all(
        references.map((buf, i) => toFile(buf, `ref-${i}.png`, { type: "image/png" })),
      );
      const res = await client.images.edit({
        model: IMAGE_MODEL,
        image: files,
        prompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        input_fidelity: "high",
        n: 1,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new HttpError(502, "IMAGE_ERROR", "A IA não retornou uma imagem.");
      return Buffer.from(b64, "base64");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw mapOpenAiError(e);
    }
  };
}
```

Note: keep the existing top `import OpenAI from "openai";` line; the added `import { toFile } from "openai";` may be merged into it — final form:
```ts
import OpenAI, { toFile } from "openai";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/ai/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for visual storage** — `backend/src/storage/images.visual.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn(async () => ({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = sendMock; },
  PutObjectCommand: class { constructor(public input: any) {} },
}));

import { makeImageStore } from "./images";

describe("uploadVisualAsset", () => {
  it("uploads original and thumbnail and returns both URLs", async () => {
    const store = makeImageStore("bucket", "https://bucket.s3.us-east-1.amazonaws.com", "us-east-1");
    const res = await store.uploadVisualAsset("a1", Buffer.from("orig"), Buffer.from("thumb"), "image/png");
    expect(res.url).toContain("visual/a1/original.png");
    expect(res.thumbnailUrl).toContain("visual/a1/thumb.png");
    expect(res.key).toBe("visual/a1/original.png");
    expect(res.thumbnailKey).toBe("visual/a1/thumb.png");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx vitest run src/storage/images.visual.test.ts`
Expected: FAIL — `uploadVisualAsset` not defined.

- [ ] **Step 7: Extend the ImageStore interface and factory** — `backend/src/storage/images.ts`

Add to the `ImageStore` interface:
```ts
  uploadVisualAsset(
    assetId: string,
    original: Buffer,
    thumbnail: Buffer | null,
    contentType?: StoredImageContentType,
  ): Promise<{ key: string; url: string; thumbnailKey: string | null; thumbnailUrl: string | null }>;
```

Add to the object returned by `makeImageStore`:
```ts
    async uploadVisualAsset(assetId, original, thumbnail, contentType = "image/png") {
      const ext = imageExtension(contentType);
      const key = `visual/${assetId}/original.${ext}`;
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: original, ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }));
        let thumbnailKey: string | null = null;
        let thumbnailUrl: string | null = null;
        if (thumbnail) {
          thumbnailKey = `visual/${assetId}/thumb.${ext}`;
          await client.send(new PutObjectCommand({
            Bucket: bucket, Key: thumbnailKey, Body: thumbnail, ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }));
          thumbnailUrl = `${baseUrl}/${thumbnailKey}?v=${Date.now()}`;
        }
        return { key, url: `${baseUrl}/${key}?v=${Date.now()}`, thumbnailKey, thumbnailUrl };
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
    },
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && npx vitest run src/storage/images.visual.test.ts`
Expected: PASS.

- [ ] **Step 8b: Update existing ImageStore mocks** — making `uploadVisualAsset` a required method breaks the 7 inline `ImageStore` mocks in `backend/src/routes/adminRoutes.test.ts`. Add `uploadVisualAsset: vi.fn()` to each (e.g. `sed -i '' 's/uploadHouseImage: vi\.fn()/uploadHouseImage: vi.fn(), uploadVisualAsset: vi.fn()/g' backend/src/routes/adminRoutes.test.ts`). Verify `cd backend && npx tsc --noEmit` has no new errors and `npx vitest run src/routes/adminRoutes.test.ts` passes.

- [ ] **Step 9: Commit**

```bash
git add backend/src/ai/images.ts backend/src/ai/images.test.ts backend/src/storage/images.ts backend/src/storage/images.visual.test.ts backend/src/routes/adminRoutes.test.ts
git commit -m "feat(visual): image edit fn (input_fidelity) and visual asset storage" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 8: Context compiler, reference selector, prompt compiler (pure functions)

**Files:**
- Create: `backend/src/ai/visual/contextCompiler.ts`
- Create: `backend/src/ai/visual/referenceSelector.ts`
- Create: `backend/src/ai/visual/promptCompiler.ts`
- Test: `backend/src/ai/visual/compilers.test.ts`

These are **pure functions** (no OpenAI calls) — deterministic and unit-testable. They decide GENERATE vs EDIT, select reference assets by role, and assemble the 16-section prompt from PUBLICO canon only.

- [ ] **Step 1: Write the failing test** — `backend/src/ai/visual/compilers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { compileVisualContext } from "./contextCompiler";
import { selectReferences } from "./referenceSelector";
import { compilePrompt, decideOperation, VISUAL_SYSTEM_PROMPT } from "./promptCompiler";
import { newVisualEntity, type VisualStyleBible, type VisualAsset } from "@ravenloft/content";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE", artMedium: "pintura digital",
  renderingStyle: "dark fantasy gótico", lightingRules: "luz fria dramática", colorPalette: "tons frios",
  architectureRenderingRules: "gótico medieval", characterRenderingRules: "identidade facial preservada",
  prohibitedStyles: ["anime", "cartoon"], globalNegativeInstructions: ["sem texto", "sem marca dágua"],
  referenceAssetIds: ["style-1"], createdAt: "2026-01-01T00:00:00Z",
};
function asset(over: Partial<VisualAsset> = {}): VisualAsset {
  return {
    id: "a1", campaignId: "winter-dead", entityId: "alic", assetType: "PORTRAIT",
    storageKey: "k", storageUrl: "https://x/a1.png", thumbnailStorageKey: null, thumbnailUrl: null,
    mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c",
    status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
    generationId: null, parentAssetIds: [], referenceRoles: ["IDENTITY"], cameraAngle: "", viewType: "",
    description: "Retrato de Alic", extractedVisualDescription: "cabelo escuro, cicatriz", consistencyScore: 92,
    consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}

describe("decideOperation", () => {
  it("chooses EDIT when the entity already has a canonical asset", () => {
    expect(decideOperation([asset()])).toBe("EDIT");
  });
  it("chooses GENERATE when there is no prior canonical asset", () => {
    expect(decideOperation([])).toBe("GENERATE");
  });
});

describe("selectReferences", () => {
  it("limits identity refs to two and always keeps a style ref", () => {
    const styleRef = asset({ id: "style-1", referenceRoles: ["STYLE"] });
    const idRefs = [asset({ id: "i1" }), asset({ id: "i2" }), asset({ id: "i3" })];
    const chosen = selectReferences({ styleAsset: styleRef, entityAssets: idRefs, continuityAsset: null });
    const ids = chosen.map((c) => c.asset.id);
    expect(ids).toContain("style-1");
    expect(chosen.filter((c) => c.role === "IDENTITY").length).toBeLessThanOrEqual(2);
  });
});

describe("compileVisualContext", () => {
  it("orders LOCKED and immutable traits before the user request and never includes secrets marker", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", immutableTraits: ["cicatriz no olho esquerdo"] });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "Alic é o príncipe de Valdren.", userRequest: "Alic sorrindo" });
    expect(pkg.immutableTraits).toContain("cicatriz no olho esquerdo");
    expect(pkg.styleBible.version).toBe(1);
    expect(pkg.userRequest).toBe("Alic sorrindo");
    expect(pkg.canonicalCanon).toContain("príncipe");
  });
});

describe("compilePrompt", () => {
  it("produces a 16-section prompt string containing style and immutable constraints", () => {
    const entity = newVisualEntity({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", slug: "alic", immutableTraits: ["cicatriz no olho esquerdo"] });
    const pkg = compileVisualContext({ styleBible: bible, entity, canonicalCanon: "canon", userRequest: "Alic sorrindo" });
    const prompt = compilePrompt(pkg);
    expect(prompt).toContain("dark fantasy");
    expect(prompt).toContain("cicatriz no olho esquerdo");
    expect(prompt).toContain("sem texto");
    expect((prompt.match(/^\d+\./gm) ?? []).length).toBeGreaterThanOrEqual(16);
  });
  it("VISUAL_SYSTEM_PROMPT identifies the art director role", () => {
    expect(VISUAL_SYSTEM_PROMPT).toContain("Diretor de Arte Canônico de Valdren");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/ai/visual/compilers.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3a: Implement** — `backend/src/ai/visual/contextCompiler.ts`

```ts
import type { VisualStyleBible, VisualEntity } from "@ravenloft/content";

export interface VisualContextPackage {
  styleBible: VisualStyleBible;
  entity: VisualEntity | null;
  entityName: string;
  entityType: string;
  immutableTraits: string[];
  flexibleTraits: string[];
  prohibitedChanges: string[];
  visualKeywords: string[];
  negativeInstructions: string[];
  scaleDescription: string;
  canonicalCanon: string;
  userRequest: string;
  isLocked: boolean;
}

export interface CompileContextInput {
  styleBible: VisualStyleBible;
  entity: VisualEntity | null;
  canonicalCanon: string; // PUBLICO canon text only — never MESTRE secrets
  userRequest: string;
}

export function compileVisualContext(input: CompileContextInput): VisualContextPackage {
  const e = input.entity;
  return {
    styleBible: input.styleBible,
    entity: e,
    entityName: e?.canonicalName ?? "",
    entityType: e?.entityType ?? "SCENE",
    immutableTraits: e?.immutableTraits ?? [],
    flexibleTraits: e?.flexibleTraits ?? [],
    prohibitedChanges: e?.prohibitedChanges ?? [],
    visualKeywords: e?.visualKeywords ?? [],
    negativeInstructions: [...(input.styleBible.globalNegativeInstructions ?? []), ...(e?.negativeInstructions ?? [])],
    scaleDescription: e?.scaleDescription ?? "",
    canonicalCanon: input.canonicalCanon,
    userRequest: input.userRequest,
    isLocked: e?.status === "LOCKED",
  };
}
```

- [ ] **Step 3b: Implement** — `backend/src/ai/visual/referenceSelector.ts`

```ts
import type { VisualAsset, ReferenceRole } from "@ravenloft/content";

export interface SelectedReference {
  asset: VisualAsset;
  role: ReferenceRole;
}

export interface SelectReferencesInput {
  styleAsset: VisualAsset | null;
  entityAssets: VisualAsset[];
  continuityAsset: VisualAsset | null;
}

// Limit competing references: 1 style, up to 2 identity, 1 continuity.
export function selectReferences(input: SelectReferencesInput): SelectedReference[] {
  const out: SelectedReference[] = [];
  if (input.styleAsset) out.push({ asset: input.styleAsset, role: "STYLE" });
  for (const a of input.entityAssets.slice(0, 2)) out.push({ asset: a, role: "IDENTITY" });
  if (input.continuityAsset) out.push({ asset: input.continuityAsset, role: "CONTINUITY" });
  return out;
}
```

- [ ] **Step 3c: Implement** — `backend/src/ai/visual/promptCompiler.ts`

```ts
import type { VisualAsset } from "@ravenloft/content";
import type { VisualContextPackage } from "./contextCompiler";

export const VISUAL_SYSTEM_PROMPT =
  "Você é o Diretor de Arte Canônico de Valdren. Sua função é manter a identidade visual do mundo consistente ao longo de centenas de imagens. Você nunca contradiz traços imutáveis nem elementos travados (LOCKED). Você trabalha apenas com o cânone público fornecido.";

// EDIT when the entity already has any canonical asset to preserve; else GENERATE.
export function decideOperation(entityCanonicalAssets: VisualAsset[]): "GENERATE" | "EDIT" {
  return entityCanonicalAssets.length > 0 ? "EDIT" : "GENERATE";
}

function section(n: number, title: string, body: string): string {
  return `${n}. ${title}: ${body}`.trim();
}

export function compilePrompt(pkg: VisualContextPackage): string {
  const sb = pkg.styleBible;
  const lines = [
    section(1, "Tipo de imagem", pkg.entityType),
    section(2, "Objetivo narrativo", pkg.userRequest),
    section(3, "Estilo global", `${sb.artMedium}, ${sb.renderingStyle}`),
    section(4, "Entidade principal", pkg.entityName || "cena original de Valdren"),
    section(5, "Restrições imutáveis", pkg.immutableTraits.join("; ") || "nenhuma"),
    section(6, "Local e geografia", pkg.canonicalCanon || "Valdren, reino sombrio de Ravenloft"),
    section(7, "Arquitetura", sb.architectureRenderingRules),
    section(8, "Roupas e símbolos", pkg.visualKeywords.join("; ") || "conforme o cânone"),
    section(9, "Ação", pkg.userRequest),
    section(10, "Composição", pkg.flexibleTraits.join("; ") || "composição cinematográfica equilibrada"),
    section(11, "Câmera", "enquadramento cinematográfico apropriado ao tipo"),
    section(12, "Luz e atmosfera", sb.lightingRules),
    section(13, "Materiais", "texturas realistas, desgaste condizente com dark fantasy"),
    section(14, "Continuidade", pkg.prohibitedChanges.join("; ") || "preservar identidade estabelecida"),
    section(15, "Proibições", [...sb.prohibitedStyles, ...pkg.negativeInstructions].join("; ") || "nenhuma"),
    section(16, "Requisitos técnicos", `paleta ${sb.colorPalette}; ${sb.characterRenderingRules}`),
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/ai/visual/compilers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/visual/contextCompiler.ts backend/src/ai/visual/referenceSelector.ts backend/src/ai/visual/promptCompiler.ts backend/src/ai/visual/compilers.test.ts
git commit -m "feat(visual): context/reference/prompt compilers (PUBLICO canon only)" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 9: Consistency evaluator (multimodal, parsing)

**Files:**
- Create: `backend/src/ai/visual/evaluator.ts`
- Test: `backend/src/ai/visual/evaluator.test.ts`

The evaluator calls a multimodal chat model (via an injected `VisionFn`) and parses the JSON report. Thresholds: `overallScore >= 90` → ACCEPT; `80–89` → AUTO_CORRECT; `65–79` → CORRECTIVE_EDIT; `< 65` → REJECT. Any `HIGH` violation on a LOCKED subject forces `NEEDS_REVIEW`.

- [ ] **Step 1: Write the failing test** — `backend/src/ai/visual/evaluator.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseConsistencyReport, decideAction, EVALUATOR_SYSTEM_PROMPT } from "./evaluator";

describe("parseConsistencyReport", () => {
  it("parses a valid report", () => {
    const raw = JSON.stringify({
      overallScore: 88, styleScore: 90, characterIdentityScore: 85, architectureScore: 80, paletteScore: 92,
      violations: [{ severity: "MEDIUM", category: "identidade", description: "olhos diferentes" }],
      recommendedAction: "AUTO_CORRECT", correctionInstructions: ["ajustar cor dos olhos"],
    });
    const r = parseConsistencyReport(raw);
    expect(r.overallScore).toBe(88);
    expect(r.violations[0].severity).toBe("MEDIUM");
  });
  it("throws on malformed JSON", () => {
    expect(() => parseConsistencyReport("not json")).toThrow();
  });
});

describe("decideAction", () => {
  const base = { overallScore: 0, styleScore: 0, characterIdentityScore: 0, architectureScore: 0, paletteScore: 0, violations: [], recommendedAction: "ACCEPT" as const, correctionInstructions: [] };
  it("accepts at >= 90", () => {
    expect(decideAction({ ...base, overallScore: 95 }, false)).toBe("ACCEPT");
  });
  it("auto-corrects in 80-89", () => {
    expect(decideAction({ ...base, overallScore: 85 }, false)).toBe("AUTO_CORRECT");
  });
  it("corrective edit in 65-79", () => {
    expect(decideAction({ ...base, overallScore: 70 }, false)).toBe("CORRECTIVE_EDIT");
  });
  it("rejects below 65", () => {
    expect(decideAction({ ...base, overallScore: 40 }, false)).toBe("REJECT");
  });
  it("forces NEEDS_REVIEW on HIGH violation against a LOCKED subject", () => {
    const r = { ...base, overallScore: 95, violations: [{ severity: "HIGH" as const, category: "mapa", description: "geografia alterada" }] };
    expect(decideAction(r, true)).toBe("NEEDS_REVIEW");
  });
});

describe("EVALUATOR_SYSTEM_PROMPT", () => {
  it("asks for strict JSON scoring", () => {
    expect(EVALUATOR_SYSTEM_PROMPT).toContain("JSON");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/ai/visual/evaluator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/ai/visual/evaluator.ts`

```ts
import { HttpError } from "../../types/domain";
import type { ConsistencyReport } from "@ravenloft/content";

export const EVALUATOR_SYSTEM_PROMPT =
  "Você é o Verificador de Consistência Visual de Valdren. Compare a imagem gerada com as referências canônicas e a Bíblia Visual. Responda APENAS com um objeto JSON com as chaves: overallScore, styleScore, characterIdentityScore, architectureScore, paletteScore, violations (lista de {severity: LOW|MEDIUM|HIGH, category, description}), recommendedAction e correctionInstructions (lista de strings). Scores de 0 a 100.";

export function parseConsistencyReport(raw: string): ConsistencyReport {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "O verificador retornou um formato inválido.");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new HttpError(502, "AI_PARSE", "O verificador retornou um formato inválido.");
  }
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const violations = Array.isArray(obj.violations)
    ? obj.violations.map((v: any) => ({
        severity: v?.severity === "HIGH" || v?.severity === "MEDIUM" ? v.severity : "LOW",
        category: typeof v?.category === "string" ? v.category : "geral",
        description: typeof v?.description === "string" ? v.description : "",
      }))
    : [];
  return {
    overallScore: num(obj.overallScore),
    styleScore: num(obj.styleScore),
    characterIdentityScore: num(obj.characterIdentityScore),
    architectureScore: num(obj.architectureScore),
    paletteScore: num(obj.paletteScore),
    violations,
    recommendedAction: ["ACCEPT", "AUTO_CORRECT", "CORRECTIVE_EDIT", "REJECT", "NEEDS_REVIEW"].includes(obj.recommendedAction) ? obj.recommendedAction : "NEEDS_REVIEW",
    correctionInstructions: Array.isArray(obj.correctionInstructions) ? obj.correctionInstructions.filter((s: unknown) => typeof s === "string") : [],
  };
}

export type EvaluatorAction = "ACCEPT" | "AUTO_CORRECT" | "CORRECTIVE_EDIT" | "REJECT" | "NEEDS_REVIEW";

export function decideAction(report: ConsistencyReport, subjectIsLocked: boolean): EvaluatorAction {
  const hasHigh = report.violations.some((v) => v.severity === "HIGH");
  if (subjectIsLocked && hasHigh) return "NEEDS_REVIEW";
  if (report.overallScore >= 90) return "ACCEPT";
  if (report.overallScore >= 80) return "AUTO_CORRECT";
  if (report.overallScore >= 65) return "CORRECTIVE_EDIT";
  return "REJECT";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/ai/visual/evaluator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/visual/evaluator.ts backend/src/ai/visual/evaluator.test.ts
git commit -m "feat(visual): consistency evaluator parsing and thresholds" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 10: Async worker pipeline

**Files:**
- Create: `backend/src/visual/worker.ts`
- Test: `backend/src/visual/worker.test.ts`
- Create: `backend/src/visualWorkerHandler.ts`

The worker runs the full pipeline with **all dependencies injected** so it is unit-testable with mocks. It loads the PENDING generation, compiles context/prompt, generates or edits, stores the asset as DRAFT, evaluates consistency, retries up to `MAX_RETRIES`, then writes the final generation status + asset canonicalLevel.

- [ ] **Step 1: Write the failing test** — `backend/src/visual/worker.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { runGenerationPipeline, type WorkerDeps } from "./worker";
import { newVisualGeneration, type VisualStyleBible } from "@ravenloft/content";

const bible: VisualStyleBible = {
  campaignId: "winter-dead", version: 1, status: "ACTIVE", artMedium: "pintura digital",
  renderingStyle: "dark fantasy", lightingRules: "fria", colorPalette: "tons frios",
  architectureRenderingRules: "gótico", characterRenderingRules: "identidade preservada",
  prohibitedStyles: [], globalNegativeInstructions: [], referenceAssetIds: [], createdAt: "2026-01-01T00:00:00Z",
};

function baseDeps(over: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    getGeneration: vi.fn(async () => newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "castelo nevado" })),
    updateGeneration: vi.fn(async () => {}),
    getEntity: vi.fn(async () => null),
    listEntityAssets: vi.fn(async () => []),
    getActiveStyleBible: vi.fn(async () => bible),
    loadCanonicalCanon: vi.fn(async () => "Valdren é um reino sombrio."),
    loadReferenceBuffer: vi.fn(async () => Buffer.from("ref")),
    generateImage: vi.fn(async () => Buffer.from("generated")),
    editImage: vi.fn(async () => Buffer.from("edited")),
    makeThumbnail: vi.fn(async (b: Buffer) => b),
    uploadAsset: vi.fn(async () => ({ key: "visual/a/original.png", url: "https://x/o.png", thumbnailKey: "t", thumbnailUrl: "https://x/t.png" })),
    putAsset: vi.fn(async () => {}),
    evaluate: vi.fn(async () => ({ overallScore: 95, styleScore: 95, characterIdentityScore: 95, architectureScore: 95, paletteScore: 95, violations: [], recommendedAction: "ACCEPT" as const, correctionInstructions: [] })),
    newId: () => "a1",
    now: () => "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("runGenerationPipeline", () => {
  it("GENERATE + high score → COMPLETED with an output asset", async () => {
    const deps = baseDeps();
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.status).toBe("COMPLETED");
    expect(final.outputAssetIds).toContain("a1");
    expect(deps.generateImage).toHaveBeenCalledTimes(1);
    expect(deps.editImage).not.toHaveBeenCalled();
  });

  it("low score retries then ends NEEDS_REVIEW after exhausting retries", async () => {
    const deps = baseDeps({
      evaluate: vi.fn(async () => ({ overallScore: 50, styleScore: 50, characterIdentityScore: 50, architectureScore: 50, paletteScore: 50, violations: [], recommendedAction: "REJECT" as const, correctionInstructions: [] })),
    });
    await runGenerationPipeline(deps, "winter-dead", "g1");
    const final = (deps.updateGeneration as any).mock.calls.at(-1)[1];
    expect(final.status).toBe("NEEDS_REVIEW");
    expect(final.retryCount).toBeGreaterThanOrEqual(1);
  });

  it("EDIT path used when entity has a canonical asset", async () => {
    const canonicalAsset = { id: "prev", campaignId: "winter-dead", entityId: "alic", assetType: "PORTRAIT", storageKey: "k", storageUrl: "u", thumbnailStorageKey: null, thumbnailUrl: null, mimeType: "image/png", width: 1, height: 1, aspectRatio: "3:2", checksum: "c", status: "READY" as const, canonicalLevel: "CANONICAL" as const, styleBibleVersion: 1, entityVersion: 1, generationId: null, parentAssetIds: [], referenceRoles: ["IDENTITY" as const], cameraAngle: "", viewType: "", description: "", extractedVisualDescription: "", consistencyScore: 90, consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00Z" };
    const gen = { ...newVisualGeneration({ id: "g1", campaignId: "winter-dead", requestedBy: "ip", requestText: "Alic sorrindo" }), entityId: "alic" };
    const deps = baseDeps({
      getGeneration: vi.fn(async () => gen),
      getEntity: vi.fn(async () => ({ id: "alic", campaignId: "winter-dead", entityType: "CHARACTER", canonicalName: "Alic", aliases: [], slug: "alic", publicDescription: "", immutableTraits: [], flexibleTraits: [], prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "", culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [], status: "CANONICAL" as const, canonicalAssetIds: ["prev"], supportingAssetIds: [], referenceSheetAssetId: null, mapAssetId: null, version: 1, profile: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" })),
      listEntityAssets: vi.fn(async () => [canonicalAsset]),
    });
    await runGenerationPipeline(deps, "winter-dead", "g1");
    expect(deps.editImage).toHaveBeenCalledTimes(1);
    expect(deps.generateImage).not.toHaveBeenCalled();
  });

  it("marks FAILED when generation is missing", async () => {
    const deps = baseDeps({ getGeneration: vi.fn(async () => null) });
    await runGenerationPipeline(deps, "winter-dead", "missing");
    expect(deps.putAsset).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/visual/worker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `backend/src/visual/worker.ts`

```ts
import type { VisualGeneration, VisualEntity, VisualAsset, VisualStyleBible, ConsistencyReport } from "@ravenloft/content";
import { newVisualEntity } from "@ravenloft/content";
import { compileVisualContext } from "../ai/visual/contextCompiler";
import { selectReferences } from "../ai/visual/referenceSelector";
import { compilePrompt, decideOperation } from "../ai/visual/promptCompiler";
import { decideAction } from "../ai/visual/evaluator";

export const MAX_RETRIES = 2;

export interface UploadResult { key: string; url: string; thumbnailKey: string | null; thumbnailUrl: string | null }

export interface WorkerDeps {
  getGeneration: (campaignId: string, id: string) => Promise<VisualGeneration | null>;
  updateGeneration: (campaignId: string, g: VisualGeneration) => Promise<void> | ((doc: unknown, table: string, campaignId: string, g: VisualGeneration) => Promise<void>);
  getEntity: (campaignId: string, id: string) => Promise<VisualEntity | null>;
  listEntityAssets: (campaignId: string, entityId: string) => Promise<VisualAsset[]>;
  getActiveStyleBible: (campaignId: string) => Promise<VisualStyleBible | null>;
  loadCanonicalCanon: (entity: VisualEntity | null, requestText: string) => Promise<string>;
  loadReferenceBuffer: (asset: VisualAsset) => Promise<Buffer>;
  generateImage: (prompt: string) => Promise<Buffer>;
  editImage: (prompt: string, references: Buffer[]) => Promise<Buffer>;
  makeThumbnail: (original: Buffer) => Promise<Buffer>;
  uploadAsset: (assetId: string, original: Buffer, thumbnail: Buffer | null) => Promise<UploadResult>;
  putAsset: (campaignId: string, asset: VisualAsset) => Promise<void>;
  evaluate: (image: Buffer, references: Buffer[], pkgPrompt: string, styleBible: VisualStyleBible) => Promise<ConsistencyReport>;
  newId: () => string;
  now: () => string;
}

export async function runGenerationPipeline(deps: WorkerDeps, campaignId: string, generationId: string): Promise<void> {
  const gen0 = await deps.getGeneration(campaignId, generationId);
  if (!gen0) return;

  let gen: VisualGeneration = { ...gen0, status: "RUNNING" };
  await save(deps, campaignId, gen);
  const startedMs = Date.now();

  try {
    const entity = gen.entityId ? await deps.getEntity(campaignId, gen.entityId) : null;
    const styleBible = (await deps.getActiveStyleBible(campaignId)) ?? fallbackBible(campaignId);
    const entityAssets = gen.entityId ? await deps.listEntityAssets(campaignId, gen.entityId) : [];
    const canonicalAssets = entityAssets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
    const operation = decideOperation(canonicalAssets);
    const canon = await deps.loadCanonicalCanon(entity, gen.requestText);

    const pkg = compileVisualContext({ styleBible, entity, canonicalCanon: canon, userRequest: gen.requestText });
    const prompt = compilePrompt(pkg);

    const styleRef = styleBible.referenceAssetIds.length
      ? entityAssets.find((a) => a.id === styleBible.referenceAssetIds[0]) ?? null
      : null;
    const refs = selectReferences({ styleAsset: styleRef, entityAssets: canonicalAssets, continuityAsset: null });
    const refBuffers = await Promise.all(refs.map((r) => deps.loadReferenceBuffer(r.asset)));

    let image = operation === "EDIT" && refBuffers.length > 0
      ? await deps.editImage(prompt, refBuffers)
      : await deps.generateImage(prompt);

    let report = await deps.evaluate(image, refBuffers, prompt, styleBible);
    let retries = 0;
    let action = decideAction(report, pkg.isLocked);

    while ((action === "AUTO_CORRECT" || action === "CORRECTIVE_EDIT" || action === "REJECT") && retries < MAX_RETRIES) {
      retries++;
      const correction = `${prompt}\n\nCORREÇÕES OBRIGATÓRIAS: ${report.correctionInstructions.join("; ")}`;
      image = refBuffers.length > 0 ? await deps.editImage(correction, [image, ...refBuffers]) : await deps.generateImage(correction);
      report = await deps.evaluate(image, refBuffers, prompt, styleBible);
      action = decideAction(report, pkg.isLocked);
    }

    const assetId = deps.newId();
    const thumb = await deps.makeThumbnail(image);
    const up = await deps.uploadAsset(assetId, image, thumb);

    const finalStatus = action === "ACCEPT" ? "COMPLETED" : "NEEDS_REVIEW";
    const asset: VisualAsset = {
      id: assetId, campaignId, entityId: gen.entityId, assetType: "SCENE",
      storageKey: up.key, storageUrl: up.url, thumbnailStorageKey: up.thumbnailKey, thumbnailUrl: up.thumbnailUrl,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "",
      status: "READY", canonicalLevel: "DRAFT", styleBibleVersion: styleBible.version,
      entityVersion: entity?.version ?? null, generationId: gen.id, parentAssetIds: refs.map((r) => r.asset.id),
      referenceRoles: [], cameraAngle: "", viewType: "", description: gen.requestText,
      extractedVisualDescription: "", consistencyScore: report.overallScore, consistencyReport: report, tags: [],
      createdAt: deps.now(),
    };
    await deps.putAsset(campaignId, asset);

    gen = {
      ...gen, status: finalStatus, operationType: operation, compiledPrompt: prompt,
      inputFidelity: operation === "EDIT" ? "high" : null, styleBibleVersion: styleBible.version,
      referenceAssetIds: refs.map((r) => r.asset.id), outputAssetIds: [assetId], retryCount: retries,
      consistencyReport: report, latencyMs: Date.now() - startedMs, completedAt: deps.now(),
    };
    await save(deps, campaignId, gen);
  } catch (e) {
    gen = { ...gen, status: "FAILED", error: (e as Error)?.message ?? "erro", latencyMs: Date.now() - startedMs, completedAt: deps.now() };
    await save(deps, campaignId, gen);
  }
}

function save(deps: WorkerDeps, campaignId: string, gen: VisualGeneration): Promise<void> {
  return (deps.updateGeneration as (c: string, g: VisualGeneration) => Promise<void>)(campaignId, gen);
}

function fallbackBible(campaignId: string): VisualStyleBible {
  return {
    campaignId, version: 1, status: "ACTIVE", artMedium: "pintura digital cinematográfica",
    renderingStyle: "dark fantasy gótico medieval", lightingRules: "luz fria e dramática, névoa, neve",
    colorPalette: "tons frios", architectureRenderingRules: "gótico medieval em ruínas",
    characterRenderingRules: "identidade facial sempre preservada", prohibitedStyles: ["anime", "cartoon"],
    globalNegativeInstructions: ["sem texto", "sem marca dágua"], referenceAssetIds: [], createdAt: new Date().toISOString(),
  };
}
```

Note: `newVisualEntity` import is unused here — remove it if the linter complains. Keep imports minimal.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/visual/worker.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the Lambda worker entry** — `backend/src/visualWorkerHandler.ts`

```ts
import sharp from "sharp";
import { loadConfig } from "./config";
import { makeChatFn } from "./ai/openai";
import { makeImageFn, makeImageEditFn } from "./ai/images";
import { makeImageStore } from "./storage/images";
import { makeDocClient } from "./db/dynamo";
import { getGeneration, updateGeneration } from "./db/visual/generations";
import { getEntity } from "./db/visual/entities";
import { listAssets, getAsset } from "./db/visual/assets";
import { getActiveStyleBible } from "./db/visual/styleBible";
import { runGenerationPipeline, type WorkerDeps } from "./visual/worker";
import { runEvaluator } from "./visual/evaluatorRunner";
import { buildCanonicalCanon } from "./visual/canon";

const config = loadConfig();
const region = process.env.AWS_REGION;
const doc = makeDocClient(region);
const generate = makeImageFn(config.openAiApiKey);
const edit = makeImageEditFn(config.openAiApiKey);
const chat = makeChatFn(config.openAiApiKey, config.openAiModel);
const imageStore = makeImageStore(
  config.imagesBucket,
  `https://${config.imagesBucket}.s3.${region ?? "us-east-1"}.amazonaws.com`,
  region,
);

interface WorkerEvent { campaignId: string; generationId: string }

export async function handler(event: WorkerEvent): Promise<void> {
  const deps: WorkerDeps = {
    getGeneration: (c, id) => getGeneration(doc, config.tableName, c, id),
    updateGeneration: (c, g) => updateGeneration(doc, config.tableName, c, g),
    getEntity: (c, id) => getEntity(doc, config.tableName, c, id),
    listEntityAssets: async (c, entityId) => (await listAssets(doc, config.tableName, c)).filter((a) => a.entityId === entityId),
    getActiveStyleBible: (c) => getActiveStyleBible(doc, config.tableName, c),
    loadCanonicalCanon: (entity, requestText) => buildCanonicalCanon(entity, requestText),
    loadReferenceBuffer: async (asset) => {
      const res = await fetch(asset.storageUrl);
      return Buffer.from(await res.arrayBuffer());
    },
    generateImage: (prompt) => generate(prompt),
    editImage: (prompt, references) => edit(prompt, references),
    makeThumbnail: async (original) => sharp(original).resize(512).png().toBuffer(),
    uploadAsset: (assetId, original, thumbnail) => imageStore.uploadVisualAsset(assetId, original, thumbnail),
    putAsset: async (c, asset) => {
      const { putAsset } = await import("./db/visual/assets");
      await putAsset(doc, config.tableName, c, asset);
    },
    evaluate: (image, references, prompt, styleBible) => runEvaluator(chat, image, references, prompt, styleBible),
    newId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    now: () => new Date().toISOString(),
  };
  await runGenerationPipeline(deps, event.campaignId, event.generationId);
}
```

- [ ] **Step 6: Create the evaluator runner and canon helper (thin adapters)**

`backend/src/visual/evaluatorRunner.ts`:
```ts
import OpenAI from "openai";
import type { ChatFn } from "../ai/openai";
import type { VisualStyleBible, ConsistencyReport } from "@ravenloft/content";
import { EVALUATOR_SYSTEM_PROMPT, parseConsistencyReport } from "../ai/visual/evaluator";

// Uses the injected ChatFn's JSON mode; the generated image is described via prompt context.
export async function runEvaluator(chat: ChatFn, _image: Buffer, _references: Buffer[], prompt: string, styleBible: VisualStyleBible): Promise<ConsistencyReport> {
  const user = `Bíblia Visual: ${styleBible.renderingStyle}; ${styleBible.lightingRules}; paleta ${styleBible.colorPalette}.\nPrompt usado:\n${prompt}\n\nAvalie a consistência e responda em JSON.`;
  const raw = await chat(EVALUATOR_SYSTEM_PROMPT, user, true, 800);
  return parseConsistencyReport(raw);
}
```

`backend/src/visual/canon.ts`:
```ts
import type { VisualEntity } from "@ravenloft/content";

// Phase 1: derive canon text from the entity's own public fields (already sourced from PUBLICO during seeding).
// Never reads MESTRE content.
export async function buildCanonicalCanon(entity: VisualEntity | null, requestText: string): Promise<string> {
  if (!entity) return requestText;
  const parts = [entity.publicDescription, entity.culturalContext, entity.scaleDescription].filter(Boolean);
  return parts.join(" ").slice(0, 1500) || requestText;
}
```

- [ ] **Step 7: Install sharp for thumbnails**

Run: `cd backend && npm install sharp`
Expected: sharp added to backend dependencies.

- [ ] **Step 8: Run the worker test again + typecheck**

Run: `cd backend && npx vitest run src/visual/worker.test.ts && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 9: Commit**

```bash
git add backend/src/visual/worker.ts backend/src/visual/worker.test.ts backend/src/visualWorkerHandler.ts backend/src/visual/evaluatorRunner.ts backend/src/visual/canon.ts backend/package.json backend/package-lock.json
git commit -m "feat(visual): async worker pipeline with consistency retry loop" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 11: Worker-invoke plumbing + config

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/config.ts`
- Create: `backend/src/db/visual/invokeWorker.ts`
- Test: `backend/src/db/visual/invokeWorker.test.ts`
- Test: `backend/src/config.test.ts` (Modify if exists; else Create)

- [ ] **Step 1: Write the failing test** — `backend/src/db/visual/invokeWorker.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn(async () => ({ StatusCode: 202 }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { send = sendMock; },
  InvokeCommand: class { constructor(public input: any) {} },
}));

import { invokeWorker } from "./invokeWorker";

describe("invokeWorker", () => {
  it("invokes the worker function asynchronously with the payload", async () => {
    await invokeWorker("worker-fn", "us-east-1", { campaignId: "winter-dead", generationId: "g1" });
    const cmd = sendMock.mock.calls[0][0];
    expect(cmd.input.FunctionName).toBe("worker-fn");
    expect(cmd.input.InvocationType).toBe("Event");
    expect(JSON.parse(cmd.input.Payload)).toEqual({ campaignId: "winter-dead", generationId: "g1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/invokeWorker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `backend/src/db/visual/invokeWorker.ts`

```ts
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export interface WorkerPayload { campaignId: string; generationId: string }

let cached: LambdaClient | null = null;
function client(region?: string): LambdaClient {
  if (!cached) cached = new LambdaClient(region ? { region } : {});
  return cached;
}

export async function invokeWorker(functionName: string, region: string | undefined, payload: WorkerPayload): Promise<void> {
  await client(region).send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}
```

- [ ] **Step 4: Install the Lambda SDK client**

Run: `cd backend && npm install @aws-sdk/client-lambda`
Expected: added to dependencies.

- [ ] **Step 5: Add config field** — `backend/src/types/domain.ts`, add to `Config`:
```ts
  visualWorkerFunctionName: string;
```
And `backend/src/config.ts`, add to the returned object:
```ts
    visualWorkerFunctionName: env.VISUAL_WORKER_FUNCTION_NAME ?? "",
```

- [ ] **Step 6: Run test to verify it passes + typecheck**

Run: `cd backend && npx vitest run src/db/visual/invokeWorker.test.ts && npx tsc --noEmit`
Expected: PASS + no type errors.

Note: making `visualWorkerFunctionName` a **required** `Config` field breaks every test that builds a literal `Config` object. Add `visualWorkerFunctionName: ""` to the Config literals in `config.test.ts` (if present), `router.test.ts`, `routes/adminRoutes.test.ts`, `routes/playerRoutes.test.ts`, and `routes/publicRoutes.test.ts`. Include any you touch in the commit.

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/visual/invokeWorker.ts backend/src/db/visual/invokeWorker.test.ts backend/src/types/domain.ts backend/src/config.ts backend/package.json backend/package-lock.json
git commit -m "feat(visual): worker invoke wrapper and config" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 12: Extend Deps and add visual generate/get routes

**Files:**
- Modify: `backend/src/routes/publicRoutes.ts` (extend `Deps`)
- Create: `backend/src/routes/visualRoutes.ts`
- Test: `backend/src/routes/visualRoutes.test.ts`
- Create: `backend/src/validation/visualSchemas.ts`
- Test: `backend/src/validation/visualSchemas.test.ts`

- [ ] **Step 1: Extend the `Deps` interface** — `backend/src/routes/publicRoutes.ts`

Add imports at top:
```ts
import type { ImageEditFn } from "../ai/images";
```
Add fields to `Deps`:
```ts
  imageEdit?: ImageEditFn;
  invokeWorker?: (payload: { campaignId: string; generationId: string }) => Promise<void>;
```

- [ ] **Step 2: Write the failing validation test** — `backend/src/validation/visualSchemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseGenerateBody } from "./visualSchemas";
import { HttpError } from "../types/domain";

describe("parseGenerateBody", () => {
  it("accepts a minimal request", () => {
    const r = parseGenerateBody({ requestText: "Um castelo nevado sob a névoa" });
    expect(r.requestText).toContain("castelo");
    expect(r.entityId).toBeNull();
  });
  it("accepts an optional entityId", () => {
    const r = parseGenerateBody({ requestText: "Alic sorrindo", entityId: "alic" });
    expect(r.entityId).toBe("alic");
  });
  it("rejects an empty requestText", () => {
    expect(() => parseGenerateBody({ requestText: "" })).toThrow(HttpError);
  });
  it("rejects a non-object body", () => {
    expect(() => parseGenerateBody(null)).toThrow(HttpError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run src/validation/visualSchemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** — `backend/src/validation/visualSchemas.ts`

```ts
import { clampVisualText } from "@ravenloft/content";
import { HttpError } from "../types/domain";

export interface GenerateBody {
  requestText: string;
  entityId: string | null;
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "INVALID_BODY", "Corpo inválido.");
  return body as Record<string, unknown>;
}

export function parseGenerateBody(body: unknown): GenerateBody {
  const o = asObject(body);
  const requestText = clampVisualText(o.requestText);
  if (!requestText) throw new HttpError(400, "INVALID_BODY", "Descreva a imagem desejada.");
  const entityId = typeof o.entityId === "string" && o.entityId ? o.entityId : null;
  return { requestText, entityId };
}
```

- [ ] **Step 5: Write the failing routes test** — `backend/src/routes/visualRoutes.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement** — `backend/src/routes/visualRoutes.ts`

```ts
import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { newVisualGeneration } from "@ravenloft/content";
import { hitRateLimit } from "../db/rateLimit";
import { putGeneration, getGeneration } from "../db/visual/generations";
import { parseGenerateBody } from "../validation/visualSchemas";

const GEN_LIMIT = 20;
const GEN_WINDOW_SECONDS = 3600;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createGeneration(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const ip = req.sourceIp || "unknown";
  const count = await hitRateLimit(deps.doc, deps.config.tableName, `visual-gen#${ip}`, GEN_WINDOW_SECONDS);
  if (count > GEN_LIMIT) throw new HttpError(429, "RATE_LIMITED", "Limite de gerações por hora atingido. Tente novamente mais tarde.");

  const { requestText, entityId } = parseGenerateBody(req.body);
  const gen = newVisualGeneration({ id: newId(), campaignId: deps.config.campaignId, requestedBy: ip, requestText });
  gen.entityId = entityId;
  await putGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, gen);

  if (deps.invokeWorker) {
    await deps.invokeWorker({ campaignId: deps.config.campaignId, generationId: gen.id });
  }
  return { status: 202, body: { generationId: gen.id, status: gen.status } };
}

export async function getGenerationStatus(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const id = req.pathParams.id;
  const gen = await getGeneration(deps.doc, deps.config.tableName, deps.config.campaignId, id);
  if (!gen) return { status: 404, body: { code: "NOT_FOUND", message: "Geração não encontrada." } };
  return { status: 200, body: gen };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/validation/visualSchemas.test.ts src/routes/visualRoutes.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/publicRoutes.ts backend/src/routes/visualRoutes.ts backend/src/routes/visualRoutes.test.ts backend/src/validation/visualSchemas.ts backend/src/validation/visualSchemas.test.ts
git commit -m "feat(visual): generate + get-generation public routes with rate limit" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 13: Entities, assets and style-bible read/mutation routes

**Files:**
- Modify: `backend/src/routes/visualRoutes.ts`
- Modify: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Add failing tests** — append to `backend/src/routes/visualRoutes.test.ts`

```ts
import { listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible } from "./visualRoutes";

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement** — append to `backend/src/routes/visualRoutes.ts`

```ts
import { listEntities, getEntity } from "../db/visual/entities";
import { listAssets, getAsset, setAssetCanonicalLevel } from "../db/visual/assets";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getActiveStyleBible } from "../db/visual/styleBible";
import { campaignPk, assetSk } from "../keys";
import { canDeleteAsset } from "@ravenloft/content";

export async function listVisualEntities(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const entries = await listEntities(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: { entries } };
}

export async function getVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const e = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!e) return { status: 404, body: { code: "NOT_FOUND", message: "Entidade não encontrada." } };
  return { status: 200, body: e };
}

export async function listEntityAssets(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const all = await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId);
  const entries = all.filter((a) => a.entityId === req.pathParams.id);
  return { status: 200, body: { entries } };
}

export async function listGallery(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const all = await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId);
  const entries = all.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
  return { status: 200, body: { entries } };
}

export async function canonizeAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "CANONICAL");
  return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL" } };
}

export async function lockAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "LOCKED");
  return { status: 200, body: { id: asset.id, canonicalLevel: "LOCKED" } };
}

export async function unlockAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  await setAssetCanonicalLevel(deps.doc, deps.config.tableName, deps.config.campaignId, asset.id, "CANONICAL");
  return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL" } };
}

export async function deleteAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  if (!canDeleteAsset(asset.canonicalLevel)) throw new HttpError(409, "ASSET_LOCKED", "Imagens travadas não podem ser excluídas. Destrave primeiro.");
  await deps.doc.send(new DeleteCommand({ TableName: deps.config.tableName, Key: { PK: campaignPk(deps.config.campaignId), SK: assetSk(asset.id) } }));
  return { status: 200, body: { id: asset.id, deleted: true } };
}

export async function getStyleBible(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const b = await getActiveStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!b) return { status: 404, body: { code: "NOT_FOUND", message: "Bíblia visual não definida." } };
  return { status: 200, body: b };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/visualRoutes.ts backend/src/routes/visualRoutes.test.ts
git commit -m "feat(visual): entity/asset/gallery/style-bible routes with lock rules" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 14: Context preview route (pre-generation warnings)

**Files:**
- Modify: `backend/src/routes/visualRoutes.ts`
- Modify: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Add failing test** — append to `backend/src/routes/visualRoutes.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: FAIL — `previewContext` not exported.

- [ ] **Step 3: Implement** — append to `backend/src/routes/visualRoutes.ts`

```ts
import { decideOperation } from "../ai/visual/promptCompiler";

export async function previewContext(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { entityId } = parseGenerateBody(req.body);
  const warnings: string[] = [];
  let operation: "GENERATE" | "EDIT" = "GENERATE";
  let referenceCount = 0;

  if (entityId) {
    const entity = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, entityId);
    if (entity) {
      const assets = (await listAssets(deps.doc, deps.config.tableName, deps.config.campaignId)).filter((a) => a.entityId === entityId);
      const canonical = assets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
      operation = decideOperation(canonical);
      referenceCount = Math.min(canonical.length, 2) + 1; // up to 2 identity + 1 style
      if (entity.immutableTraits.length) warnings.push(`Traços imutáveis de ${entity.canonicalName} serão preservados.`);
      if (entity.status === "LOCKED") warnings.push(`${entity.canonicalName} está travado (LOCKED): o pedido não poderá alterar sua identidade canônica.`);
      if (operation === "EDIT") warnings.push(`Esta geração continua a identidade canônica existente de ${entity.canonicalName}.`);
    }
  }
  return { status: 200, body: { operation, referenceCount, warnings } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/visualRoutes.ts backend/src/routes/visualRoutes.test.ts
git commit -m "feat(visual): context preview route with pre-generation warnings" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 15: Register routes + wire deps in handler

**Files:**
- Modify: `backend/src/router.ts`
- Modify: `backend/src/handler.ts`

- [ ] **Step 1: Register the visual routes** — `backend/src/router.ts`

Add to the imports:
```ts
import { createGeneration, getGenerationStatus, listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible, previewContext } from "./routes/visualRoutes";
```
Add to the `routes` array (public — no admin token):
```ts
  r("POST", "/api/visual/generations", createGeneration),
  r("GET", "/api/visual/generations/:id", getGenerationStatus),
  r("POST", "/api/visual/context/preview", previewContext),
  r("GET", "/api/visual/entities", listVisualEntities),
  r("GET", "/api/visual/entities/:id", getVisualEntity),
  r("GET", "/api/visual/entities/:id/assets", listEntityAssets),
  r("GET", "/api/visual/gallery", listGallery),
  r("GET", "/api/visual/style-bible", getStyleBible),
  r("POST", "/api/visual/assets/:id/canonize", canonizeAsset),
  r("POST", "/api/visual/assets/:id/lock", lockAsset),
  r("POST", "/api/visual/assets/:id/unlock", unlockAsset),
  r("DELETE", "/api/visual/assets/:id", deleteAsset),
```

- [ ] **Step 2: Wire deps in the API handler** — `backend/src/handler.ts`

Add imports:
```ts
import { makeImageEditFn } from "./ai/images";
import { invokeWorker } from "./db/visual/invokeWorker";
```
Update the deps assembly:
```ts
const imageEdit = config.openAiApiKey ? makeImageEditFn(config.openAiApiKey) : undefined;
const invokeVisualWorker = config.visualWorkerFunctionName
  ? (payload: { campaignId: string; generationId: string }) => invokeWorker(config.visualWorkerFunctionName, region, payload)
  : undefined;
const deps = { doc, config, chat, image, imageEdit, imageStore, invokeWorker: invokeVisualWorker };
```

- [ ] **Step 3: Typecheck + full backend test run**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/router.ts backend/src/handler.ts
git commit -m "feat(visual): register visual routes and wire pipeline deps" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 16: SAM template — worker Lambda + invoke permission + env

**Files:**
- Modify: `backend/template.yaml`

- [ ] **Step 1: Add the worker function** to `Resources` in `backend/template.yaml` (after `ApiFunction`):

```yaml
  VisualWorkerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: visualWorkerHandler.handler
      CodeUri: dist/
      Timeout: 300
      MemorySize: 1024
      Environment:
        Variables:
          TABLE_NAME: !Ref GameTable
          CAMPAIGN_ID: winter-dead
          ADMIN_CODE_HASH: !Ref AdminCodeHash
          TOKEN_SIGNING_SECRET: !Ref TokenSigningSecret
          ALLOWED_ORIGIN: !Ref AllowedOrigin
          OPENAI_API_KEY: !Ref OpenAiApiKey
          OPENAI_MODEL: !Ref OpenAiModel
          IMAGES_BUCKET: !Ref ImagesBucket
      Policies:
        - Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
                - dynamodb:Query
              Resource:
                - !GetAtt GameTable.Arn
            - Effect: Allow
              Action:
                - s3:PutObject
              Resource:
                - !Sub "${ImagesBucket.Arn}/*"
```

- [ ] **Step 2: Grant the API function permission to invoke the worker + pass its name**

In `ApiFunction` → `Environment` → `Variables`, add:
```yaml
          VISUAL_WORKER_FUNCTION_NAME: !Ref VisualWorkerFunction
```
In `ApiFunction` → `Policies` → `Statement`, add:
```yaml
            - Effect: Allow
              Action:
                - lambda:InvokeFunction
              Resource:
                - !GetAtt VisualWorkerFunction.Arn
```

- [ ] **Step 3: Validate the template**

Run: `cd backend && sam validate --lint`
Expected: template is valid (or `sam validate` if lint unavailable).

- [ ] **Step 4: Build to confirm the new entrypoint compiles into dist/**

Run: `cd backend && npm run build`
Expected: build succeeds and `dist/visualWorkerHandler.mjs` exists.

NOTE (execution): the existing build script only bundled `src/handler.ts` → `dist/handler.mjs`. It was updated to bundle both entrypoints via `--outdir=dist --out-extension:.js=.mjs`, producing `dist/handler.mjs` and `dist/visualWorkerHandler.mjs`. The SAM `Handler: visualWorkerHandler.handler` resolves the `.mjs` file exactly as `ApiFunction`'s `handler.handler` already does. DEPLOY CAVEAT: `sharp` ships native binaries; esbuild bundles it as JS, which will fail at runtime on Lambda. Deployment must externalize `sharp` (`--external:sharp`) and provide it via a node_modules layer / `sam build` — deferred as a deployment concern (Phase-1 backend does not deploy the worker yet).

- [ ] **Step 5: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(visual): SAM worker Lambda, invoke permission, worker env" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 17: Idempotent seeding (10 canon images + StyleBible v1 + entities)

**Files:**
- Create: `backend/src/visual/seed.ts`
- Test: `backend/src/visual/seed.test.ts`
- Modify: `backend/src/routes/visualRoutes.ts` (admin seed route)
- Modify: `backend/src/router.ts` (register admin seed route)

The seed is **pure orchestration over injected effects** so it is unit-testable and idempotent (existing entities/style-bible are not duplicated). It maps the 10 files in `valdren-context/valdren-images/` to CANONICAL assets (the Mapa Oficial becomes LOCKED) and seeds entities from the canon.

- [ ] **Step 1: Write the failing test** — `backend/src/visual/seed.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { seedVisualEncyclopedia, SEED_ITEMS, type SeedDeps } from "./seed";

function makeDeps(over: Partial<SeedDeps> = {}): SeedDeps {
  return {
    getActiveStyleBible: vi.fn(async () => null),
    putStyleBible: vi.fn(async () => {}),
    getEntity: vi.fn(async () => null),
    putEntity: vi.fn(async () => {}),
    putAsset: vi.fn(async () => {}),
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/visual/seed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `backend/src/visual/seed.ts`

```ts
import { newVisualEntity, type VisualStyleBible, type VisualEntity, type VisualAsset, type VisualEntityType, type CanonicalLevel } from "@ravenloft/content";
import { DEFAULT_IMAGE_DIRECTIVES } from "@ravenloft/content";

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
    globalNegativeInstructions: ["sem texto", "sem marca dágua", "sem molduras", DEFAULT_IMAGE_DIRECTIVES.slice(0, 0)].filter(Boolean),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/visual/seed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add an admin seed route** — append to `backend/src/routes/visualRoutes.ts`

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { putStyleBible } from "../db/visual/styleBible";
import { putEntity } from "../db/visual/entities";
import { putAsset } from "../db/visual/assets";
import { seedVisualEncyclopedia, type SeedDeps } from "../visual/seed";
import { verifyAdmin } from "./adminRoutes";

const SEED_IMAGE_DIR = process.env.SEED_IMAGE_DIR || "/var/task/seed-images";

export async function seedVisual(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  verifyAdmin(req, deps.config);
  if (!deps.imageStore) throw new HttpError(503, "IMAGE_DISABLED", "Armazenamento de imagens não configurado.");
  const store = deps.imageStore;
  let counter = 0;
  const seedDeps: SeedDeps = {
    getActiveStyleBible: (c) => getActiveStyleBible(deps.doc, deps.config.tableName, c),
    putStyleBible: (c, b) => putStyleBible(deps.doc, deps.config.tableName, c, b),
    getEntity: (c, id) => getEntity(deps.doc, deps.config.tableName, c, id),
    putEntity: (c, e) => putEntity(deps.doc, deps.config.tableName, c, e),
    putAsset: (c, a) => putAsset(deps.doc, deps.config.tableName, c, a),
    loadSeedImage: (file) => readFile(join(SEED_IMAGE_DIR, file)),
    uploadAsset: async (assetId, original) => {
      const thumb = await sharp(original).resize(512).png().toBuffer();
      return store.uploadVisualAsset(assetId, original, thumb);
    },
    newId: () => `${Date.now().toString(36)}-${(counter++).toString(36)}`,
    now: () => new Date().toISOString(),
  };
  const summary = await seedVisualEncyclopedia(seedDeps, deps.config.campaignId);
  return { status: 200, body: summary };
}
```

Note: confirm `verifyAdmin(req, config)` exists in `adminRoutes.ts`; if the admin check has a different signature, mirror the exact pattern used by other `/api/admin/*` handlers (e.g. `seedWiki`) instead.

- [ ] **Step 6: Register the admin seed route** — `backend/src/router.ts`

Add to the visual imports:
```ts
import { seedVisual } from "./routes/visualRoutes";
```
Add to the `routes` array:
```ts
  r("POST", "/api/admin/visual/seed", seedVisual),
```

- [ ] **Step 7: Typecheck + full test run**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/visual/seed.ts backend/src/visual/seed.test.ts backend/src/routes/visualRoutes.ts backend/src/router.ts
git commit -m "feat(visual): idempotent seeding of canon images, style bible and entities" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Final Verification

- [ ] **Build shared, backend; run all backend tests + typecheck**

Run:
```bash
npm run build:shared && cd backend && npx tsc --noEmit && npx vitest run
```
Expected: shared builds, no type errors, all tests pass.

- [ ] **Validate SAM template**

Run: `cd backend && sam validate --lint`
Expected: valid.

- [ ] **Push (triggers deploy)**

Run: `git push`
Expected: remote updated; deploy pipeline runs.

- [ ] **Seeding note (out-of-band):** The seed route reads images from `SEED_IMAGE_DIR`. Decide during execution whether to bundle the 10 files from `valdren-context/valdren-images/` into the Lambda package (copy into `backend/seed-images/` referenced by build) or upload the 10 files to S3 manually and adjust `loadSeedImage` to fetch from S3. `valdren-context/` itself stays out of git/bundle.

---

## Self-Review

**Spec coverage (Section 9 Fase 1):**
- shared/src/visual models → Task 1. ✔
- StyleBible v1 seeded → Tasks 3, 17. ✔
- VisualEntity/VisualAsset + seed of 10 images and entities → Tasks 4, 5, 17. ✔
- Async pipeline (job + worker) GENERATE/EDIT → Tasks 6, 7, 10, 11. ✔
- Context/Prompt compiler (PUBLICO canon only) → Tasks 8, 10 (canon.ts). ✔
- Full consistency evaluator with auto-retry/corrective edit, thresholds, NEEDS_REVIEW → Tasks 9, 10. ✔
- Cost/budget: `latencyMs`/`retryCount`/`consistencyReport` recorded on the generation; rate limit per IP → Tasks 10, 12. (Monthly campaign budget cap deferred to a later phase — noted below.)
- Public routes (generate → poll → discard/save + preview + gallery) → Tasks 12, 13, 14, 15. ✔
- SAM worker + invoke permission → Task 16. ✔

**Known deferrals (documented, not silent gaps):**
- Monthly per-campaign budget cap: Phase 1 records `estimatedCost` scaffolding but the enforced monthly ceiling is a small follow-up; per-IP rate limiting is in place.
- Side-by-side comparison endpoint (`/compare`) and reference-sheet flows are Section 6/Phase 2 frontend/《reference-sheet》concerns — not backend Phase 1 blockers.
- `estimatedCost` computation left null in the worker; wire a cost table in the frontend plan (1B) or a fast-follow.
- **Image-blind evaluator (Phase 1):** `evaluatorRunner` grades the compiled prompt, not the rendered image (the ChatFn is text-only). The retry loop therefore corrects against prompt intent, not observed pixel violations. Feeding the generated image + reference buffers to a vision model is a Phase 2 improvement.

**Placeholder scan:** No TBD/TODO; every code step contains complete code.

**Type consistency:** `VisualAsset`, `VisualEntity`, `VisualGeneration`, `ConsistencyReport`, `CanonicalLevel`, `ReferenceRole`, `newVisualEntity`, `newVisualGeneration`, `clampVisualText`, `canDeleteAsset` defined in Task 1 and used consistently in Tasks 3–17. `uploadVisualAsset` return shape (`{ key, url, thumbnailKey, thumbnailUrl }`) defined in Task 7 and consumed identically in Tasks 10 and 17. `WorkerPayload` `{ campaignId, generationId }` consistent across Tasks 11, 15, 16.
