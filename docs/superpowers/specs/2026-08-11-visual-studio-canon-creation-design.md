# Estúdio Visual — Criação com verificação canônica

**Data:** 2026-08-11
**Status:** Aprovado (brainstorming)
**Escopo:** Frontend + uma pequena adição no backend.

## Objetivo

Deixar qualquer visitante **criar imagens** pela Enciclopédia (aba Estúdio), garantindo
**consistência canônica**: uma entidade recorrente (ex: o personagem "Alic") não pode sair
morena um dia e loira no outro. A criação vinculada a uma entidade sempre passa pela
verificação de consistência do backend contra o cânone dela. Conceitos totalmente novos
(sem entidade) são gerados livremente e, se o admin quiser, adicionados ao cânone.

Esta é a **primeira fatia** de uma visão maior (Bíblia Visual, entidades, folhas de
referência, mapas, cenas/continuidade etc.). Só o recorte abaixo está no escopo.

## Contexto (o que já existe)

O backend já implementa e está **live** em produção:

- Pipeline de geração real (OpenAI `gpt-image-1` gerar/editar) em `backend/src/visual/worker.ts`
  + `backend/src/visualWorkerHandler.ts`.
- Verificador de consistência (`backend/src/ai/visual/evaluator.ts`, `evaluatorRunner.ts`):
  quando a geração tem `entityId`, injeta referências canônicas + `immutableTraits` e roda
  uma avaliação multimodal; refaz até `MAX_RETRIES` e marca `COMPLETED` (ACCEPT) ou
  `NEEDS_REVIEW`.
- O worker **já aceita `entityId` nulo** (geração livre): `entity = gen.entityId ? ... : null`.
- Endpoints (públicos, exceto onde a UI restringe): `POST /api/visual/generations`,
  `GET /api/visual/generations/:id`, `POST /api/visual/context/preview`,
  `GET /api/visual/gallery` (só CANONICAL/LOCKED), `GET /api/visual/entities`,
  `POST /api/visual/assets/:id/canonize`, `.../lock`, `.../unlock`, `DELETE .../:id`.
- Frontend: aba Estúdio (`frontend/src/pages/enciclopedia/EstudioTab.tsx`) já faz
  seletor de entidade + prompt + preview + polling; hoje é **admin-only** e **exige** entidade.
  Hook `useGenerationPolling` pronto.

**Lacunas:**

1. Não existe `GET /api/visual/assets/:id`, então o frontend não consegue obter a URL de
   uma imagem gerada **sem entidade** (a resolução atual re-lista assets por entidade).
2. Estúdio é admin-only e obriga escolher entidade.
3. Frontend não tem métodos `getVisualAsset` nem `canonizeAsset` no `ApiClient`.

## Decisões de produto

- **Gerar:** público. Qualquer visitante gera (rate limit existente: 20/h por IP).
- **Canonizar (adicionar ao cânone):** **somente admin** (gating na UI, consistente com o
  padrão atual do projeto). Protege o cânone contra imagens ruins que virariam referência.
- **Manter a aba Estúdio** como hub de criação.
- **Entidade opcional:** escolher uma entidade → cânone aplicado e verificado; ou
  "Conceito novo (sem entidade)" → geração livre.
- **Toda criação mostra o veredito de consistência.** Conceitos novos, após gerar, exibem
  a pergunta (admin) "Adicionar ao cânone?".

## Arquitetura da fatia

### Backend

**Novo endpoint público `GET /api/visual/assets/:id`.**

- Handler `getVisualAsset` em `backend/src/routes/visualRoutes.ts`, reusando o `getAsset`
  já importado.
- Retorna `200` com o `VisualAsset` (inclui `storageUrl`/`thumbnailUrl`) ou `404 NOT_FOUND`.
- Registrar em `backend/src/router.ts`: `r("GET", "/api/visual/assets/:id", getVisualAsset)`.
- Teste em `visualRoutes.test.ts`: retorna o asset por id; 404 quando não existe.

Nenhuma outra mudança de backend. Geração e canonização já existem.

### Frontend

**`src/api/client.ts` (interface `ApiClient`):**

```ts
getVisualAsset(id: string): Promise<VisualAsset>;
canonizeAsset(id: string): Promise<{ id: string; canonicalLevel: CanonicalLevel }>;
```

**`src/api/httpClient.ts`:**

```ts
getVisualAsset: (id) => http<VisualAsset>(`/api/visual/assets/${id}`),
canonizeAsset: (id) => http(`/api/visual/assets/${id}/canonize`, { method: "POST" }),
```

**`src/api/mockClient.ts`:** implementações + fixtures. O asset gerado pelo mock (o
resultado da geração que completa no 2º poll) deve ser recuperável por `getVisualAsset`.
`canonizeAsset` promove o asset a `CANONICAL` e passa a aparecer em `getVisualGallery`.

**`src/pages/enciclopedia/EnciclopediaPage.tsx`:**

- A aba Estúdio deixa de ser admin-only: **sempre visível** (índice 2 sempre renderizado).
- Passar `isAdmin` (de `loadAdminToken()`) para o `EstudioTab` para gating do botão de
  canonizar.

**`src/pages/enciclopedia/EstudioTab.tsx`:**

- **Seletor de entidade opcional:** primeira opção "Conceito novo (sem entidade)"
  (`entityId = ""`), seguida das entidades. Gerar **habilitado** sem entidade (só exige
  prompt não-vazio).
- **Preview:** continua chamando `previewVisualContext({ entityId })` só quando há entidade;
  exibir avisos (ex: "Traços imutáveis de Alic serão preservados.").
- **Resolução do resultado (mudança-chave):** ao terminar o polling, pegar
  `generation.outputAssetIds[0]` e buscar via **`getVisualAsset(id)`** (funciona com ou sem
  entidade), em vez de re-listar assets da entidade.
- **Veredito de consistência:** a partir do `status` final da geração:
  - `COMPLETED` → alerta de sucesso: "Passou na verificação de consistência" (+ score de
    `consistencyReport.overallScore`, se houver).
  - `NEEDS_REVIEW` → alerta de aviso: "Divergência do cânone detectada — revise antes de
    canonizar."
  - `FAILED` → alerta de erro (comportamento atual mantido).
- **Ação de canonizar (admin):**
  - Botão **"Adicionar ao cânone"**. Para conceito novo, o texto/enquadramento é uma
    pergunta ("Adicionar ao cânone?"). Só renderiza quando `isAdmin`.
  - `NEEDS_REVIEW`: exigir uma confirmação extra antes de canonizar (o aviso já sinaliza).
  - Ao clicar: `canonizeAsset(assetId)` → em sucesso, feedback "Adicionada ao cânone" e
    dispara um refresh da Galeria (via prop de callback ou recarregando ao trocar de aba).
- **Guardas já existentes** (`submitting`, `active`/`resolvingAsset`, feedback de terminal
  sem asset) devem ser preservadas.

**`src/pages/enciclopedia/GaleriaTab.tsx`:** permanece display-only. Deve refletir o item
recém-canonizado — recarregar a galeria quando a aba Galeria é aberta (ou via callback do
Estúdio). Escolha do plano: recarga simples ao montar/abrir a aba é suficiente.

## Fluxo de dados

1. Usuário abre **Estúdio** (público) → escolhe entidade ou "Conceito novo" → digita prompt.
2. (Com entidade) `previewVisualContext` mostra avisos canônicos.
3. **Gerar** → `createVisualGeneration({ requestText, entityId })` → `202 { generationId }`.
4. `useGenerationPolling(generationId)` (3s, timeout 5min) até status terminal.
5. Backend, no worker: se `entityId`, injeta referências canônicas + traços imutáveis e roda
   o verificador (refaz se divergir); grava `VisualAsset` DRAFT e atualiza a geração.
6. Frontend resolve `outputAssetIds[0]` via `getVisualAsset` → mostra imagem + veredito.
7. Admin: **Adicionar ao cânone** → `canonizeAsset` → asset vira CANONICAL → Galeria recarrega.

## Tratamento de erros

- Geração `FAILED` → alerta de erro com a mensagem; sem botão de canonizar.
- Terminal sem `outputAssetIds` → mensagem de que nenhuma imagem foi produzida (guarda atual).
- `getVisualAsset` 404 → mensagem "não foi possível carregar a imagem gerada".
- `canonizeAsset` erro → alerta; o asset continua como rascunho.
- Rate limit `429` na geração → mensagem amigável (o cliente HTTP já propaga o erro).

## Testes

**Backend** (`visualRoutes.test.ts`):
- `getVisualAsset` retorna o asset por id.
- `getVisualAsset` retorna 404 quando não existe.

**Frontend:**
- `httpClient.test.ts`: `getVisualAsset` e `canonizeAsset` chamam as URLs/métodos corretos.
- `EstudioTab.test.tsx`:
  - gera **sem entidade** (Conceito novo) e exibe a imagem resolvida via `getVisualAsset`;
  - status `COMPLETED` mostra o veredito de sucesso; `NEEDS_REVIEW` mostra o aviso;
  - botão "Adicionar ao cânone" **não** aparece para não-admin; aparece para admin e chama
    `canonizeAsset`.
- `EnciclopediaPage.test.tsx`: aba Estúdio visível mesmo sem admin.

Rodar apenas os arquivos afetados (o ambiente de teste é lento sob carga paralela).

## Fora de escopo (fatias futuras)

Editor da Bíblia Visual, criar/editar entidades pela UI, folhas de referência, mapas e
`MapFeature`, cenas/continuidade (`VisualSceneThread`), versionamento de entidade/estilo,
permissões por Casa, painel de consistência detalhado, criar uma **entidade nova** a partir
de um conceito canonizado, e proteção de canonização no backend (hoje o gating é só na UI —
limitação conhecida, herdada do padrão atual do projeto).

## Limitações conhecidas

- **Gating de canonização é só na UI.** O endpoint `POST /api/visual/assets/:id/canonize`
  permanece público no backend (consistente com o padrão atual do projeto). Proteção real
  no backend fica para uma fatia futura.
- Um "conceito novo" canonizado entra na Galeria mas **não** está ligado a uma entidade,
  então não serve como referência automática para gerações futuras de entidades. Criar
  entidade a partir dele é fatia futura.
