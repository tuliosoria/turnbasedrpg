# Estúdio Visual — Criação com verificação canônica: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar qualquer visitante criar imagens pela aba Estúdio, com entidade opcional (cânone aplicado e verificado quando escolhida) e canonização restrita a admin.

**Architecture:** Reaproveita o pipeline de geração + verificador de consistência já existentes no backend. Adiciona um único endpoint público (`GET /api/visual/assets/:id`) para resolver a URL de imagens geradas sem entidade. No frontend, adiciona dois métodos ao `ApiClient` e reforma o `EstudioTab` para entidade opcional, veredito de consistência e botão de canonizar (admin). A Galeria recarrega sozinha ao reabrir a aba (remonta), então nenhuma mudança é necessária lá.

**Tech Stack:** TypeScript, React 18 + MUI, Vitest + @testing-library/react (frontend); Node + AWS SDK DynamoDB, Vitest (backend); monorepo shared `@ravenloft/content`.

**Referência da spec:** `docs/superpowers/specs/2026-08-11-visual-studio-canon-creation-design.md`

---

### Task 1: Backend — endpoint `GET /api/visual/assets/:id`

**Files:**
- Modify: `backend/src/routes/visualRoutes.ts` (adicionar handler `getVisualAsset` perto de `canonizeAsset`)
- Modify: `backend/src/router.ts:85-97` (registrar a rota)
- Test: `backend/src/routes/visualRoutes.test.ts`

- [ ] **Step 1: Write the failing tests**

Adicione ao final do bloco `describe("entity and asset routes", ...)` em `backend/src/routes/visualRoutes.test.ts` (dentro do `describe`, antes do `});` de fechamento). Inclua `getVisualAsset` no import existente da linha 46:

```ts
// no import da linha 46, acrescente getVisualAsset:
import { listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible, getVisualAsset } from "./visualRoutes";
```

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts -t "getVisualAsset"`
Expected: FAIL — `getVisualAsset` não existe (erro de import / não é função).

- [ ] **Step 3: Implement the handler**

Em `backend/src/routes/visualRoutes.ts`, adicione logo **após** a função `canonizeAsset` (que termina em `return { status: 200, body: { id: asset.id, canonicalLevel: "CANONICAL" } };`):

```ts
export async function getVisualAsset(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const asset = await getAsset(deps.doc, deps.config.tableName, deps.config.campaignId, req.pathParams.id);
  if (!asset) return { status: 404, body: { code: "NOT_FOUND", message: "Imagem não encontrada." } };
  return { status: 200, body: asset };
}
```

(`getAsset` já está importado na linha 40: `import { listAssets, getAsset, setAssetCanonicalLevel } from "../db/visual/assets";`.)

- [ ] **Step 4: Register the route**

Em `backend/src/router.ts`, no import da linha 7 acrescente `getVisualAsset`:

```ts
import { createGeneration, getGenerationStatus, listVisualEntities, getVisualEntity, listEntityAssets, listGallery, canonizeAsset, lockAsset, unlockAsset, deleteAsset, getStyleBible, previewContext, seedVisual, getVisualAsset } from "./routes/visualRoutes";
```

E adicione a rota logo **antes** de `r("POST", "/api/visual/assets/:id/canonize", canonizeAsset),` (linha 94):

```ts
  r("GET", "/api/visual/assets/:id", getVisualAsset),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: PASS (todos, incluindo os 2 novos).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/visualRoutes.ts backend/src/router.ts backend/src/routes/visualRoutes.test.ts
git commit -m "feat(backend): add GET /api/visual/assets/:id endpoint"
```

---

### Task 2: Frontend — métodos `getVisualAsset` e `canonizeAsset` no ApiClient

**Files:**
- Modify: `frontend/src/api/client.ts` (interface + import de `CanonicalLevel`)
- Modify: `frontend/src/api/httpClient.ts` (implementações HTTP)
- Modify: `frontend/src/api/mockClient.ts` (implementações mock)
- Test: `frontend/src/api/httpClient.test.ts`

- [ ] **Step 1: Write the failing tests**

Em `frontend/src/api/httpClient.test.ts`, adicione dentro do `describe("HttpApiClient visual", ...)` (antes do `});` que fecha esse describe, após o teste `getVisualGeneration fetches by id`):

```ts
    it("getVisualAsset fetches by id", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "a1", storageUrl: "https://img/x.png" }));
      const client = new HttpApiClient("https://api.test");
      const res = await client.getVisualAsset("a1");
      expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/visual/assets/a1", expect.objectContaining({ method: "GET" }));
      expect(res.id).toBe("a1");
    });

    it("canonizeAsset posts to the canonize endpoint", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "a1", canonicalLevel: "CANONICAL" }));
      const client = new HttpApiClient("https://api.test");
      const res = await client.canonizeAsset("a1");
      expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/visual/assets/a1/canonize", expect.objectContaining({ method: "POST" }));
      expect(res.canonicalLevel).toBe("CANONICAL");
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts -t "getVisualAsset|canonizeAsset"`
Expected: FAIL — métodos não existem no tipo/implementação (erro de compilação TS).

- [ ] **Step 3: Add methods to the ApiClient interface**

Em `frontend/src/api/client.ts`, no import de `@ravenloft/content` (linhas 22-25), acrescente `CanonicalLevel`:

```ts
import type {
  TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft,
  VisualAsset, VisualEntity, VisualGeneration, CanonicalLevel,
} from "@ravenloft/content";
```

E na interface `ApiClient`, logo **após** a linha `getVisualGeneration(id: string): Promise<VisualGeneration>;`:

```ts
  getVisualAsset(id: string): Promise<VisualAsset>;
  canonizeAsset(id: string): Promise<{ id: string; canonicalLevel: CanonicalLevel }>;
```

- [ ] **Step 4: Implement in httpClient**

Em `frontend/src/api/httpClient.ts`, no import de `@ravenloft/content` (linhas 30-33) acrescente `CanonicalLevel`:

```ts
import type {
  TurnResult, ProjectCard, Favor, EnhanceCardInput, CustomCardDraft,
  VisualAsset, VisualEntity, VisualGeneration, CanonicalLevel,
} from "@ravenloft/content";
```

E logo **após** o método `getVisualGeneration` (que termina em `return this.request<VisualGeneration>(\`/api/visual/generations/${encodeURIComponent(id)}\`);` + `}`):

```ts
  async getVisualAsset(id: string): Promise<VisualAsset> {
    return this.request<VisualAsset>(`/api/visual/assets/${encodeURIComponent(id)}`);
  }

  async canonizeAsset(id: string): Promise<{ id: string; canonicalLevel: CanonicalLevel }> {
    return this.request<{ id: string; canonicalLevel: CanonicalLevel }>(
      `/api/visual/assets/${encodeURIComponent(id)}/canonize`,
      { method: "POST" },
    );
  }
```

- [ ] **Step 5: Implement in mockClient**

Em `frontend/src/api/mockClient.ts`, no import de `@ravenloft/content` (perto das linhas 29-31) acrescente `CanonicalLevel`:

```ts
  type VisualAsset,
  type VisualEntity,
  type VisualGeneration,
  type CanonicalLevel,
```

E logo **após** o método `getVisualGeneration` (que termina no `}` depois de `return gen;`):

```ts
  async getVisualAsset(id: string): Promise<VisualAsset> {
    const asset = this.visualAssets.find((a) => a.id === id);
    if (!asset) throw new ApiError("NOT_FOUND", "Imagem não encontrada.");
    return asset;
  }

  async canonizeAsset(id: string): Promise<{ id: string; canonicalLevel: CanonicalLevel }> {
    const idx = this.visualAssets.findIndex((a) => a.id === id);
    if (idx === -1) throw new ApiError("NOT_FOUND", "Imagem não encontrada.");
    const updated: VisualAsset = { ...this.visualAssets[idx], canonicalLevel: "CANONICAL" };
    this.visualAssets = [...this.visualAssets.slice(0, idx), updated, ...this.visualAssets.slice(idx + 1)];
    return { id, canonicalLevel: "CANONICAL" };
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros. (Se `AdminPage.test.tsx` tiver um duplo inline de `ApiClient`, ver Task 4 Step 8 — mas normalmente o mock/http cobrem a interface.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/httpClient.test.ts
git commit -m "feat(frontend): add getVisualAsset and canonizeAsset client methods"
```

---

### Task 3: EnciclopediaPage — Estúdio sempre visível + passar isAdmin

**Files:**
- Modify: `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx`
- Test: `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx`

- [ ] **Step 1: Update the visibility tests**

Em `frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx`, substitua os dois testes de visibilidade da aba Estúdio (`"hides Estúdio tab without admin token"` e `"shows Estúdio tab with admin token"`) por um único teste que verifica visibilidade sempre:

```ts
  it("shows Estúdio tab even without admin token", async () => {
    clearAdminToken();
    await setup(new MockApiClient());
    expect(screen.getByRole("tab", { name: "Estúdio" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EnciclopediaPage.test.tsx -t "shows Estúdio tab even without admin token"`
Expected: FAIL — hoje a aba é escondida sem admin.

- [ ] **Step 3: Make the Estúdio tab always visible and pass isAdmin**

Substitua o conteúdo de `frontend/src/pages/enciclopedia/EnciclopediaPage.tsx` por:

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
        <Tab label="Estúdio" />
      </Tabs>
      <Box hidden={tab !== 0}>{tab === 0 && <GaleriaTab />}</Box>
      <Box hidden={tab !== 1}>{tab === 1 && <EntidadesTab />}</Box>
      <Box hidden={tab !== 2}>{tab === 2 && <EstudioTab isAdmin={isAdmin} />}</Box>
    </Layout>
  );
}
```

(O `EstudioTab` passa a receber `isAdmin`; a assinatura da prop é criada na Task 4. Se as tasks forem feitas fora de ordem, esse passo pode falhar no `tsc` até a Task 4 existir — isso é esperado; complete a Task 4 em seguida.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EnciclopediaPage.test.tsx -t "shows Estúdio tab even without admin token"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/enciclopedia/EnciclopediaPage.tsx frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx
git commit -m "feat(frontend): make Estúdio tab public and pass isAdmin"
```

---

### Task 4: EstudioTab — entidade opcional, veredito de consistência, canonizar (admin)

**Files:**
- Modify: `frontend/src/pages/enciclopedia/EstudioTab.tsx`
- Test: `frontend/src/pages/enciclopedia/EstudioTab.test.tsx` (novo)
- Modify (se necessário): `frontend/src/pages/AdminPage.test.tsx` (extensão de stub inline do ApiClient)

- [ ] **Step 1: Write the failing test**

Crie `frontend/src/pages/enciclopedia/EstudioTab.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EstudioTab } from "./EstudioTab";
import { clearAdminToken } from "../../auth/adminSession";

async function setup(isAdmin: boolean) {
  const client = new MockApiClient();
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <EstudioTab isAdmin={isAdmin} />
      </ApiProvider>,
    );
  });
  return client;
}

async function generateFreeConcept() {
  await act(async () => {
    await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "um castelo nevado");
  });
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
  });
}

describe("EstudioTab", () => {
  afterEach(() => clearAdminToken());

  it("generates a free concept (no entity) and shows the image", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(
      () => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(),
      { timeout: 8000 },
    );
  });

  it("shows the consistency verdict on completion", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(
      () => expect(screen.getByText(/Passou na verificação de consistência/)).toBeInTheDocument(),
      { timeout: 8000 },
    );
  });

  it("hides the canonize button for non-admins", async () => {
    await setup(false);
    await generateFreeConcept();
    await waitFor(() => expect(screen.getByAltText("Imagem gerada.")).toBeInTheDocument(), { timeout: 8000 });
    expect(screen.queryByRole("button", { name: /cânone/i })).not.toBeInTheDocument();
  });

  it("lets an admin add the image to the canon", async () => {
    await setup(true);
    await generateFreeConcept();
    const btn = await screen.findByRole("button", { name: /Adicionar ao cânone/ }, { timeout: 8000 });
    await act(async () => { await userEvent.click(btn); });
    await waitFor(() => expect(screen.getByText("Adicionada ao cânone.")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EstudioTab.test.tsx`
Expected: FAIL — `EstudioTab` ainda não aceita `isAdmin`, exige entidade (botão Gerar desabilitado sem entidade), e não resolve o asset sem entidade.

- [ ] **Step 3: Rewrite EstudioTab**

Substitua todo o conteúdo de `frontend/src/pages/enciclopedia/EstudioTab.tsx` por:

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
import type { VisualAsset, VisualEntity } from "@ravenloft/content";
import type { VisualContextPreview } from "../../api/client";

const NEW_CONCEPT = "";

interface EstudioTabProps {
  isAdmin: boolean;
}

export function EstudioTab({ isAdmin }: EstudioTabProps) {
  const api = useApi();
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [entityId, setEntityId] = useState<string>(NEW_CONCEPT);
  const [requestText, setRequestText] = useState("");
  const [preview, setPreview] = useState<VisualContextPreview | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultAsset, setResultAsset] = useState<VisualAsset | null>(null);
  const [resolvingAsset, setResolvingAsset] = useState(false);
  const [noAsset, setNoAsset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canonizing, setCanonizing] = useState(false);
  const [canonized, setCanonized] = useState(false);
  const [canonizeError, setCanonizeError] = useState<string | null>(null);

  const { generation, loading, error: pollError } = useGenerationPolling(genId);

  useEffect(() => {
    void api
      .listVisualEntities()
      .then(setEntities)
      .catch(() => setEntities([]));
  }, [api]);

  useEffect(() => {
    if (!entityId) {
      setPreview(null);
      return;
    }
    let active = true;
    void api
      .previewVisualContext({ entityId })
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [api, entityId]);

  useEffect(() => {
    if (generation?.status !== "COMPLETED" && generation?.status !== "NEEDS_REVIEW") return;
    const assetId = generation.outputAssetIds[0];
    if (!assetId) {
      setNoAsset(true);
      return;
    }
    let active = true;
    setResolvingAsset(true);
    setNoAsset(false);
    void api
      .getVisualAsset(assetId)
      .then((asset) => {
        if (!active) return;
        setResultAsset(asset);
      })
      .catch(() => {
        if (active) setNoAsset(true);
      })
      .finally(() => {
        if (active) setResolvingAsset(false);
      });
    return () => {
      active = false;
    };
  }, [api, generation]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setResultAsset(null);
    setNoAsset(false);
    setResolvingAsset(false);
    setCanonized(false);
    setCanonizeError(null);
    setSubmitting(true);
    try {
      const { generationId } = await api.createVisualGeneration({ requestText, entityId: entityId || null });
      setGenId(generationId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
    } finally {
      setSubmitting(false);
    }
  }, [api, requestText, entityId]);

  const canonize = useCallback(async () => {
    if (!resultAsset) return;
    setCanonizeError(null);
    setCanonizing(true);
    try {
      await api.canonizeAsset(resultAsset.id);
      setCanonized(true);
    } catch (e) {
      setCanonizeError(e instanceof Error ? e.message : "Falha ao canonizar.");
    } finally {
      setCanonizing(false);
    }
  }, [api, resultAsset]);

  const canSubmit = requestText.trim().length > 0 && !loading && !submitting;
  const needsReview = generation?.status === "NEEDS_REVIEW";
  const isNewConcept = !generation?.entityId;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Typography variant="body2" color="text.secondary">
        Gere uma nova imagem. Escolha uma entidade para manter o cânone dela (rosto, cores,
        arquitetura) — ou gere um conceito novo sem entidade.
      </Typography>
      <TextField select label="Entidade" value={entityId} onChange={(e) => setEntityId(e.target.value)} fullWidth>
        <MenuItem value={NEW_CONCEPT}>Conceito novo (sem entidade)</MenuItem>
        {entities.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {e.canonicalName}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Pedido (prompt)"
        value={requestText}
        onChange={(e) => setRequestText(e.target.value)}
        multiline
        minRows={3}
        fullWidth
      />
      {preview && (
        <Alert severity="info">
          Operação: {preview.operation} · Referências: {preview.referenceCount}
          {preview.warnings.map((w, i) => (
            <div key={`${i}-${w}`}>{w}</div>
          ))}
        </Alert>
      )}
      <Box>
        <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
          {loading || submitting ? "Gerando…" : "Gerar"}
        </Button>
      </Box>
      {submitError && <Alert severity="error">{submitError}</Alert>}
      {pollError && <Alert severity="warning">{pollError}</Alert>}
      {loading && (
        <Typography color="text.secondary">
          Status: {generation?.status ?? "iniciando"}… isso pode levar 1–2 minutos.
        </Typography>
      )}
      {generation?.status === "FAILED" && (
        <Alert severity="error">{generation.error ?? "Falha ao gerar a imagem."}</Alert>
      )}
      {resolvingAsset && <Typography color="text.secondary">Carregando a imagem gerada…</Typography>}
      {noAsset && !resolvingAsset && (
        <Alert severity="info">A geração foi concluída, mas a imagem não pôde ser exibida. Recarregue a página para verificar.</Alert>
      )}
      {resultAsset && (
        <Box>
          <Box
            component="img"
            src={resultAsset.storageUrl}
            alt={resultAsset.description}
            sx={{ maxWidth: "100%", display: "block" }}
          />
          {needsReview ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Divergência do cânone detectada — revise antes de canonizar.
              {resultAsset.consistencyScore != null ? ` (score ${resultAsset.consistencyScore})` : ""}
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mt: 1 }}>
              Passou na verificação de consistência
              {resultAsset.consistencyScore != null ? ` (score ${resultAsset.consistencyScore})` : ""}.
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Button variant="outlined" href={resultAsset.storageUrl} target="_blank" rel="noopener">
              Baixar
            </Button>
            {isAdmin && !canonized && (
              <Button variant="contained" disabled={canonizing} onClick={() => void canonize()}>
                {canonizing ? "Adicionando…" : isNewConcept ? "Adicionar ao cânone?" : "Adicionar ao cânone"}
              </Button>
            )}
          </Stack>
          {canonized && <Alert severity="success" sx={{ mt: 1 }}>Adicionada ao cânone.</Alert>}
          {canonizeError && <Alert severity="error" sx={{ mt: 1 }}>{canonizeError}</Alert>}
        </Box>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run the new EstudioTab tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EstudioTab.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Update the EnciclopediaPage generation test**

O teste `"runs a generation to completion in the estudio"` em `EnciclopediaPage.test.tsx` selecionava uma entidade e verificava `"Score de consistência: 75"` (texto que não existe mais). Substitua esse teste por:

```ts
  it("runs a free-concept generation to completion in the estudio", async () => {
    await setup(new MockApiClient());
    await act(async () => { await userEvent.click(screen.getByRole("tab", { name: "Estúdio" })); });
    await act(async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pedido (prompt)" }), "retrato heróico");
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gerar" }));
    });
    await waitFor(
      () => expect(screen.getByText(/Passou na verificação de consistência/)).toBeInTheDocument(),
      { timeout: 8000 },
    );
  });
```

- [ ] **Step 6: Run the EnciclopediaPage tests**

Run: `cd frontend && npx vitest run src/pages/enciclopedia/EnciclopediaPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Fix AdminPage.test.tsx stub if tsc fails there**

Se o `tsc` acusar que um objeto `ApiClient` inline em `frontend/src/pages/AdminPage.test.tsx` não implementa `getVisualAsset`/`canonizeAsset`, adicione ao stub as duas funções:

```ts
      getVisualAsset: async () => ({}) as any,
      canonizeAsset: async () => ({ id: "x", canonicalLevel: "CANONICAL" }) as any,
```

(Só faça este passo se o `tsc` reclamar; caso contrário, pule.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/enciclopedia/EstudioTab.tsx frontend/src/pages/enciclopedia/EstudioTab.test.tsx frontend/src/pages/enciclopedia/EnciclopediaPage.test.tsx
git commit -m "feat(frontend): entity-optional Estúdio with consistency verdict and admin canonize"
```

---

### Task 5: Verificação final (suite + build)

**Files:** nenhum (validação).

- [ ] **Step 1: Run the affected backend tests**

Run: `cd backend && npx vitest run src/routes/visualRoutes.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the affected frontend tests**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts src/pages/enciclopedia/`
Expected: PASS.

- [ ] **Step 3: Typecheck frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Production build**

Run: `cd frontend && npm run build`
Expected: build conclui gerando `dist/index.html` + bundle JS.

- [ ] **Step 5: Commit (se houve algum ajuste)**

```bash
git add -A
git commit -m "chore: verify canon-aware Estúdio slice" || echo "nada a commitar"
```

---

## Notas de integração

- **Galeria recarrega sozinha:** em `EnciclopediaPage.tsx`, `GaleriaTab` só é montado quando `tab === 0` (`{tab === 0 && <GaleriaTab />}`). Ao voltar para a aba Galeria após canonizar no Estúdio, o componente remonta e chama `getVisualGallery` de novo — a imagem canonizada aparece sem código extra.
- **Gating de canonização é só na UI** (limitação conhecida da spec): o endpoint de canonize continua público no backend. Proteção real fica para fatia futura.
- **Deploy:** após merge em `main`, seguir o fluxo manual de zip no Amplify (app-id `d1emmrcvmpw55g`, branch `main`) já documentado no plano anterior, se o usuário pedir para publicar.
