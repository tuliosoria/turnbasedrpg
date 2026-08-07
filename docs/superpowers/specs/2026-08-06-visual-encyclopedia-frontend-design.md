# Enciclopédia Visual — Frontend (Plano 1B)

**Data:** 2026-08-06
**Status:** Aprovado
**Backend relacionado:** `docs/superpowers/specs/2026-08-06-visual-encyclopedia-design.md` (Phase 1, já em produção)

## Objetivo

Construir a interface web da Enciclopédia Visual da campanha "O Inverno dos Mortos" e
publicá-la em `https://main.d1emmrcvmpw55g.amplifyapp.com/`. A UI consome a API visual
pública já em produção (`/api/visual/*`) e expõe:

1. **Galeria** (pública) das imagens canônicas.
2. **Entidades** (pública): as 10 entidades canônicas com descrição e seus assets.
3. **Estúdio** (somente admin logado): geração de novas imagens com prompt, preview de
   contexto e acompanhamento ao vivo (polling) até concluir.

## Restrições e decisões

- **Galeria e Entidades são públicas.** O **Estúdio** só aparece/funciona quando há
  `adminToken` salvo (mesmo mecanismo do `AdminPage`, via `frontend/src/auth/adminSession.ts`).
- Seguir os padrões existentes do frontend: React + Vite + MUI, interface `ApiClient`
  com implementações `HttpApiClient`/`MockApiClient`, páginas em `frontend/src/pages/`,
  navegação em `frontend/src/components/Layout.tsx`.
- YAGNI: sem canonizar/travar/excluir assets pela UI nesta fase (essas rotas existem no
  backend mas ficam para uma fase futura de curadoria).

## Arquitetura

### Rota e navegação
- Nova rota pública **`/enciclopedia`** em `frontend/src/App.tsx` → `EnciclopediaPage`.
- Link **"Enciclopédia"** em `Layout.tsx` (desktop `Button` + drawer mobile), ao lado de "Galeria".

### Camada de API
Estender a interface `ApiClient` (`frontend/src/api/client.ts`) e ambas as implementações
(`HttpApiClient`, `MockApiClient`) com:

| Método | HTTP | Retorno |
|---|---|---|
| `getVisualGallery()` | `GET /api/visual/gallery` | `VisualAsset[]` (desembrulha `{entries}`) |
| `listVisualEntities()` | `GET /api/visual/entities` | `VisualEntity[]` (desembrulha `{entries}`) |
| `getVisualEntity(id)` | `GET /api/visual/entities/:id` | `VisualEntity` |
| `getVisualEntityAssets(id)` | `GET /api/visual/entities/:id/assets` | `VisualAsset[]` (desembrulha `{entries}`) |
| `previewVisualContext(input)` | `POST /api/visual/context/preview` | `{operation, referenceCount, warnings}` |
| `createVisualGeneration(input)` | `POST /api/visual/generations` | `{generationId, status}` |
| `getVisualGeneration(id)` | `GET /api/visual/generations/:id` | `VisualGeneration` |

- `input` de geração/preview: `{ requestText?: string; entityId?: string | null }`
  (preview só usa `entityId`; geração exige `requestText`).
- Tipos `VisualAsset`, `VisualEntity`, `VisualGeneration`, `CanonicalLevel`,
  `GenerationStatus` são importados de `@ravenloft/content` (pacote `shared`,
  `shared/src/visual/models.ts`) para não duplicar shapes.
- Geração e preview são chamadas **anônimas** no backend (rota pública), mas a UI só as
  dispara no Estúdio, que exige admin no cliente.

### Componentes
Diretório `frontend/src/pages/enciclopedia/`:

- **`EnciclopediaPage.tsx`** — casca com `Tabs` MUI: "Galeria", "Entidades", "Estúdio".
  A aba "Estúdio" só é renderizada quando `loadAdminToken()` retorna token; sem token,
  mostra aba "Estúdio (admin)" desabilitada ou oculta.
- **`GaleriaTab.tsx`** — `getVisualGallery()`; grid MUI de cards usando
  `thumbnailUrl ?? storageUrl`; clique abre `Dialog`/lightbox com `storageUrl` + `description`.
- **`EntidadesTab.tsx`** — `listVisualEntities()`; lista/grid com `canonicalName` +
  `publicDescription`; selecionar entidade chama `getVisualEntityAssets(id)` e mostra os
  assets num detalhe (painel lateral ou dialog).
- **`EstudioTab.tsx`** — form: `TextField` de prompt (`requestText`), `Select` opcional de
  entidade (populado por `listVisualEntities`). Ao escolher entidade, chama
  `previewVisualContext` e mostra `warnings` + `operation`. Botão "Gerar" chama
  `createVisualGeneration` e inicia polling.

### Hook de polling
`useGenerationPolling(generationId)` (arquivo próprio, ex.
`frontend/src/pages/enciclopedia/useGenerationPolling.ts`):
- `GET /api/visual/generations/:id` a cada **3s**.
- Para quando `status ∈ {COMPLETED, NEEDS_REVIEW, FAILED}` ou após **timeout de 5min**.
- Retorna `{ generation, loading, error }`.

## Fluxo de dados

**Galeria:** montar → `getVisualGallery()` → grid → clique → lightbox.

**Entidades:** montar → `listVisualEntities()` → lista → selecionar →
`getVisualEntityAssets(id)` → detalhe com assets.

**Estúdio (admin):**
1. (opcional) seleciona entidade → `previewVisualContext({entityId})` → exibe
   `operation` (GENERATE/EDIT), `referenceCount` e `warnings`.
2. "Gerar" → `createVisualGeneration({requestText, entityId})` → `{generationId, status}`.
3. Polling até terminar.
4. Concluído: pega `generation.outputAssetIds[0]`; para exibir a imagem, chama
   `getVisualEntityAssets(entityId)` (ou `getVisualGallery`) e encontra o asset por `id`;
   mostra `storageUrl` + `consistencyReport?.overallScore`.
   - Se não houver `entityId` (geração livre), há gap conhecido: sem entidade não há lista
     de assets para resolver a URL. Nesta fase, **exigir seleção de entidade no Estúdio**
     para garantir que a imagem gerada seja exibível. Geração totalmente livre fica para fase futura.

## Tratamento de erros

- `429` na geração → Alert: "Limite de gerações por hora atingido. Tente novamente mais tarde."
- Falha de IA / status `FAILED` → Alert com `generation.error` ou "Falha ao gerar a imagem."
- Timeout de polling (5min) → Alert: "A geração está demorando mais que o esperado. Recarregue para verificar."
- Erros de rede nas leituras → estado de erro por aba com botão "Tentar novamente".

## Testes

Vitest + Testing Library, seguindo `frontend/src/pages/GalleryPage.test.tsx`:

- **`MockApiClient`**: adicionar dados visuais fake — ≥2 entidades, assets canônicos para
  galeria, e uma geração que avança de `RUNNING` → `COMPLETED` em chamadas sucessivas de
  `getVisualGeneration` (para exercitar o polling nos testes).
- **`EnciclopediaPage.test.tsx`**: Galeria renderiza cards; Entidades lista e abre detalhe;
  Estúdio **oculto/desabilitado sem admin token** e visível com token; ciclo de geração
  (preencher prompt → gerar → polling avança → imagem/score aparecem).
- **`httpClient.test.ts`**: um caso por novo método verificando path, verbo e
  desembrulho de `{entries}` / shape do corpo.

## Deploy

1. `cd frontend && npm run build` com `VITE_API_BASE_URL=https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com`
   em `.env.production`.
2. Zip do `frontend/dist`.
3. Fluxo manual Amplify (app `d1emmrcvmpw55g`, branch `main`, região `us-east-1`):
   `aws amplify create-deployment` → `curl` upload pro `zipUploadUrl` →
   `aws amplify start-deployment` → poll `aws amplify get-job` até `SUCCEED`.
4. Verificar `/enciclopedia` live: galeria com as 10 imagens, entidades navegáveis,
   estúdio visível após login admin.

## Fora de escopo (fase futura)

- Curadoria de assets pela UI (canonizar/travar/excluir).
- Geração totalmente livre (sem entidade) com exibição do resultado.
- Edição do Style Bible pela UI.
- Avaliador que enxerga a imagem renderizada (hoje avalia o texto do prompt).
