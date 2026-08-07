# Enciclopédia Visual — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public Visual Encyclopedia web UI (`/enciclopedia`) with Galeria, Entidades and an admin-only Estúdio (live generation via polling), consuming the already-live `/api/visual/*` backend, and deploy it to Amplify.

**Architecture:** New React page under `frontend/src/pages/enciclopedia/` with a tabbed layout. All network access goes through the existing `ApiClient` interface (`HttpApiClient` for prod, `MockApiClient` for tests). Domain types are imported from `@ravenloft/content` (`shared/src/visual/models.ts`). A `useGenerationPolling` hook drives the Estúdio's live status updates.

**Tech Stack:** React 18, Vite, MUI, react-router-dom, Vitest + @testing-library/react. Backend API base for prod: `https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com`.

---

## File Structure

- `frontend/src/api/client.ts` — MODIFY: add 7 visual methods to `ApiClient` interface.
- `frontend/src/api/httpClient.ts` — MODIFY: implement the 7 methods against `/api/visual/*`.
- `frontend/src/api/mockClient.ts` — MODIFY: implement the 7 methods with in-memory fixtures; generation advances RUNNING→COMPLETED across polls.
- `frontend/src/api/httpClient.test.ts` — MODIFY: add cases for the 7 methods.
- `frontend/src/pages/enciclopedia/useGenerationPolling.ts` — CREATE: polling hook.
- `frontend/src/pages/enciclopedia/useGenerationPolling.test.tsx` — CREATE: hook test.
- `frontend/src/pages/enciclopedia/GaleriaTab.tsx` — CREATE.
- `frontend/src/pages/enciclopedia/EntidadesTab.tsx` — CREATE.
- `frontend/src/pages/enciclopedia/EstudioTab.tsx` — CREATE.
- `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx` — CREATE: tabbed shell.
- `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx` — CREATE: page tests.
- `frontend/src/App.tsx` — MODIFY: add `/enciclopedia` route.
- `frontend/src/components/Layout.tsx` — MODIFY: add nav link (desktop + drawer).
- `frontend/.env.production` — CREATE/VERIFY: `VITE_API_BASE_URL`.

**Domain types** (import type-only from `@ravenloft/content`): `VisualAsset`, `VisualEntity`, `VisualGeneration`, `GenerationStatus`, `CanonicalLevel`.

---

### Task 1: API layer — visual methods

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/httpClient.ts`
- Modify: `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/httpClient.test.ts`

- [ ] **Step 1: Add methods to the `ApiClient` interface**

In `frontend/src/api/client.ts`, add to the top-level type import from `@ravenloft/content` (the existing line `import type { TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft } from "@ravenloft/content";`) the visual types, making it:

```ts
import type {
  TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft,
  VisualAsset, VisualEntity, VisualGeneration,
} from "@ravenloft/content";
```

Then add these input/return types and methods. Put the interface below near the other `export interface`/`export type` lines at the top of the file (after `export type TurnImageKind`):

```ts
export interface VisualGenerateInput {
  requestText: string;
  entityId?: string | null;
}

export interface VisualContextPreview {
  operation: "GENERATE" | "EDIT";
  referenceCount: number;
  warnings: string[];
}

export interface VisualGenerationCreated {
  generationId: string;
  status: VisualGeneration["status"];
}
```

Inside `export interface ApiClient { ... }`, add (right after `getGallery` for grouping):

```ts
  getVisualGallery(): Promise<VisualAsset[]>;
  listVisualEntities(): Promise<VisualEntity[]>;
  getVisualEntity(id: string): Promise<VisualEntity>;
  getVisualEntityAssets(id: string): Promise<VisualAsset[]>;
  previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview>;
  createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated>;
  getVisualGeneration(id: string): Promise<VisualGeneration>;
```

- [ ] **Step 2: Write failing HttpApiClient tests**

In `frontend/src/api/httpClient.test.ts`, first check the existing test helper for how `fetch` is mocked (open the file top). Then add a describe block. Use the same fetch-mock helper the file already uses. If the file uses `vi.stubGlobal("fetch", ...)` or a `mockFetch` helper, mirror it. Example block (adapt the mock helper name to the file's existing pattern):

```ts
describe("HttpApiClient visual", () => {
  it("getVisualGallery unwraps entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ entries: [{ id: "a1" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient("https://api.test");
    const res = await client.getVisualGallery();
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/visual/gallery", expect.objectContaining({ method: "GET" }));
    expect(res).toEqual([{ id: "a1" }]);
  });

  it("createVisualGeneration posts requestText and entityId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ generationId: "g1", status: "PENDING" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient("https://api.test");
    const res = await client.createVisualGeneration({ requestText: "castelo", entityId: "e1" });
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.test/api/visual/generations");
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toEqual({ requestText: "castelo", entityId: "e1" });
    expect(res).toEqual({ generationId: "g1", status: "PENDING" });
  });

  it("getVisualGeneration fetches by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "g1", status: "COMPLETED", outputAssetIds: ["a1"] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient("https://api.test");
    const res = await client.getVisualGeneration("g1");
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/visual/generations/g1", expect.objectContaining({ method: "GET" }));
    expect(res.status).toBe("COMPLETED");
  });
});
```

Note: if the file already imports `vi` and `HttpApiClient`, don't re-import. If it uses a different fetch-mock approach, replace `vi.stubGlobal("fetch", ...)` with that helper but keep the assertions.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts`
Expected: FAIL — `getVisualGallery`/`createVisualGeneration`/`getVisualGeneration` not a function.

- [ ] **Step 4: Implement in HttpApiClient**

In `frontend/src/api/httpClient.ts`, add visual types to the `@ravenloft/content` import line:

```ts
import type { TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft, VisualAsset, VisualEntity, VisualGeneration } from "@ravenloft/content";
import type { VisualContextPreview, VisualGenerateInput, VisualGenerationCreated } from "./client";
```

Add these methods inside the `HttpApiClient` class (place after `getGallery`):

```ts
  async getVisualGallery(): Promise<VisualAsset[]> {
    const res = await this.request<{ entries: VisualAsset[] }>("/api/visual/gallery");
    return res.entries;
  }

  async listVisualEntities(): Promise<VisualEntity[]> {
    const res = await this.request<{ entries: VisualEntity[] }>("/api/visual/entities");
    return res.entries;
  }

  async getVisualEntity(id: string): Promise<VisualEntity> {
    return this.request<VisualEntity>(`/api/visual/entities/${encodeURIComponent(id)}`);
  }

  async getVisualEntityAssets(id: string): Promise<VisualAsset[]> {
    const res = await this.request<{ entries: VisualAsset[] }>(`/api/visual/entities/${encodeURIComponent(id)}/assets`);
    return res.entries;
  }

  async previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview> {
    return this.request<VisualContextPreview>("/api/visual/context/preview", { method: "POST", body: input });
  }

  async createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated> {
    return this.request<VisualGenerationCreated>("/api/visual/generations", { method: "POST", body: input });
  }

  async getVisualGeneration(id: string): Promise<VisualGeneration> {
    return this.request<VisualGeneration>(`/api/visual/generations/${encodeURIComponent(id)}`);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement in MockApiClient with fixtures**

In `frontend/src/api/mockClient.ts`, add visual imports to the `@ravenloft/content` import (find the existing content import and extend it) — add `VisualAsset, VisualEntity, VisualGeneration`. Also import the client input types:

```ts
import type { VisualContextPreview, VisualGenerateInput, VisualGenerationCreated } from "./client";
```

Add private fixture state as class fields (near other private fields in `MockApiClient`):

```ts
  private visualEntities: VisualEntity[] = [
    {
      id: "e1", campaignId: "winter-dead", entityType: "CHARACTER",
      canonicalName: "Príncipe Alic Valerius", aliases: [], slug: "alic-valerius",
      publicDescription: "O jovem herdeiro de Valdren.", immutableTraits: [], flexibleTraits: [],
      prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "",
      culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
      status: "CANONICAL", canonicalAssetIds: ["a1"], supportingAssetIds: [], referenceSheetAssetId: null,
      mapAssetId: null, version: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "e2", campaignId: "winter-dead", entityType: "LOCATION",
      canonicalName: "Khar-Durak", aliases: [], slug: "khar-durak",
      publicDescription: "A Cidade da Montanha Viva.", immutableTraits: [], flexibleTraits: [],
      prohibitedChanges: [], visualKeywords: [], negativeInstructions: [], scaleDescription: "",
      culturalContext: "", houseId: null, regionId: null, parentEntityId: null, relatedEntityIds: [],
      status: "CANONICAL", canonicalAssetIds: ["a2"], supportingAssetIds: [], referenceSheetAssetId: null,
      mapAssetId: null, version: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  private visualAssets: VisualAsset[] = [
    {
      id: "a1", campaignId: "winter-dead", entityId: "e1", storageKey: "k1",
      storageUrl: "https://img.test/alic.png", thumbnailStorageKey: null, thumbnailUrl: null,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c1",
      status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
      generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
      description: "Retrato do Príncipe Alic.", extractedVisualDescription: "", consistencyScore: null,
      consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a2", campaignId: "winter-dead", entityId: "e2", storageKey: "k2",
      storageUrl: "https://img.test/khar.png", thumbnailStorageKey: null, thumbnailUrl: null,
      mimeType: "image/png", width: 1536, height: 1024, aspectRatio: "3:2", checksum: "c2",
      status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: 1,
      generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "",
      description: "Vista de Khar-Durak.", extractedVisualDescription: "", consistencyScore: null,
      consistencyReport: null, tags: [], createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  private visualGenerations = new Map<string, VisualGeneration>();
  private visualPollCounts = new Map<string, number>();
```

Add the methods (place after the mock `getGallery`):

```ts
  async getVisualGallery(): Promise<VisualAsset[]> {
    return this.visualAssets.filter((a) => a.canonicalLevel === "CANONICAL" || a.canonicalLevel === "LOCKED");
  }

  async listVisualEntities(): Promise<VisualEntity[]> {
    return [...this.visualEntities];
  }

  async getVisualEntity(id: string): Promise<VisualEntity> {
    const e = this.visualEntities.find((x) => x.id === id);
    if (!e) throw new ApiError("NOT_FOUND", "Entidade não encontrada.");
    return e;
  }

  async getVisualEntityAssets(id: string): Promise<VisualAsset[]> {
    return this.visualAssets.filter((a) => a.entityId === id);
  }

  async previewVisualContext(input: { entityId?: string | null }): Promise<VisualContextPreview> {
    const has = !!input.entityId && this.visualAssets.some((a) => a.entityId === input.entityId);
    return {
      operation: has ? "EDIT" : "GENERATE",
      referenceCount: has ? 2 : 1,
      warnings: has ? ["Esta geração continua a identidade canônica existente."] : [],
    };
  }

  async createVisualGeneration(input: VisualGenerateInput): Promise<VisualGenerationCreated> {
    const id = `g-${this.visualGenerations.size + 1}`;
    const gen: VisualGeneration = {
      id, campaignId: "winter-dead", requestedBy: "mock", requestText: input.requestText,
      entityId: input.entityId ?? null, compiledPrompt: "", operationType: "GENERATE", model: "gpt-image-1",
      inputFidelity: "high", size: "1536x1024", quality: "medium", styleBibleVersion: 1, entityVersions: {},
      referenceAssetIds: [], sceneThreadId: null, outputAssetIds: [], status: "RUNNING", retryCount: 0,
      usage: null, estimatedCost: null, latencyMs: null, consistencyReport: null, error: null,
      createdAt: new Date().toISOString(), completedAt: null,
    };
    this.visualGenerations.set(id, gen);
    this.visualPollCounts.set(id, 0);
    return { generationId: id, status: gen.status };
  }

  async getVisualGeneration(id: string): Promise<VisualGeneration> {
    const gen = this.visualGenerations.get(id);
    if (!gen) throw new ApiError("NOT_FOUND", "Geração não encontrada.");
    const polls = (this.visualPollCounts.get(id) ?? 0) + 1;
    this.visualPollCounts.set(id, polls);
    if (polls >= 2 && gen.status === "RUNNING") {
      const newAsset: VisualAsset = {
        ...this.visualAssets[0], id: `gen-${id}`, entityId: gen.entityId,
        storageUrl: "https://img.test/generated.png", canonicalLevel: "DRAFT",
        description: "Imagem gerada.", generationId: id, consistencyScore: 75,
      };
      this.visualAssets = [...this.visualAssets, newAsset];
      const done: VisualGeneration = { ...gen, status: "COMPLETED", outputAssetIds: [newAsset.id], completedAt: new Date().toISOString() };
      this.visualGenerations.set(id, done);
      return done;
    }
    return gen;
  }
```

Confirm `ApiError` is already imported in `mockClient.ts` (it is used elsewhere); if not, import it from `../types/api`.

- [ ] **Step 7: Typecheck + full frontend test run**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (no new type errors; all tests green).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/httpClient.test.ts
git commit -m "feat(enciclopedia): visual API client methods (http + mock)"
```

---

### Task 2: `useGenerationPolling` hook

**Files:**
- Create: `frontend/src/pages/enciclopedia/useGenerationPolling.ts`
- Test: `frontend/src/pages/enciclopedia/useGenerationPolling.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { useGenerationPolling } from "./useGenerationPolling";
import type { ReactNode } from "react";

function wrapper(client: MockApiClient) {
  return ({ children }: { children: ReactNode }) => <ApiProvider client={client}>{children}</ApiProvider>;
}

describe("useGenerationPolling", () => {
  it("polls until the generation completes", async () => {
    const client = new MockApiClient();
    const { generationId } = await client.createVisualGeneration({ requestText: "x", entityId: "e1" });
    const { result } = renderHook(() => useGenerationPolling(generationId, 10), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.generation?.status).toBe("COMPLETED"), { timeout: 2000 });
    expect(result.current.generation?.outputAssetIds.length).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it("is idle when generationId is null", async () => {
    const client = new MockApiClient();
    const { result } = renderHook(() => useGenerationPolling(null, 10), { wrapper: wrapper(client) });
    await act(async () => {});
    expect(result.current.generation).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/useGenerationPolling.test.tsx`
Expected: FAIL — cannot find module `./useGenerationPolling`.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/pages/enciclopedia/useGenerationPolling.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api/ApiProvider";
import type { VisualGeneration } from "@ravenloft/content";

const TERMINAL: VisualGeneration["status"][] = ["COMPLETED", "NEEDS_REVIEW", "FAILED"];
const TIMEOUT_MS = 5 * 60 * 1000;

export interface GenerationPollingState {
  generation: VisualGeneration | null;
  loading: boolean;
  error: string | null;
}

export function useGenerationPolling(generationId: string | null, intervalMs = 3000): GenerationPollingState {
  const api = useApi();
  const [generation, setGeneration] = useState<VisualGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!generationId) {
      setGeneration(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError(null);
    setGeneration(null);
    startRef.current = Date.now();

    const tick = async () => {
      try {
        const gen = await api.getVisualGeneration(generationId);
        if (cancelled) return;
        setGeneration(gen);
        if (TERMINAL.includes(gen.status)) {
          setLoading(false);
          return;
        }
        if (Date.now() - startRef.current > TIMEOUT_MS) {
          setError("A geração está demorando mais que o esperado. Recarregue para verificar.");
          setLoading(false);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Falha ao consultar a geração.");
        setLoading(false);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, generationId, intervalMs]);

  return { generation, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/useGenerationPolling.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/enciclopedia/useGenerationPolling.ts frontend/src/pages/enciclopedia/useGenerationPolling.test.tsx
git commit -m "feat(enciclopedia): generation polling hook"
```

---

### Task 3: `GaleriaTab`

**Files:**
- Create: `frontend/src/pages/enciclopedia/GaleriaTab.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/pages/enciclopedia/GaleriaTab.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../../components/LoadingState";
import type { VisualAsset } from "@ravenloft/content";

export function GaleriaTab() {
  const api = useApi();
  const [assets, setAssets] = useState<VisualAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisualAsset | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssets(await api.getVisualGallery());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a galeria.");
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>{error}</Alert>;
  if (!assets) return <LoadingState />;
  if (assets.length === 0) return <Typography>Nenhuma imagem canônica ainda.</Typography>;

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
        {assets.map((a) => (
          <Card key={a.id}>
            <CardActionArea onClick={() => setSelected(a)}>
              <CardMedia component="img" image={a.thumbnailUrl ?? a.storageUrl} alt={a.description} sx={{ aspectRatio: "3/2", objectFit: "cover" }} />
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="lg">
        {selected && (
          <Box sx={{ p: 2 }}>
            <Box component="img" src={selected.storageUrl} alt={selected.description} sx={{ maxWidth: "100%", display: "block" }} />
            <Typography sx={{ mt: 1 }}>{selected.description}</Typography>
          </Box>
        )}
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/enciclopedia/GaleriaTab.tsx
git commit -m "feat(enciclopedia): galeria tab"
```

---

### Task 4: `EntidadesTab`

**Files:**
- Create: `frontend/src/pages/enciclopedia/EntidadesTab.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/pages/enciclopedia/EntidadesTab.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { LoadingState } from "../../components/LoadingState";
import type { VisualAsset, VisualEntity } from "@ravenloft/content";

export function EntidadesTab() {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisualEntity | null>(null);
  const [assets, setAssets] = useState<VisualAsset[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntities(await api.listVisualEntities());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar entidades.");
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const open = useCallback(async (entity: VisualEntity) => {
    setSelected(entity);
    setAssets([]);
    try {
      setAssets(await api.getVisualEntityAssets(entity.id));
    } catch {
      setAssets([]);
    }
  }, [api]);

  if (error) return <Alert severity="error" action={<Button onClick={() => void load()}>Tentar novamente</Button>}>{error}</Alert>;
  if (!entities) return <LoadingState />;
  if (entities.length === 0) return <Typography>Nenhuma entidade cadastrada ainda.</Typography>;

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        {entities.map((e) => (
          <Card key={e.id}>
            <CardActionArea onClick={() => void open(e)}>
              <CardContent>
                <Typography variant="h6">{e.canonicalName}</Typography>
                <Typography variant="body2" color="text.secondary">{e.publicDescription}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.canonicalName}</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>{selected.publicDescription}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {assets.map((a) => (
                  <Card key={a.id}>
                    <CardMedia component="img" image={a.thumbnailUrl ?? a.storageUrl} alt={a.description} sx={{ aspectRatio: "3/2", objectFit: "cover" }} />
                  </Card>
                ))}
              </Box>
              {assets.length === 0 && <Typography color="text.secondary">Sem imagens para esta entidade.</Typography>}
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/enciclopedia/EntidadesTab.tsx
git commit -m "feat(enciclopedia): entidades tab"
```

---

### Task 5: `EstudioTab` (admin-only generation)

**Files:**
- Create: `frontend/src/pages/enciclopedia/EstudioTab.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/pages/enciclopedia/EstudioTab.tsx`. It receives entities + a resolver to display the generated asset. Design note (per spec): entity selection is required so the output asset URL can be resolved via `getVisualEntityAssets`.

```tsx
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { useGenerationPolling } from "./useGenerationPolling";
import type { VisualAsset, VisualContextPreview, VisualEntity } from "@ravenloft/content";
import type { VisualContextPreview as PreviewType } from "../../api/client";

export function EstudioTab() {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [entityId, setEntityId] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [preview, setPreview] = useState<PreviewType | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultAsset, setResultAsset] = useState<VisualAsset | null>(null);

  const { generation, loading, error: pollError } = useGenerationPolling(genId);

  useEffect(() => {
    void api.listVisualEntities().then(setEntities).catch(() => setEntities([]));
  }, [api]);

  useEffect(() => {
    if (!entityId) { setPreview(null); return; }
    let active = true;
    void api.previewVisualContext({ entityId }).then((p) => { if (active) setPreview(p); }).catch(() => {});
    return () => { active = false; };
  }, [api, entityId]);

  useEffect(() => {
    if (generation?.status === "COMPLETED" || generation?.status === "NEEDS_REVIEW") {
      const assetId = generation.outputAssetIds[0];
      if (assetId && generation.entityId) {
        void api.getVisualEntityAssets(generation.entityId).then((assets) => {
          setResultAsset(assets.find((a) => a.id === assetId) ?? null);
        }).catch(() => {});
      }
    }
  }, [api, generation]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setResultAsset(null);
    try {
      const { generationId } = await api.createVisualGeneration({ requestText, entityId });
      setGenId(generationId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
    }
  }, [api, requestText, entityId]);

  const canSubmit = requestText.trim().length > 0 && entityId !== "" && !loading;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="body2" color="text.secondary">
        Gere uma nova imagem para uma entidade canônica. A seleção de entidade é obrigatória.
      </Typography>
      <TextField
        select label="Entidade" value={entityId}
        onChange={(e) => setEntityId(e.target.value)} fullWidth
      >
        {entities.map((e) => <MenuItem key={e.id} value={e.id}>{e.canonicalName}</MenuItem>)}
      </TextField>
      <TextField
        label="Pedido (prompt)" value={requestText} onChange={(e) => setRequestText(e.target.value)}
        multiline minRows={3} fullWidth
      />
      {preview && (
        <Alert severity="info">
          Operação: {preview.operation} · Referências: {preview.referenceCount}
          {preview.warnings.map((w) => <div key={w}>{w}</div>)}
        </Alert>
      )}
      <Box>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {loading ? "Gerando…" : "Gerar"}
        </Button>
      </Box>
      {submitError && <Alert severity="error">{submitError}</Alert>}
      {pollError && <Alert severity="warning">{pollError}</Alert>}
      {loading && <Typography color="text.secondary">Status: {generation?.status ?? "iniciando"}… isso pode levar 1–2 minutos.</Typography>}
      {generation?.status === "FAILED" && <Alert severity="error">{generation.error ?? "Falha ao gerar a imagem."}</Alert>}
      {resultAsset && (
        <Box>
          <Box component="img" src={resultAsset.storageUrl} alt={resultAsset.description} sx={{ maxWidth: "100%", display: "block" }} />
          <Typography sx={{ mt: 1 }}>
            {generation?.status === "NEEDS_REVIEW" ? "Precisa de revisão · " : ""}
            Score de consistência: {resultAsset.consistencyScore ?? "—"}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
```

Note: remove the unused `VisualContextPreview` import from `@ravenloft/content` if tsc flags it — the type used is `PreviewType` from `../../api/client`. Keep only the imports that are actually referenced.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS. If unused-import errors appear, delete the unused import lines and re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/enciclopedia/EstudioTab.tsx
git commit -m "feat(enciclopedia): estudio tab (admin generation + polling)"
```

---

### Task 6: `EnciclopediaPage` + route + nav + tests

**Files:**
- Create: `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx`
- Create: `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Implement the page (tabbed shell, admin gating)**

Create `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx`:

```tsx
import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { Layout } from "../../components/Layout";
import { loadAdminToken } from "../../auth/adminSession";
import { GaleriaTab } from "./GaleriaTab";
import { EntidadesTab } from "./EntidadesTab";
import { EstudioTab } from "./EstudioTab";

export function EnciclopediaPage() {
  const isAdmin = !!loadAdminToken();
  const [tab, setTab] = useState(0);

  return (
    <Layout>
      <Typography variant="h4" sx={{ mb: 2 }}>Enciclopédia Visual</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Galeria" />
        <Tab label="Entidades" />
        {isAdmin && <Tab label="Estúdio" />}
      </Tabs>
      <Box hidden={tab !== 0}>{tab === 0 && <GaleriaTab />}</Box>
      <Box hidden={tab !== 1}>{tab === 1 && <EntidadesTab />}</Box>
      {isAdmin && <Box hidden={tab !== 2}>{tab === 2 && <EstudioTab />}</Box>}
    </Layout>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, add the import near the other page imports:

```ts
import { EnciclopediaPage } from "./pages/enciclopedia/EnciclopediaPage";
```

And add the route inside `<Routes>` (after the `/galeria` route):

```tsx
      <Route path="/enciclopedia" element={<EnciclopediaPage />} />
```

- [ ] **Step 3: Add nav links**

In `frontend/src/components/Layout.tsx`, add a desktop button right after the existing Galeria `Button` (around line 64-66):

```tsx
          <Button component={RouterLink} to="/enciclopedia" color="inherit" size="small">
            Enciclopédia
          </Button>
```

And add a drawer item right after the Galeria `ListItemButton` (around line 88-90):

```tsx
              <ListItemButton component={RouterLink} to="/enciclopedia" onClick={close}>
                <ListItemText primary="Enciclopédia" />
              </ListItemButton>
```

- [ ] **Step 4: Write the page tests**

Create `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EnciclopediaPage } from "./EnciclopediaPage";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

async function setup(client: MockApiClient) {
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <EnciclopediaPage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });
}

describe("EnciclopediaPage", () => {
  afterEach(() => clearAdminToken());

  it("renders the galeria with canonical images", async () => {
    await setup(new MockApiClient());
    await waitFor(() => {
      const imgs = screen.getAllByRole("img");
      expect(imgs.length).toBeGreaterThan(0);
    });
  });

  it("shows entidades when the tab is selected", async () => {
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Entidades" })); });
    expect(await screen.findByText("Príncipe Alic Valerius")).toBeInTheDocument();
  });

  it("hides Estúdio tab without admin token", async () => {
    clearAdminToken();
    await setup(new MockApiClient());
    expect(screen.queryByRole("tab", { name: "Estúdio" })).not.toBeInTheDocument();
  });

  it("shows Estúdio tab with admin token", async () => {
    saveAdminToken("admin-test-token");
    await setup(new MockApiClient());
    expect(screen.getByRole("tab", { name: "Estúdio" })).toBeInTheDocument();
  });

  it("runs a generation to completion in the estudio", async () => {
    saveAdminToken("admin-test-token");
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Estúdio" })); });

    await act(async () => {
      await userEvent.click(await screen.findByLabelText("Entidade"));
    });
    await act(async () => {
      await userEvent.click(await screen.findByRole("option", { name: "Príncipe Alic Valerius" }));
    });
    await act(async () => {
      await userEvent.type(screen.getByLabelText("Pedido (prompt)"), "retrato heróico");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
    });

    await waitFor(() => expect(screen.getByText(/Score de consistência/)).toBeInTheDocument(), { timeout: 3000 });
  });
});
```

- [ ] **Step 5: Verify saveAdminToken/clearAdminToken exports**

Run: `grep -n "export function" frontend/src/auth/adminSession.ts`
Expected: shows `saveAdminToken`, `loadAdminToken`, `clearAdminToken`. If `clearAdminToken` has a different name, adapt the test import.

- [ ] **Step 6: Run the page tests**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EnciclopediaPage.test.tsx`
Expected: PASS. If the MUI Select interaction (`getByLabelText("Entidade")` → option) doesn't open, replace with clicking the combobox role: `screen.getByRole("combobox")`.

- [ ] **Step 7: Full typecheck + test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS across the frontend suite.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/enciclopedia/EnciclopediaPage.tsx frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(enciclopedia): page shell, route, nav, and tests"
```

---

### Task 7: Build and deploy to Amplify

**Files:**
- Create/verify: `frontend/.env.production`

- [ ] **Step 1: Verify/create the prod API base**

Run: `cat frontend/.env.production 2>/dev/null || echo MISSING`
If MISSING or the value differs, create/set it:

```bash
echo 'VITE_API_BASE_URL=https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com' > frontend/.env.production
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: `dist/` produced, no type errors.

- [ ] **Step 3: Zip the build**

Run:
```bash
cd frontend/dist && zip -r ../enciclopedia-deploy.zip . && cd ..
```
Expected: `frontend/enciclopedia-deploy.zip` created.

- [ ] **Step 4: Create Amplify deployment**

Run:
```bash
aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --region us-east-1
```
Expected: JSON with `jobId` and `zipUploadUrl`. Capture both.

- [ ] **Step 5: Upload the zip**

Run (substitute the actual URL):
```bash
curl -T frontend/enciclopedia-deploy.zip "<zipUploadUrl>"
```
Expected: HTTP 200, no body.

- [ ] **Step 6: Start the deployment**

Run (substitute the actual jobId):
```bash
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id <jobId> --region us-east-1
```
Expected: JSON with `jobSummary.status` = `PENDING`/`RUNNING`.

- [ ] **Step 7: Poll until SUCCEED**

Run (substitute jobId):
```bash
aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id <jobId> --region us-east-1 --query 'job.summary.status'
```
Repeat until `"SUCCEED"`.

- [ ] **Step 8: Verify live**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://main.d1emmrcvmpw55g.amplifyapp.com/enciclopedia
```
Expected: `200`. Then manually confirm in a browser: Galeria shows the 10 canonical images, Entidades are navigable, and (after admin login) the Estúdio tab appears.

- [ ] **Step 9: Clean up + commit env**

```bash
rm -f frontend/enciclopedia-deploy.zip
git add frontend/.env.production
git commit -m "chore(enciclopedia): prod API base for frontend build"
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** Galeria (Task 3), Entidades (Task 4), Estúdio admin-gated + polling (Tasks 2,5,6), API layer (Task 1), tests (Tasks 1,2,6), deploy (Task 7). Entity-required generation decision from the spec is enforced in Task 5 (`canSubmit` requires `entityId`).
- **Types:** All components import domain types from `@ravenloft/content`; input/return DTOs (`VisualGenerateInput`, `VisualContextPreview`, `VisualGenerationCreated`) defined once in `client.ts` and reused by http/mock/estudio.
- **Known adaptation points flagged inline:** fetch-mock helper style in httpClient.test.ts, MUI Select interaction in the page test, and possible unused-import cleanup in EstudioTab.
