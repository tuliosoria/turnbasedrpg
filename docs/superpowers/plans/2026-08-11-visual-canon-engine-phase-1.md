# Visual Canon Engine — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/enciclopedia` into the single Valdren encyclopedia — browsable by lore entry, with entity creation/editing and consistency warnings that explain themselves.

**Architecture:** `WIKI#` (107 lore entries) and `VENTITY#` (10 visual entities) stay separate DynamoDB records linked by a new `VisualEntity.wikiEntryId`. `immutableTraits` becomes `CanonTrait[]` carrying provenance, which is free right now because every live entity has an empty array. The frontend gains a section browser driven by wiki entries, a canon sheet editor, and a consistency panel that renders the `ConsistencyReport` the API already returns.

**Tech Stack:** TypeScript, npm workspaces (`shared`/`backend`/`frontend`), Vitest, React 18 + MUI, AWS Lambda + DynamoDB single-table.

**Spec:** `docs/superpowers/specs/2026-08-11-visual-canon-engine-design.md`

---

### Task 1: Make the shared test suite actually run

`shared/package.json` defines `"test": "tsc -p tsconfig.json --noEmit"` — typecheck only. Six test files (36 tests) exist under `shared/src/` and have **never executed**. Task 2 adds model logic that needs TDD, so wire the runner up first. All 36 currently pass, so this is a green-to-green change.

**Files:**
- Create: `shared/vitest.config.ts`
- Modify: `shared/package.json`

- [ ] **Step 1: Confirm the tests are currently dormant**

Run: `cd shared && npm test`
Expected: only TypeScript typechecking output — no test counts, no "Test Files" summary.

- [ ] **Step 2: Add the vitest config**

Create `shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 3: Run vitest to confirm the existing suite passes**

Run: `cd shared && npx vitest run`
Expected: `Test Files 6 passed (6)`, `Tests 36 passed (36)`.

- [ ] **Step 4: Wire vitest into the test script**

In `shared/package.json`, change the `test` script so typecheck and tests both run:

```json
"test": "tsc -p tsconfig.json --noEmit && vitest run"
```

- [ ] **Step 5: Verify via the workspace script**

Run: `cd shared && npm test`
Expected: typecheck output, then `Tests 36 passed (36)`.

- [ ] **Step 6: Commit**

```bash
git add shared/vitest.config.ts shared/package.json
git commit -m "test: run the shared vitest suite instead of typechecking only"
```

---

### Task 2: Add `CanonTrait` with provenance to the shared model

**Files:**
- Modify: `shared/src/visual/models.ts`
- Test: `shared/src/visual/models.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `shared/src/visual/models.test.ts`:

```ts
import {
  coerceCanonTraits,
  newCanonTrait,
  newVisualEntity,
  type CanonTrait,
} from "./models";

describe("coerceCanonTraits", () => {
  it("passes CanonTrait objects through unchanged", () => {
    const trait: CanonTrait = {
      id: "t1",
      text: "O mar em Krythos é verde-escuro.",
      source: "DISCOVERED",
      originAssetId: "a1",
      createdAt: "2026-08-11T00:00:00.000Z",
    };
    expect(coerceCanonTraits([trait])).toEqual([trait]);
  });

  it("upgrades legacy string traits to AUTHORED CanonTraits", () => {
    const out = coerceCanonTraits(["cidade escavada na montanha"]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("cidade escavada na montanha");
    expect(out[0].source).toBe("AUTHORED");
    expect(out[0].originAssetId).toBeNull();
    expect(out[0].id).toBeTruthy();
  });

  it("returns an empty array for non-array input", () => {
    expect(coerceCanonTraits(undefined)).toEqual([]);
    expect(coerceCanonTraits(null)).toEqual([]);
    expect(coerceCanonTraits("nope")).toEqual([]);
  });

  it("drops entries that are neither strings nor trait-shaped", () => {
    expect(coerceCanonTraits([42, {}, { text: "" }])).toEqual([]);
  });
});

describe("newCanonTrait", () => {
  it("defaults to AUTHORED with no origin asset", () => {
    const t = newCanonTrait({ id: "t9", text: "muralhas de pedra vulcânica" });
    expect(t.source).toBe("AUTHORED");
    expect(t.originAssetId).toBeNull();
    expect(t.createdAt).toBeTruthy();
  });

  it("records the origin asset for a discovered trait", () => {
    const t = newCanonTrait({
      id: "t10",
      text: "O mar é verde-escuro.",
      source: "DISCOVERED",
      originAssetId: "asset-42",
    });
    expect(t.source).toBe("DISCOVERED");
    expect(t.originAssetId).toBe("asset-42");
  });

  it("trims and clamps the trait text", () => {
    const t = newCanonTrait({ id: "t11", text: `  ${"x".repeat(3000)}  ` });
    expect(t.text.length).toBe(2000);
  });
});

describe("newVisualEntity", () => {
  it("starts with no wiki link and no traits", () => {
    const e = newVisualEntity({
      id: "e1",
      campaignId: "winter-dead",
      entityType: "CITY",
      canonicalName: "Khar-Durak",
      slug: "khar-durak",
    });
    expect(e.wikiEntryId).toBeNull();
    expect(e.immutableTraits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd shared && npx vitest run src/visual/models.test.ts`
Expected: FAIL — `coerceCanonTraits is not a function` / `newCanonTrait is not a function`.

- [ ] **Step 3: Implement the model changes**

In `shared/src/visual/models.ts`, add after the `REFERENCE_ROLES` block:

```ts
export const TRAIT_SOURCES = ["AUTHORED", "DISCOVERED", "LORE"] as const;
export type TraitSource = (typeof TRAIT_SOURCES)[number];

export interface CanonTrait {
  id: string;
  text: string;
  source: TraitSource;
  originAssetId: string | null;
  createdAt: string;
}

export interface NewCanonTraitInput {
  id: string;
  text: string;
  source?: TraitSource;
  originAssetId?: string | null;
}

export function newCanonTrait(input: NewCanonTraitInput): CanonTrait {
  return {
    id: input.id,
    text: clampVisualText(input.text),
    source: input.source ?? "AUTHORED",
    originAssetId: input.originAssetId ?? null,
    createdAt: new Date().toISOString(),
  };
}

function isTraitSource(v: unknown): v is TraitSource {
  return typeof v === "string" && (TRAIT_SOURCES as readonly string[]).includes(v);
}

/**
 * Accepts either the current CanonTrait[] shape or the legacy string[] shape and
 * always returns CanonTrait[]. Legacy strings become AUTHORED traits with no
 * origin asset, since nothing recorded where they came from.
 */
export function coerceCanonTraits(value: unknown): CanonTrait[] {
  if (!Array.isArray(value)) return [];
  const out: CanonTrait[] = [];
  for (const raw of value) {
    if (typeof raw === "string") {
      const text = clampVisualText(raw);
      if (!text) continue;
      out.push({
        id: `legacy-${out.length}`,
        text,
        source: "AUTHORED",
        originAssetId: null,
        createdAt: "",
      });
      continue;
    }
    if (typeof raw !== "object" || raw === null) continue;
    const o = raw as Record<string, unknown>;
    const text = clampVisualText(o.text);
    if (!text) continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : `legacy-${out.length}`,
      text,
      source: isTraitSource(o.source) ? o.source : "AUTHORED",
      originAssetId: typeof o.originAssetId === "string" ? o.originAssetId : null,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    });
  }
  return out;
}
```

Change the two `VisualEntity` fields:

```ts
export interface VisualEntity {
  // ...existing fields...
  immutableTraits: CanonTrait[];   // was string[]
  wikiEntryId: string | null;      // new
  // ...existing fields...
}
```

And in `newVisualEntity`, replace `immutableTraits: input.immutableTraits ?? [],` with:

```ts
    immutableTraits: coerceCanonTraits(input.immutableTraits),
    wikiEntryId: input.wikiEntryId ?? null,
```

Update `NewVisualEntityInput`:

```ts
export interface NewVisualEntityInput {
  id: string;
  campaignId: string;
  entityType: VisualEntityType;
  canonicalName: string;
  slug: string;
  publicDescription?: string;
  immutableTraits?: unknown;
  wikiEntryId?: string | null;
  houseId?: string | null;
  regionId?: string | null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd shared && npm test`
Expected: typecheck clean, `Tests 45 passed (45)`.

- [ ] **Step 5: Commit**

```bash
git add shared/src/visual/models.ts shared/src/visual/models.test.ts
git commit -m "feat: add CanonTrait provenance and wikiEntryId to VisualEntity"
```

---

### Task 3: Update all consumers for the new trait shape

Task 2 breaks **five** call sites that treat `immutableTraits` as `string[]` or construct a `VisualEntity` without `wikiEntryId`. The monorepo's root `npm test` is red until every one is fixed, so this task must close all of them — not just the two production files.

The most important is `contextCompiler.ts:33`: without it the compiled AI prompt emits `5. Restrições imutáveis: [object Object]`, silently dropping the constraints the whole feature exists to enforce. That failure is invisible to the typechecker at the fixture call sites, which is why the test fixtures below matter as much as the production code.

Note that `backend` typechecks against `shared/dist` (gitignored build output), not `shared/src` — run `npm run build:shared` from the repo root first, or the breakage stays invisible.

**Files:**
- Modify: `backend/src/db/visual/entities.ts:18-21` — coerce legacy traits on read
- Modify: `backend/src/ai/visual/contextCompiler.ts:33` — map traits to text
- Modify: `backend/src/ai/visual/compilers.test.ts:48,59` — fixtures pass raw `string[]`
- Modify: `backend/src/visual/worker.test.ts:59` — entity fixture missing `wikiEntryId`
- Modify: `frontend/src/api/mockClient.ts:150,159` — `VisualEntity` fixtures missing `wikiEntryId`
- Test: `backend/src/db/visual/entities.test.ts`

**Pre-existing failure, not yours:** `backend/src/db/wiki.test.ts:162-164` reports three `TS18048` errors that exist independently of this work. Leave them alone and note them; do not expand scope to fix them.

For the fixture files, the minimal correct change is to give each `VisualEntity` fixture `wikiEntryId: null` and convert any `immutableTraits: ["..."]` to proper `CanonTrait` objects, e.g. `[{ id: "t1", text: "...", source: "AUTHORED", originAssetId: null, createdAt: "" }]`. In `compilers.test.ts`, the assertions that expect a raw string inside the compiled prompt should still pass once the fixture holds real traits and `contextCompiler` maps them to text — verify that rather than weakening the assertion.

- [ ] **Step 1: Write the failing test**

Append to `backend/src/db/visual/entities.test.ts`:

```ts
import { getEntity } from "./entities";

describe("getEntity trait coercion", () => {
  it("upgrades a legacy string[] immutableTraits record to CanonTrait[]", async () => {
    const doc = {
      send: vi.fn(async () => ({
        Item: {
          PK: "CAMPAIGN#winter-dead",
          SK: "VENTITY#khar-durak",
          id: "khar-durak",
          canonicalName: "Khar-Durak",
          immutableTraits: ["cidade escavada na montanha"],
        },
      })),
    } as unknown as DynamoDBDocumentClient;

    const e = await getEntity(doc, "t", "winter-dead", "khar-durak");
    expect(e?.immutableTraits).toEqual([
      expect.objectContaining({ text: "cidade escavada na montanha", source: "AUTHORED" }),
    ]);
  });

  it("defaults a record with no immutableTraits to an empty array", async () => {
    const doc = {
      send: vi.fn(async () => ({
        Item: { PK: "p", SK: "VENTITY#x", id: "x", canonicalName: "X" },
      })),
    } as unknown as DynamoDBDocumentClient;

    const e = await getEntity(doc, "t", "winter-dead", "x");
    expect(e?.immutableTraits).toEqual([]);
  });
});
```

Make sure the file's existing imports include `vi` from `vitest` and `DynamoDBDocumentClient` from `@aws-sdk/lib-dynamodb`; add them if absent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/db/visual/entities.test.ts`
Expected: FAIL — received `["cidade escavada na montanha"]` (raw strings) instead of trait objects.

- [ ] **Step 3: Coerce on read**

In `backend/src/db/visual/entities.ts`, replace the `strip` function:

```ts
import { coerceCanonTraits } from "@ravenloft/content";

function strip(i: Record<string, unknown>): VisualEntity {
  const { PK, SK, ...rest } = i as any;
  return {
    ...rest,
    immutableTraits: coerceCanonTraits(rest.immutableTraits),
    wikiEntryId: typeof rest.wikiEntryId === "string" ? rest.wikiEntryId : null,
  } as VisualEntity;
}
```

- [ ] **Step 4: Fix the context compiler**

`VisualContextPackage.immutableTraits` stays `string[]` so `promptCompiler.ts:22` (`pkg.immutableTraits.join("; ")`) is untouched. In `backend/src/ai/visual/contextCompiler.ts`, change line 33:

```ts
    immutableTraits: (e?.immutableTraits ?? []).map((t) => t.text),
```

- [ ] **Step 5: Fix the three fixture files**

Give every `VisualEntity` fixture a `wikiEntryId: null`, and convert `immutableTraits: ["..."]` to real `CanonTrait` objects:

```ts
immutableTraits: [
  { id: "t1", text: "cidade escavada na montanha", source: "AUTHORED", originAssetId: null, createdAt: "" },
],
```

Apply to `backend/src/ai/visual/compilers.test.ts:48,59`, `backend/src/visual/worker.test.ts:59`, and `frontend/src/api/mockClient.ts:150,159`.

- [ ] **Step 6: Verify the prompt no longer degrades**

Run: `cd backend && npx vitest run src/ai/visual/compilers.test.ts`
Expected: PASS, and the compiled prompt contains the trait text — not `[object Object]`.

- [ ] **Step 7: Run every suite and both typechecks**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm run build:shared && npm test`
Expected: shared, backend, and frontend all pass.

Run: `cd backend && npm run typecheck`
Expected: only the three pre-existing `TS18048` errors in `src/db/wiki.test.ts:162-164`, nothing else.

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/visual/entities.ts backend/src/db/visual/entities.test.ts backend/src/ai/visual/contextCompiler.ts backend/src/ai/visual/compilers.test.ts backend/src/visual/worker.test.ts frontend/src/api/mockClient.ts
git commit -m "fix: coerce legacy immutableTraits on read and map traits to text for prompts"
```

---

### Task 4: Validation for entity create/update bodies

**Files:**
- Modify: `backend/src/validation/visualSchemas.ts`
- Test: `backend/src/validation/visualSchemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/validation/visualSchemas.test.ts`:

```ts
import { parseCreateEntityBody, parseUpdateEntityBody } from "./visualSchemas";

describe("parseCreateEntityBody", () => {
  it("accepts a minimal valid body", () => {
    const out = parseCreateEntityBody({ canonicalName: "Ordem do Sino", entityType: "HOUSE" });
    expect(out.canonicalName).toBe("Ordem do Sino");
    expect(out.entityType).toBe("HOUSE");
    expect(out.slug).toBe("ordem-do-sino");
    expect(out.wikiEntryId).toBeNull();
  });

  it("slugifies accented names", () => {
    const out = parseCreateEntityBody({ canonicalName: "Mandíbula de Osso", entityType: "CREATURE" });
    expect(out.slug).toBe("mandibula-de-osso");
  });

  it("keeps an explicit wikiEntryId", () => {
    const out = parseCreateEntityBody({ canonicalName: "X", entityType: "CITY", wikiEntryId: "w1" });
    expect(out.wikiEntryId).toBe("w1");
  });

  it("rejects a missing name", () => {
    expect(() => parseCreateEntityBody({ entityType: "CITY" })).toThrow();
  });

  it("rejects an unknown entity type", () => {
    expect(() => parseCreateEntityBody({ canonicalName: "X", entityType: "DRAGON" })).toThrow();
  });
});

describe("parseUpdateEntityBody", () => {
  it("returns only the provided fields", () => {
    const out = parseUpdateEntityBody({ publicDescription: "uma ordem funerária" });
    expect(out.publicDescription).toBe("uma ordem funerária");
    expect(out.immutableTraits).toBeUndefined();
  });

  it("normalises immutable traits into CanonTrait shape", () => {
    const out = parseUpdateEntityBody({ immutableTraits: [{ text: "sinos de bronze escuro" }] });
    expect(out.immutableTraits).toEqual([
      expect.objectContaining({ text: "sinos de bronze escuro", source: "AUTHORED" }),
    ]);
  });

  it("preserves DISCOVERED provenance on an existing trait", () => {
    const out = parseUpdateEntityBody({
      immutableTraits: [
        { id: "t1", text: "mar verde-escuro", source: "DISCOVERED", originAssetId: "a1", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    expect(out.immutableTraits?.[0]).toMatchObject({
      id: "t1", source: "DISCOVERED", originAssetId: "a1",
    });
  });

  it("rejects a status outside the canon levels", () => {
    expect(() => parseUpdateEntityBody({ status: "SUPER_CANON" })).toThrow();
  });

  it("rejects a body that is not an object", () => {
    expect(() => parseUpdateEntityBody("nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/validation/visualSchemas.test.ts`
Expected: FAIL — `parseCreateEntityBody is not a function`.

- [ ] **Step 3: Implement the parsers**

Append to `backend/src/validation/visualSchemas.ts`:

```ts
import {
  clampVisualText,
  coerceCanonTraits,
  isCanonicalLevel,
  isVisualEntityType,
  type CanonicalLevel,
  type CanonTrait,
  type VisualEntityType,
} from "@ravenloft/content";

export interface CreateEntityBody {
  canonicalName: string;
  entityType: VisualEntityType;
  slug: string;
  publicDescription: string;
  wikiEntryId: string | null;
}

export function slugify(name: string): string {
  // ̀-ͯ is the combining-diacritical-marks block, stripped after NFD
  // so "Mandíbula" becomes "mandibula".
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseCreateEntityBody(body: unknown): CreateEntityBody {
  const o = asObject(body);
  const canonicalName = clampVisualText(o.canonicalName, 200);
  if (!canonicalName) throw new HttpError(400, "INVALID_BODY", "Informe o nome canônico da entidade.");
  if (!isVisualEntityType(o.entityType)) throw new HttpError(400, "INVALID_BODY", "Tipo de entidade inválido.");
  const slugSource = typeof o.slug === "string" && o.slug ? o.slug : canonicalName;
  const slug = slugify(slugSource);
  if (!slug) throw new HttpError(400, "INVALID_BODY", "Não foi possível gerar um slug para essa entidade.");
  return {
    canonicalName,
    entityType: o.entityType,
    slug,
    publicDescription: clampVisualText(o.publicDescription),
    wikiEntryId: typeof o.wikiEntryId === "string" && o.wikiEntryId ? o.wikiEntryId : null,
  };
}

export interface UpdateEntityBody {
  canonicalName?: string;
  publicDescription?: string;
  immutableTraits?: CanonTrait[];
  flexibleTraits?: string[];
  prohibitedChanges?: string[];
  visualKeywords?: string[];
  negativeInstructions?: string[];
  scaleDescription?: string;
  culturalContext?: string;
  aliases?: string[];
  status?: CanonicalLevel;
  wikiEntryId?: string | null;
}

function parseStringList(v: unknown): string[] {
  if (!Array.isArray(v)) throw new HttpError(400, "INVALID_BODY", "Esperava uma lista de textos.");
  return v.map((s) => clampVisualText(s)).filter((s) => s.length > 0);
}

export function parseUpdateEntityBody(body: unknown): UpdateEntityBody {
  const o = asObject(body);
  const out: UpdateEntityBody = {};
  if (o.canonicalName !== undefined) {
    const name = clampVisualText(o.canonicalName, 200);
    if (!name) throw new HttpError(400, "INVALID_BODY", "O nome canônico não pode ficar vazio.");
    out.canonicalName = name;
  }
  if (o.publicDescription !== undefined) out.publicDescription = clampVisualText(o.publicDescription);
  if (o.scaleDescription !== undefined) out.scaleDescription = clampVisualText(o.scaleDescription);
  if (o.culturalContext !== undefined) out.culturalContext = clampVisualText(o.culturalContext);
  if (o.immutableTraits !== undefined) out.immutableTraits = coerceCanonTraits(o.immutableTraits);
  if (o.flexibleTraits !== undefined) out.flexibleTraits = parseStringList(o.flexibleTraits);
  if (o.prohibitedChanges !== undefined) out.prohibitedChanges = parseStringList(o.prohibitedChanges);
  if (o.visualKeywords !== undefined) out.visualKeywords = parseStringList(o.visualKeywords);
  if (o.negativeInstructions !== undefined) out.negativeInstructions = parseStringList(o.negativeInstructions);
  if (o.aliases !== undefined) out.aliases = parseStringList(o.aliases);
  if (o.status !== undefined) {
    if (!isCanonicalLevel(o.status)) throw new HttpError(400, "INVALID_BODY", "Status de cânone inválido.");
    out.status = o.status;
  }
  if (o.wikiEntryId !== undefined) {
    out.wikiEntryId = typeof o.wikiEntryId === "string" && o.wikiEntryId ? o.wikiEntryId : null;
  }
  return out;
}
```

Note: `coerceCanonTraits` assigns `legacy-N` ids to traits that arrive without one. Task 5 replaces those with real ids at write time.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/validation/visualSchemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation/visualSchemas.ts backend/src/validation/visualSchemas.test.ts
git commit -m "feat: add validation for visual entity create and update bodies"
```

---

### Task 5: Entity create and update routes

**Files:**
- Modify: `backend/src/routes/visualRoutes.ts`
- Modify: `backend/src/router.ts:85-98`
- Test: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/routes/visualRoutes.test.ts`:

```ts
import { createVisualEntity, updateVisualEntity } from "./visualRoutes";
import { signToken } from "../auth/tokens";

const adminConfig = {
  tableName: "t",
  campaignId: "winter-dead",
  tokenSigningSecret: "s3cret",
} as unknown as Config;

function adminReq(body: unknown, pathParams: Record<string, string> = {}) {
  const token = signToken({ type: "admin", campaignId: "winter-dead" }, "s3cret");
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
    const sent: any[] = [];
    const doc = {
      send: vi.fn(async (cmd: any) => {
        sent.push(cmd);
        return { Items: [], Item: undefined };
      }),
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
});

describe("updateVisualEntity", () => {
  it("merges provided fields and bumps the version", async () => {
    const existing = {
      PK: "p", SK: "VENTITY#e1", id: "e1", campaignId: "winter-dead",
      canonicalName: "Khar-Durak", publicDescription: "antiga", entityType: "CITY",
      immutableTraits: [], version: 1, updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const doc = {
      send: vi.fn(async (cmd: any) => (cmd?.input?.Key ? { Item: existing } : {})),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await updateVisualEntity(
      deps,
      adminReq({ publicDescription: "cidade escavada na montanha" }, { id: "e1" }) as any,
    );

    expect(res.status).toBe(200);
    expect((res.body as any).publicDescription).toBe("cidade escavada na montanha");
    expect((res.body as any).canonicalName).toBe("Khar-Durak");
    expect((res.body as any).version).toBe(2);
  });

  it("assigns real ids to traits that arrive without one", async () => {
    const existing = {
      PK: "p", SK: "VENTITY#e1", id: "e1", canonicalName: "K",
      immutableTraits: [], version: 1,
    };
    const doc = {
      send: vi.fn(async (cmd: any) => (cmd?.input?.Key ? { Item: existing } : {})),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await updateVisualEntity(
      deps,
      adminReq({ immutableTraits: [{ text: "porto interno protegido" }] }, { id: "e1" }) as any,
    );

    const trait = (res.body as any).immutableTraits[0];
    expect(trait.text).toBe("porto interno protegido");
    expect(trait.id).not.toMatch(/^legacy-/);
    expect(trait.createdAt).toBeTruthy();
  });

  it("returns 404 for an unknown entity", async () => {
    const doc = { send: vi.fn(async () => ({ Item: undefined })) } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;
    const res = await updateVisualEntity(deps, adminReq({ publicDescription: "x" }, { id: "nope" }) as any);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: FAIL — `createVisualEntity is not a function`.

- [ ] **Step 3: Implement the routes**

Append to `backend/src/routes/visualRoutes.ts`:

```ts
import { newVisualEntity, type CanonTrait } from "@ravenloft/content";
import { parseCreateEntityBody, parseUpdateEntityBody } from "../validation/visualSchemas";

export async function createVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const body = parseCreateEntityBody(req.body);

  const existing = await listEntities(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (existing.some((e) => e.slug === body.slug)) {
    throw new HttpError(409, "ENTITY_EXISTS", `Já existe uma entidade com o identificador "${body.slug}".`);
  }

  const entity = newVisualEntity({
    id: newId(),
    campaignId: deps.config.campaignId,
    entityType: body.entityType,
    canonicalName: body.canonicalName,
    slug: body.slug,
    publicDescription: body.publicDescription,
    wikiEntryId: body.wikiEntryId,
  });
  await putEntity(deps.doc, deps.config.tableName, deps.config.campaignId, entity);
  return { status: 201, body: entity };
}

export async function updateVisualEntity(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const current = await getEntity(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!current) return { status: 404, body: { code: "NOT_FOUND", message: "Entidade não encontrada." } };

  const patch = parseUpdateEntityBody(req.body);
  const traits: CanonTrait[] | undefined = patch.immutableTraits?.map((t) =>
    t.id.startsWith("legacy-") || !t.createdAt
      ? { ...t, id: newId(), createdAt: t.createdAt || new Date().toISOString() }
      : t,
  );

  const updated = {
    ...current,
    ...patch,
    ...(traits ? { immutableTraits: traits } : {}),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  await putEntity(deps.doc, deps.config.tableName, deps.config.campaignId, updated);
  return { status: 200, body: updated };
}
```

- [ ] **Step 4: Register the routes**

In `backend/src/router.ts`, extend the import on line 7 with `createVisualEntity, updateVisualEntity`, then add below line 90:

```ts
  r("POST", "/api/visual/entities", createVisualEntity),
  r("PUT", "/api/visual/entities/:id", updateVisualEntity),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite and typecheck**

Run: `cd backend && npm test && npm run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/visualRoutes.ts backend/src/routes/visualRoutes.test.ts backend/src/router.ts
git commit -m "feat: add create and update routes for visual entities"
```

---

### Task 6: Coverage route

Powers the "10 de 107 verbetes com cânone visual" line and the reconciliation view.

**Files:**
- Modify: `backend/src/routes/visualRoutes.ts`
- Modify: `backend/src/router.ts`
- Test: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/routes/visualRoutes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts -t coverage`
Expected: FAIL — `getVisualCoverage is not a function`.

- [ ] **Step 3: Implement the route**

Append to `backend/src/routes/visualRoutes.ts`:

```ts
import { listWikiEntries } from "../db/wiki";

export async function getVisualCoverage(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const [entries, entities] = await Promise.all([
    listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId),
    listEntities(deps.doc, deps.config.tableName, deps.config.campaignId),
  ]);

  const linked = new Set(entities.map((e) => e.wikiEntryId).filter((id): id is string => !!id));
  const bySection = new Map<string, { section: string; total: number; covered: number }>();
  for (const entry of entries) {
    const row = bySection.get(entry.section) ?? { section: entry.section, total: 0, covered: 0 };
    row.total += 1;
    if (linked.has(entry.entryId)) row.covered += 1;
    bySection.set(entry.section, row);
  }

  return {
    status: 200,
    body: {
      totalEntries: entries.length,
      coveredEntries: entries.filter((e) => linked.has(e.entryId)).length,
      sections: [...bySection.values()],
      unlinkedEntities: entities
        .filter((e) => !e.wikiEntryId)
        .map((e) => ({ id: e.id, canonicalName: e.canonicalName })),
    },
  };
}
```

- [ ] **Step 4: Register the route**

In `backend/src/router.ts`, add `getVisualCoverage` to the import on line 7 and add:

```ts
  r("GET", "/api/visual/coverage", getVisualCoverage),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/visualRoutes.ts backend/src/routes/visualRoutes.test.ts backend/src/router.ts
git commit -m "feat: add visual canon coverage endpoint"
```

---

### Task 7: Fix the two worker bugs

`worker.ts:48` searches `entityAssets` for the style-bible reference asset, which never lives there — so the style reference resolves to `null` on nearly every generation. `worker.ts:77` hardcodes `assetType: "SCENE"`.

**Files:**
- Modify: `backend/src/visual/worker.ts:38-90`
- Test: `backend/src/visual/worker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/visual/worker.test.ts`:

```ts
describe("style reference resolution", () => {
  it("loads the style reference by id even though it is not an entity asset", async () => {
    const styleAsset = {
      id: "style-1", entityId: null, canonicalLevel: "LOCKED", storageKey: "k", storageUrl: "u",
    } as any;
    const loaded: string[] = [];

    const deps = makeWorkerDeps({
      getActiveStyleBible: async () => ({
        campaignId: "winter-dead", version: 3, status: "ACTIVE", artMedium: "pintura digital",
        renderingStyle: "dark fantasy", lightingRules: "fria", colorPalette: "fria",
        architectureRenderingRules: "gótica", characterRenderingRules: "identidade preservada",
        prohibitedStyles: [], globalNegativeInstructions: [], referenceAssetIds: ["style-1"],
        createdAt: "",
      }),
      getAsset: async (_c: string, id: string) => (id === "style-1" ? styleAsset : null),
      loadReferenceBuffer: async (a: any) => {
        loaded.push(a.id);
        return Buffer.from("ref");
      },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(loaded).toContain("style-1");
  });
});

describe("asset type", () => {
  it("uses the assetType from the generation instead of always SCENE", async () => {
    const saved: any[] = [];
    const deps = makeWorkerDeps({
      getGeneration: async () => ({
        ...baseGeneration(), assetType: "PORTRAIT",
      }),
      putAsset: async (_c: string, a: any) => {
        saved.push(a);
      },
    });

    await runGenerationPipeline(deps, "winter-dead", "g1");

    expect(saved[0].assetType).toBe("PORTRAIT");
  });
});
```

Reuse the file's existing `makeWorkerDeps`/`baseGeneration` helpers. If the file has no such helpers, add them by mirroring the fake `WorkerDeps` object already used in that file's tests — every function in the `WorkerDeps` interface (`backend/src/visual/worker.ts:11-27`) must be present.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/visual/worker.test.ts`
Expected: FAIL — `loaded` does not contain `style-1`; `assetType` is `"SCENE"`.

- [ ] **Step 3: Add `getAsset` and `assetType` to the plumbing**

In `shared/src/visual/models.ts`, add to `VisualGeneration`:

```ts
  assetType: VisualAssetType;
```

and in `newVisualGeneration`, add `assetType: "SCENE",` to the returned object so existing callers keep today's behaviour.

In `backend/src/visual/worker.ts`, add to the `WorkerDeps` interface:

```ts
  getAsset: (campaignId: string, id: string) => Promise<VisualAsset | null>;
```

- [ ] **Step 4: Fix the style reference lookup**

In `backend/src/visual/worker.ts`, replace lines 48-51:

```ts
    const styleRefId = styleBible.referenceAssetIds[0];
    const styleRef = styleRefId ? await deps.getAsset(campaignId, styleRefId) : null;
    const refs = selectReferences({ styleAsset: styleRef, entityAssets: canonicalAssets, continuityAsset: null });
```

- [ ] **Step 5: Fix the hardcoded asset type**

In the same file, in the `asset` object (line 77), replace `assetType: "SCENE",` with:

```ts
      assetType: gen.assetType ?? "SCENE",
```

- [ ] **Step 6: Wire `getAsset` into the worker handler**

In `backend/src/visualWorkerHandler.ts`, add `getAsset` to the deps object it builds, using the same import already used for `putAsset`:

```ts
    getAsset: (campaignId, id) => getAsset(doc, tableName, campaignId, id),
```

Import `getAsset` from `./db/visual/assets` alongside the existing `putAsset` import.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && npm test && npm run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/visual/worker.ts backend/src/visual/worker.test.ts backend/src/visualWorkerHandler.ts shared/src/visual/models.ts
git commit -m "fix: resolve the style reference by id and honour the requested asset type"
```

---

### Task 8: API client methods

`ApiClient` is an interface implemented by **both** `httpClient.ts` and `mockClient.ts`. Adding a method to the interface without adding it to both breaks the frontend typecheck and every test that uses `MockApiClient`.

**Files:**
- Modify: `frontend/src/api/client.ts:49-56`
- Modify: `frontend/src/api/httpClient.ts:165-177`
- Modify: `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/mockClient.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/api/mockClient.test.ts`:

```ts
describe("visual canon methods", () => {
  it("creates an entity and returns it from the list", async () => {
    const client = new MockApiClient();
    const created = await client.createVisualEntity("admin-token", {
      canonicalName: "Ordem do Sino",
      entityType: "HOUSE",
    });
    expect(created.canonicalName).toBe("Ordem do Sino");
    const all = await client.listVisualEntities();
    expect(all.map((e) => e.canonicalName)).toContain("Ordem do Sino");
  });

  it("updates an entity's immutable traits", async () => {
    const client = new MockApiClient();
    const created = await client.createVisualEntity("admin-token", {
      canonicalName: "Khar-Durak",
      entityType: "CITY",
    });
    const updated = await client.updateVisualEntity("admin-token", created.id, {
      immutableTraits: [
        { id: "t1", text: "escavada na montanha", source: "AUTHORED", originAssetId: null, createdAt: "" },
      ],
    });
    expect(updated.immutableTraits[0].text).toBe("escavada na montanha");
  });

  it("reports coverage totals", async () => {
    const client = new MockApiClient();
    const coverage = await client.getVisualCoverage();
    expect(typeof coverage.totalEntries).toBe("number");
    expect(typeof coverage.coveredEntries).toBe("number");
    expect(Array.isArray(coverage.sections)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: FAIL — `client.createVisualEntity is not a function`.

- [ ] **Step 3: Extend the interface**

In `frontend/src/api/client.ts`, add these types above the `ApiClient` interface:

```ts
export interface CreateVisualEntityInput {
  canonicalName: string;
  entityType: VisualEntity["entityType"];
  publicDescription?: string;
  wikiEntryId?: string | null;
}

export type UpdateVisualEntityInput = Partial<
  Pick<
    VisualEntity,
    | "canonicalName" | "publicDescription" | "immutableTraits" | "flexibleTraits"
    | "prohibitedChanges" | "visualKeywords" | "negativeInstructions"
    | "scaleDescription" | "culturalContext" | "aliases" | "status" | "wikiEntryId"
  >
>;

export interface VisualCoverageSection {
  section: string;
  total: number;
  covered: number;
}

export interface VisualCoverage {
  totalEntries: number;
  coveredEntries: number;
  sections: VisualCoverageSection[];
  unlinkedEntities: { id: string; canonicalName: string }[];
}
```

Add to the `ApiClient` interface, next to the existing visual methods:

```ts
  createVisualEntity(adminToken: string, input: CreateVisualEntityInput): Promise<VisualEntity>;
  updateVisualEntity(adminToken: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity>;
  getVisualCoverage(): Promise<VisualCoverage>;
```

- [ ] **Step 4: Implement in the HTTP client**

In `frontend/src/api/httpClient.ts`, add after `getVisualEntityAssets` (line 177), and add the new types to the `./client` import at the top:

```ts
  async createVisualEntity(adminToken: string, input: CreateVisualEntityInput): Promise<VisualEntity> {
    return this.request<VisualEntity>("/api/visual/entities", {
      method: "POST",
      body: input,
      token: adminToken,
    });
  }

  async updateVisualEntity(adminToken: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity> {
    return this.request<VisualEntity>(`/api/visual/entities/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
      token: adminToken,
    });
  }

  async getVisualCoverage(): Promise<VisualCoverage> {
    return this.request<VisualCoverage>("/api/visual/coverage");
  }
```

- [ ] **Step 5: Implement in the mock client**

In `frontend/src/api/mockClient.ts`, add to the class (matching how it stores other in-memory state):

```ts
  async createVisualEntity(_adminToken: string, input: CreateVisualEntityInput): Promise<VisualEntity> {
    const entity = newVisualEntity({
      id: `mock-${this.visualEntities.length + 1}`,
      campaignId: "winter-dead",
      entityType: input.entityType,
      canonicalName: input.canonicalName,
      slug: input.canonicalName.toLowerCase().replace(/\s+/g, "-"),
      publicDescription: input.publicDescription,
      wikiEntryId: input.wikiEntryId ?? null,
    });
    this.visualEntities.push(entity);
    return entity;
  }

  async updateVisualEntity(_adminToken: string, id: string, input: UpdateVisualEntityInput): Promise<VisualEntity> {
    const i = this.visualEntities.findIndex((e) => e.id === id);
    if (i === -1) throw new Error("Entidade não encontrada.");
    this.visualEntities[i] = {
      ...this.visualEntities[i],
      ...input,
      version: this.visualEntities[i].version + 1,
    };
    return this.visualEntities[i];
  }

  async getVisualCoverage(): Promise<VisualCoverage> {
    const linked = new Set(this.visualEntities.map((e) => e.wikiEntryId).filter(Boolean));
    return {
      totalEntries: this.wikiEntries.length,
      coveredEntries: this.wikiEntries.filter((w) => linked.has(w.entryId)).length,
      sections: [],
      unlinkedEntities: this.visualEntities
        .filter((e) => !e.wikiEntryId)
        .map((e) => ({ id: e.id, canonicalName: e.canonicalName })),
    };
  }
```

If `mockClient.ts` holds its visual entities in a differently-named field, use that field instead of `this.visualEntities`, and likewise for wiki entries. Import `newVisualEntity` from `@ravenloft/content` and the new input types from `./client`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck the frontend**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors — confirms both client implementations satisfy the interface.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/mockClient.test.ts
git commit -m "feat: add entity create/update and coverage methods to the API client"
```

---

### Task 9: Consistency report panel

Replaces the bare "Divergência do cânone detectada (score 72)" with the violations, sub-scores, corrections, and references already present in the payload.

**Files:**
- Create: `frontend/src/pages/enciclopedia/ConsistencyReportPanel.tsx`
- Create: `frontend/src/pages/enciclopedia/ConsistencyReportPanel.test.tsx`
- Modify: `frontend/src/pages/enciclopedia/EstudioTab.tsx:183-193`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/enciclopedia/ConsistencyReportPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsistencyReportPanel } from "./ConsistencyReportPanel";
import type { ConsistencyReport } from "@ravenloft/content";

const report: ConsistencyReport = {
  overallScore: 72,
  styleScore: 88,
  characterIdentityScore: 54,
  architectureScore: 70,
  paletteScore: 91,
  violations: [
    { severity: "HIGH", category: "identidade", description: "O rosto não corresponde ao retrato canônico de Alic." },
    { severity: "LOW", category: "paleta", description: "Tons ligeiramente quentes demais." },
  ],
  recommendedAction: "CORRECTIVE_EDIT",
  correctionInstructions: ["Preservar o formato do queixo e a cor dos olhos."],
};

describe("ConsistencyReportPanel", () => {
  it("lists each violation with its severity and category", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} />);
    expect(screen.getByText("O rosto não corresponde ao retrato canônico de Alic.")).toBeInTheDocument();
    expect(screen.getByText("Tons ligeiramente quentes demais.")).toBeInTheDocument();
    expect(screen.getByText(/identidade/)).toBeInTheDocument();
  });

  it("shows the four sub-scores", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} />);
    expect(screen.getByText(/Estilo 88/)).toBeInTheDocument();
    expect(screen.getByText(/Identidade 54/)).toBeInTheDocument();
    expect(screen.getByText(/Arquitetura 70/)).toBeInTheDocument();
    expect(screen.getByText(/Paleta 91/)).toBeInTheDocument();
  });

  it("shows the correction instructions", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} />);
    expect(screen.getByText("Preservar o formato do queixo e a cor dos olhos.")).toBeInTheDocument();
  });

  it("reports how many references were attached", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} />);
    expect(screen.getByText(/3 referências anexadas/)).toBeInTheDocument();
  });

  it("renders a clean state when there are no violations", () => {
    render(
      <ConsistencyReportPanel
        report={{ ...report, violations: [], correctionInstructions: [], overallScore: 96 }}
        referenceCount={2}
      />,
    );
    expect(screen.getByText(/Nenhuma divergência/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/ConsistencyReportPanel.test.tsx`
Expected: FAIL — cannot resolve `./ConsistencyReportPanel`.

- [ ] **Step 3: Implement the panel**

Create `frontend/src/pages/enciclopedia/ConsistencyReportPanel.tsx`:

```tsx
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ConsistencyReport, ConsistencyViolation } from "@ravenloft/content";

const SEVERITY_COLOR: Record<ConsistencyViolation["severity"], "error" | "warning" | "default"> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "default",
};

interface ConsistencyReportPanelProps {
  report: ConsistencyReport;
  referenceCount: number;
}

export function ConsistencyReportPanel({ report, referenceCount }: ConsistencyReportPanelProps) {
  const hasViolations = report.violations.length > 0;

  return (
    <Box sx={{ mt: 1 }}>
      <Alert severity={hasViolations ? "warning" : "success"}>
        {hasViolations
          ? `Divergências do cânone (score ${report.overallScore})`
          : `Nenhuma divergência detectada (score ${report.overallScore})`}
      </Alert>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
        <Chip size="small" label={`Estilo ${report.styleScore}`} />
        <Chip size="small" label={`Identidade ${report.characterIdentityScore}`} />
        <Chip size="small" label={`Arquitetura ${report.architectureScore}`} />
        <Chip size="small" label={`Paleta ${report.paletteScore}`} />
      </Stack>

      {hasViolations && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {report.violations.map((v, i) => (
            <Box key={`${v.category}-${i}`} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Chip size="small" color={SEVERITY_COLOR[v.severity]} label={v.severity} />
              <Box>
                <Typography variant="caption" color="text.secondary">{v.category}</Typography>
                <Typography variant="body2">{v.description}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {report.correctionInstructions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Correções sugeridas</Typography>
          {report.correctionInstructions.map((c, i) => (
            <Typography key={`${i}-${c}`} variant="body2">{c}</Typography>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
        {referenceCount} referências anexadas a esta geração.
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/ConsistencyReportPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Use it in the Estúdio**

In `frontend/src/pages/enciclopedia/EstudioTab.tsx`, add the import:

```tsx
import { ConsistencyReportPanel } from "./ConsistencyReportPanel";
```

Replace the `needsReview ? (...) : (...)` block (lines 183-193) with:

```tsx
          {resultAsset.consistencyReport ? (
            <ConsistencyReportPanel
              report={resultAsset.consistencyReport}
              referenceCount={generation?.referenceAssetIds.length ?? 0}
            />
          ) : (
            <Alert severity={needsReview ? "warning" : "success"} sx={{ mt: 1 }}>
              {needsReview
                ? "Divergência do cânone detectada — revise antes de canonizar."
                : "Passou na verificação de consistência."}
            </Alert>
          )}
```

- [ ] **Step 6: Run the Estúdio tests**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/`
Expected: PASS. If an existing `EstudioTab` assertion matches the old warning string, update that assertion to match the new panel text.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/enciclopedia/ConsistencyReportPanel.tsx frontend/src/pages/enciclopedia/ConsistencyReportPanel.test.tsx frontend/src/pages/enciclopedia/EstudioTab.tsx
git commit -m "feat: show why an image diverged from canon instead of a bare score"
```

---

### Task 10: Canon sheet editor

**Files:**
- Create: `frontend/src/pages/enciclopedia/CanonSheet.tsx`
- Create: `frontend/src/pages/enciclopedia/CanonSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/enciclopedia/CanonSheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanonSheet } from "./CanonSheet";
import { newVisualEntity } from "@ravenloft/content";

function makeEntity() {
  const e = newVisualEntity({
    id: "e1", campaignId: "winter-dead", entityType: "CITY",
    canonicalName: "Khar-Durak", slug: "khar-durak",
    publicDescription: "Cidade da Montanha Viva",
  });
  e.immutableTraits = [
    { id: "t1", text: "escavada na montanha", source: "AUTHORED", originAssetId: null, createdAt: "" },
    { id: "t2", text: "mar verde-escuro", source: "DISCOVERED", originAssetId: "a9", createdAt: "" },
  ];
  return e;
}

describe("CanonSheet", () => {
  it("shows each trait with its provenance badge", () => {
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={vi.fn()} />);
    expect(screen.getByText("escavada na montanha")).toBeInTheDocument();
    expect(screen.getByText("mar verde-escuro")).toBeInTheDocument();
    expect(screen.getByText("Descoberto")).toBeInTheDocument();
  });

  it("adds a new trait and saves it as AUTHORED", async () => {
    const onSave = vi.fn();
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={onSave} />);

    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Novo traço imutável" }), "portão de pedra monumental");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Adicionar traço" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const traits = onSave.mock.calls[0][0].immutableTraits;
    expect(traits).toHaveLength(3);
    expect(traits[2]).toMatchObject({ text: "portão de pedra monumental", source: "AUTHORED" });
  });

  it("removes a trait", async () => {
    const onSave = vi.fn();
    render(<CanonSheet entity={makeEntity()} isAdmin onSave={onSave} />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Remover traço: escavada na montanha" }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Salvar cânone" }));
    });

    expect(onSave.mock.calls[0][0].immutableTraits).toHaveLength(1);
  });

  it("hides editing controls for non-admins", () => {
    render(<CanonSheet entity={makeEntity()} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Salvar cânone" })).not.toBeInTheDocument();
    expect(screen.getByText("escavada na montanha")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/CanonSheet.test.tsx`
Expected: FAIL — cannot resolve `./CanonSheet`.

- [ ] **Step 3: Implement the canon sheet**

Create `frontend/src/pages/enciclopedia/CanonSheet.tsx`:

```tsx
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CanonTrait, VisualEntity } from "@ravenloft/content";
import type { UpdateVisualEntityInput } from "../../api/client";

const SOURCE_LABEL: Record<CanonTrait["source"], string> = {
  AUTHORED: "Escrito",
  DISCOVERED: "Descoberto",
  LORE: "Do verbete",
};

interface CanonSheetProps {
  entity: VisualEntity;
  isAdmin: boolean;
  onSave: (patch: UpdateVisualEntityInput) => void;
  saving?: boolean;
}

export function CanonSheet({ entity, isAdmin, onSave, saving = false }: CanonSheetProps) {
  const [description, setDescription] = useState(entity.publicDescription);
  const [traits, setTraits] = useState<CanonTrait[]>(entity.immutableTraits);
  const [draft, setDraft] = useState("");

  const addTrait = () => {
    const text = draft.trim();
    if (!text) return;
    setTraits([...traits, { id: `new-${traits.length}`, text, source: "AUTHORED", originAssetId: null, createdAt: "" }]);
    setDraft("");
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2">Descrição</Typography>
        {isAdmin ? (
          <TextField
            label="Descrição pública"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        ) : (
          <Typography variant="body2">{description}</Typography>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2">Traços imutáveis</Typography>
        <Typography variant="caption" color="text.secondary">
          Fatos que nenhuma imagem futura pode contradizer.
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {traits.map((t) => (
            <Box key={t.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Chip size="small" label={SOURCE_LABEL[t.source]} />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{t.text}</Typography>
              {isAdmin && (
                <IconButton
                  size="small"
                  aria-label={`Remover traço: ${t.text}`}
                  onClick={() => setTraits(traits.filter((x) => x.id !== t.id))}
                >
                  ×
                </IconButton>
              )}
            </Box>
          ))}
          {traits.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nenhum traço imutável ainda.
            </Typography>
          )}
        </Stack>
      </Box>

      {isAdmin && (
        <>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Novo traço imutável"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              fullWidth
              size="small"
            />
            <Button onClick={addTrait}>Adicionar traço</Button>
          </Stack>
          <Box>
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => onSave({ publicDescription: description, immutableTraits: traits })}
            >
              {saving ? "Salvando…" : "Salvar cânone"}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/CanonSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/enciclopedia/CanonSheet.tsx frontend/src/pages/enciclopedia/CanonSheet.test.tsx
git commit -m "feat: add the canon sheet editor with trait provenance"
```

---

### Task 11: Restructure the encyclopedia page

**Files:**
- Modify: `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx`
- Create: `frontend/src/pages/enciclopedia/AcervoTab.tsx`
- Create: `frontend/src/pages/enciclopedia/AcervoTab.test.tsx`
- Modify: `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/enciclopedia/AcervoTab.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AcervoTab } from "./AcervoTab";
import { clearAdminToken } from "../../auth/adminSession";

async function setup(isAdmin: boolean) {
  const client = new MockApiClient();
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <AcervoTab isAdmin={isAdmin} />
      </ApiProvider>,
    );
  });
  return client;
}

describe("AcervoTab", () => {
  afterEach(() => clearAdminToken());

  it("shows the coverage line", async () => {
    await setup(false);
    await waitFor(() => expect(screen.getByText(/verbetes com cânone visual/)).toBeInTheDocument());
  });

  it("marks entries without a visual entity", async () => {
    await setup(false);
    await waitFor(() => expect(screen.getAllByText("visual ✗").length).toBeGreaterThan(0));
  });

  it("offers entity creation to admins on an uncovered entry", async () => {
    await setup(true);
    await waitFor(() => expect(screen.getAllByText("visual ✗").length).toBeGreaterThan(0));
    await act(async () => {
      await userEvent.click(screen.getAllByRole("button", { name: "Criar entidade visual" })[0]);
    });
    await waitFor(() => expect(screen.getByText("Traços imutáveis")).toBeInTheDocument());
  });

  it("hides entity creation from non-admins", async () => {
    await setup(false);
    await waitFor(() => expect(screen.getByText(/verbetes com cânone visual/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Criar entidade visual" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/AcervoTab.test.tsx`
Expected: FAIL — cannot resolve `./AcervoTab`.

- [ ] **Step 3: Implement the acervo tab**

Create `frontend/src/pages/enciclopedia/AcervoTab.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { loadAdminToken } from "../../auth/adminSession";
import { LoadingState } from "../../components/LoadingState";
import { CanonSheet } from "./CanonSheet";
import { WIKI_SECTIONS, type VisualEntity, type WikiEntry } from "@ravenloft/content";
import type { UpdateVisualEntityInput } from "../../api/client";

interface AcervoTabProps {
  isAdmin: boolean;
}

export function AcervoTab({ isAdmin }: AcervoTabProps) {
  const api = useApi();
  const [entries, setEntries] = useState<WikiEntry[] | null>(null);
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [section, setSection] = useState(WIKI_SECTIONS[0].id);
  const [open, setOpen] = useState<VisualEntity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [w, e] = await Promise.all([api.getWiki(), api.listVisualEntities()]);
      setEntries(w);
      setEntities(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o acervo.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const byWikiId = useMemo(() => {
    const m = new Map<string, VisualEntity>();
    for (const e of entities) if (e.wikiEntryId) m.set(e.wikiEntryId, e);
    return m;
  }, [entities]);

  const covered = entries?.filter((w) => byWikiId.has(w.entryId)).length ?? 0;

  const promote = useCallback(
    async (entry: WikiEntry) => {
      const token = loadAdminToken();
      if (!token) return;
      const created = await api.createVisualEntity(token, {
        canonicalName: entry.title,
        entityType: "HOUSE",
        publicDescription: entry.body.slice(0, 500),
        wikiEntryId: entry.entryId,
      });
      setEntities((prev) => [...prev, created]);
      setOpen(created);
    },
    [api],
  );

  const save = useCallback(
    async (patch: UpdateVisualEntityInput) => {
      const token = loadAdminToken();
      if (!token || !open) return;
      setSaving(true);
      try {
        const updated = await api.updateVisualEntity(token, open.id, patch);
        setEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setOpen(updated);
      } finally {
        setSaving(false);
      }
    },
    [api, open],
  );

  if (error) {
    return <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>{error}</Alert>;
  }
  if (!entries) return <LoadingState />;

  const visible = entries.filter((e) => e.section === section);

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {covered} de {entries.length} verbetes com cânone visual
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {WIKI_SECTIONS.map((s) => (
          <Button
            key={s.id}
            size="small"
            variant={s.id === section ? "contained" : "outlined"}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </Stack>

      <List>
        {visible.map((entry) => {
          const entity = byWikiId.get(entry.entryId);
          return (
            <ListItemButton key={entry.entryId} onClick={() => entity && setOpen(entity)}>
              <ListItemText primary={entry.title} />
              <Typography variant="caption" sx={{ mr: 2 }}>
                {entity ? "visual ✓" : "visual ✗"}
              </Typography>
              {isAdmin && !entity && (
                <Button
                  size="small"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void promote(entry);
                  }}
                >
                  Criar entidade visual
                </Button>
              )}
            </ListItemButton>
          );
        })}
        {visible.length === 0 && (
          <Typography color="text.secondary">Nenhum verbete nesta seção.</Typography>
        )}
      </List>

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        {open && (
          <>
            <DialogTitle>{open.canonicalName}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 1 }}>
                <CanonSheet entity={open} isAdmin={isAdmin} onSave={(p) => void save(p)} saving={saving} />
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/AcervoTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the tab to the page**

In `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx`, import `AcervoTab` and make it the first tab:

```tsx
      <Typography variant="h4" sx={{ mb: 2 }}>Valdren — Enciclopédia</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Acervo" />
        <Tab label="Galeria" />
        <Tab label="Entidades" />
        <Tab label="Estúdio" />
      </Tabs>
      <Box hidden={tab !== 0}>{tab === 0 && <AcervoTab isAdmin={isAdmin} />}</Box>
      <Box hidden={tab !== 1}>{tab === 1 && <GaleriaTab />}</Box>
      <Box hidden={tab !== 2}>{tab === 2 && <EntidadesTab />}</Box>
      <Box hidden={tab !== 3}>{tab === 3 && <EstudioTab isAdmin={isAdmin} />}</Box>
```

- [ ] **Step 6: Run the full enciclopedia suite**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/`
Expected: PASS. If `EnciclopediaPage.test.tsx` asserts the old heading `"Enciclopédia Visual"` or tab indices, update those assertions.

- [ ] **Step 7: Run every suite and typecheck**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test`
Expected: shared, backend, and frontend all pass.

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/enciclopedia/
git commit -m "feat: browse Valdren by lore entry and promote entries into visual canon"
```

---

### Task 12: Style bible edit route

The Bíblia Visual is the single highest-leverage control over output consistency, and today it can only be read (`GET /api/visual/style-bible`) or written by `seedVisual`. Editing publishes a new version and archives the previous one, so `VisualAsset.styleBibleVersion` stays meaningful.

**Files:**
- Modify: `backend/src/validation/visualSchemas.ts`
- Modify: `backend/src/routes/visualRoutes.ts`
- Modify: `backend/src/router.ts`
- Test: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/routes/visualRoutes.test.ts`:

```ts
import { updateStyleBible } from "./visualRoutes";

describe("updateStyleBible", () => {
  it("publishes a new version and archives the previous one", async () => {
    const active = {
      PK: "p", SK: "VSTYLE#0002", campaignId: "winter-dead", version: 2, status: "ACTIVE",
      artMedium: "pintura digital", renderingStyle: "dark fantasy", lightingRules: "fria",
      colorPalette: "fria", architectureRenderingRules: "gótica",
      characterRenderingRules: "identidade preservada", prohibitedStyles: [],
      globalNegativeInstructions: [], referenceAssetIds: [], createdAt: "",
    };
    const puts: any[] = [];
    const doc = {
      send: vi.fn(async (cmd: any) => {
        if (cmd?.input?.Item) {
          puts.push(cmd.input.Item);
          return {};
        }
        return { Items: [active] };
      }),
    } as unknown as DynamoDBDocumentClient;
    const deps = { doc, config: adminConfig } as unknown as Deps;

    const res = await updateStyleBible(deps, adminReq({ renderingStyle: "dark fantasy invernal" }) as any);

    expect(res.status).toBe(200);
    expect((res.body as any).version).toBe(3);
    expect((res.body as any).renderingStyle).toBe("dark fantasy invernal");
    expect((res.body as any).status).toBe("ACTIVE");
    expect(puts.some((i) => i.version === 2 && i.status === "ARCHIVED")).toBe(true);
  });

  it("rejects a request without an admin token", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [] })) } as unknown as DynamoDBDocumentClient;
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts -t updateStyleBible`
Expected: FAIL — `updateStyleBible is not a function`.

- [ ] **Step 3: Add the body parser**

Append to `backend/src/validation/visualSchemas.ts`:

```ts
export interface UpdateStyleBibleBody {
  artMedium?: string;
  renderingStyle?: string;
  lightingRules?: string;
  colorPalette?: string;
  architectureRenderingRules?: string;
  characterRenderingRules?: string;
  prohibitedStyles?: string[];
  globalNegativeInstructions?: string[];
  referenceAssetIds?: string[];
}

export function parseUpdateStyleBibleBody(body: unknown): UpdateStyleBibleBody {
  const o = asObject(body);
  const out: UpdateStyleBibleBody = {};
  if (o.artMedium !== undefined) out.artMedium = clampVisualText(o.artMedium);
  if (o.renderingStyle !== undefined) out.renderingStyle = clampVisualText(o.renderingStyle);
  if (o.lightingRules !== undefined) out.lightingRules = clampVisualText(o.lightingRules);
  if (o.colorPalette !== undefined) out.colorPalette = clampVisualText(o.colorPalette);
  if (o.architectureRenderingRules !== undefined) out.architectureRenderingRules = clampVisualText(o.architectureRenderingRules);
  if (o.characterRenderingRules !== undefined) out.characterRenderingRules = clampVisualText(o.characterRenderingRules);
  if (o.prohibitedStyles !== undefined) out.prohibitedStyles = parseStringList(o.prohibitedStyles);
  if (o.globalNegativeInstructions !== undefined) out.globalNegativeInstructions = parseStringList(o.globalNegativeInstructions);
  if (o.referenceAssetIds !== undefined) out.referenceAssetIds = parseStringList(o.referenceAssetIds);
  return out;
}
```

- [ ] **Step 4: Implement the route**

Append to `backend/src/routes/visualRoutes.ts`:

```ts
import { parseUpdateStyleBibleBody } from "../validation/visualSchemas";

export async function updateStyleBible(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const current = await getActiveStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!current) return { status: 404, body: { code: "NOT_FOUND", message: "Bíblia visual não definida." } };

  const patch = parseUpdateStyleBibleBody(req.body);

  await putStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId, {
    ...current,
    status: "ARCHIVED",
  });

  const next = {
    ...current,
    ...patch,
    version: current.version + 1,
    status: "ACTIVE" as const,
    createdAt: new Date().toISOString(),
  };
  await putStyleBible(deps.doc, deps.config.tableName, deps.config.campaignId, next);
  return { status: 200, body: next };
}
```

- [ ] **Step 5: Register the route**

In `backend/src/router.ts`, add `updateStyleBible` to the import on line 7 and add:

```ts
  r("PUT", "/api/visual/style-bible", updateStyleBible),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && npm test && npm run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/validation/visualSchemas.ts backend/src/routes/visualRoutes.ts backend/src/router.ts backend/src/routes/visualRoutes.test.ts
git commit -m "feat: allow editing the visual style bible with versioning"
```

---

### Task 13: Reconcile the 10 existing entities with their lore entries

The seeded entities have `wikiEntryId: null`, so they show up nowhere in the Acervo view. This gives them a home and a linking action.

**Files:**
- Create: `frontend/src/pages/enciclopedia/ReconciliacaoPanel.tsx`
- Create: `frontend/src/pages/enciclopedia/ReconciliacaoPanel.test.tsx`
- Modify: `frontend/src/pages/enciclopedia/AcervoTab.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/enciclopedia/ReconciliacaoPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReconciliacaoPanel, suggestMatch } from "./ReconciliacaoPanel";
import type { WikiEntry } from "@ravenloft/content";

const entries: WikiEntry[] = [
  { entryId: "w1", section: "cidades", title: "Khar-Durak", body: "", order: 0, updatedAt: "" },
  { entryId: "w2", section: "casas", title: "Ordem do Sino", body: "", order: 0, updatedAt: "" },
];

describe("suggestMatch", () => {
  it("matches on an exact title", () => {
    expect(suggestMatch("Khar-Durak", entries)?.entryId).toBe("w1");
  });

  it("ignores case and accents", () => {
    expect(suggestMatch("ordem do sino", entries)?.entryId).toBe("w2");
  });

  it("returns null when nothing is close", () => {
    expect(suggestMatch("Mapa Oficial de Valdren", entries)).toBeNull();
  });
});

describe("ReconciliacaoPanel", () => {
  it("lists unlinked entities with their suggested entry", () => {
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e1", canonicalName: "Khar-Durak" }]}
        entries={entries}
        onLink={vi.fn()}
      />,
    );
    expect(screen.getByText("Khar-Durak")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vincular a Khar-Durak" })).toBeInTheDocument();
  });

  it("links an entity to its suggested entry", async () => {
    const onLink = vi.fn();
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e1", canonicalName: "Khar-Durak" }]}
        entries={entries}
        onLink={onLink}
      />,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Vincular a Khar-Durak" }));
    });
    expect(onLink).toHaveBeenCalledWith("e1", "w1");
  });

  it("says so when there is no suggestion", () => {
    render(
      <ReconciliacaoPanel
        unlinked={[{ id: "e2", canonicalName: "Mapa Oficial de Valdren" }]}
        entries={entries}
        onLink={vi.fn()}
      />,
    );
    expect(screen.getByText("Sem verbete correspondente")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/ReconciliacaoPanel.test.tsx`
Expected: FAIL — cannot resolve `./ReconciliacaoPanel`.

- [ ] **Step 3: Implement the panel**

Create `frontend/src/pages/enciclopedia/ReconciliacaoPanel.tsx`:

```tsx
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { WikiEntry } from "@ravenloft/content";

function normalise(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Exact title match after case- and accent-folding. Deliberately strict: a wrong
 *  auto-link is worse than no link, since the author confirms each one anyway. */
export function suggestMatch(name: string, entries: WikiEntry[]): WikiEntry | null {
  const target = normalise(name);
  return entries.find((e) => normalise(e.title) === target) ?? null;
}

interface ReconciliacaoPanelProps {
  unlinked: { id: string; canonicalName: string }[];
  entries: WikiEntry[];
  onLink: (entityId: string, wikiEntryId: string) => void;
}

export function ReconciliacaoPanel({ unlinked, entries, onLink }: ReconciliacaoPanelProps) {
  if (unlinked.length === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2">Entidades sem verbete</Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {unlinked.map((e) => {
          const match = suggestMatch(e.canonicalName, entries);
          return (
            <Box key={e.id} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{e.canonicalName}</Typography>
              {match ? (
                <Button size="small" onClick={() => onLink(e.id, match.entryId)}>
                  {`Vincular a ${match.title}`}
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Sem verbete correspondente
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/ReconciliacaoPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it in the Acervo tab**

In `frontend/src/pages/enciclopedia/AcervoTab.tsx`, add the import:

```tsx
import { ReconciliacaoPanel } from "./ReconciliacaoPanel";
```

Add a link handler next to `save`:

```tsx
  const link = useCallback(
    async (entityId: string, wikiEntryId: string) => {
      const token = loadAdminToken();
      if (!token) return;
      const updated = await api.updateVisualEntity(token, entityId, { wikiEntryId });
      setEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    },
    [api],
  );
```

Render it below the `<List>`, admin-only:

```tsx
      {isAdmin && (
        <ReconciliacaoPanel
          unlinked={entities.filter((e) => !e.wikiEntryId).map((e) => ({ id: e.id, canonicalName: e.canonicalName }))}
          entries={entries}
          onLink={(entityId, wikiEntryId) => void link(entityId, wikiEntryId)}
        />
      )}
```

- [ ] **Step 6: Run every suite and typecheck**

Run: `cd /Users/jessicarosa/turnbasedrpg && npm test`
Expected: shared, backend, and frontend all pass.

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/enciclopedia/
git commit -m "feat: link seeded visual entities to their lore entries"
```

---

## Deferred to Phase 2

Per the spec, these are deliberately not in this plan: entity resolution from request text, the pre-flight lore check, multi-entity context assembly, discovery extraction on canonize, and lore write-back. Scene threads and map region crops remain out of scope entirely.

The `EntidadesTab` remains as a flat entity list alongside the new `Acervo` tab. Once the Acervo view proves out, folding `EntidadesTab` into the *Entidades sem verbete* section of the Acervo is a small follow-up — kept separate here so this plan stays reversible.
