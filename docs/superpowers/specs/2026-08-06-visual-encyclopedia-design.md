# Enciclopédia de Imagens de Valdren — Design Canônico

**Data:** 2026-08-06
**Status:** Aprovado para planejamento
**Autor:** Brainstorming com @tuliosoria

## 1. Objetivo

Criar uma aba **pública e aberta** ("Enciclopédia de Imagens") no site de Valdren que combina:

1. Uma **galeria navegável** de todas as imagens canônicas do mundo (as 10 imagens semente em `valdren-context/valdren-images/`, imagens de Casas, imagens de turno já existentes, e tudo que for gerado e salvo).
2. Um **Estúdio de Geração** onde qualquer usuário gera novas imagens de Valdren. A cada geração o usuário **descarta** ou **salva na enciclopédia**.

O sistema prioriza **consistência visual** ao longo de centenas de imagens. A consistência **não** depende do histórico da IA — é mantida pelo aplicativo via dados persistentes, imagens de referência, versões canônicas, descrições estruturadas e montagem automática de contexto a cada geração.

### Decisões-chave (do brainstorming)

- **Totalmente aberto:** qualquer usuário gera E salva na enciclopédia. Sem papel de Mestre, sem gate de aprovação, sem segredos GM-only.
- **Canonização simples:** gerar → descartar OU salvar. Tudo que é salvo é referência canônica. Qualquer um pode **travar** (LOCKED = protegido de exclusão).
- **Entidades:** semeadas automaticamente das Casas/Wiki/canon existentes + criação/edição manual no Estúdio.
- **Verificador de Consistência completo:** com auto-retry/correção, via **job assíncrono** (frontend faz polling).
- **Pipeline assíncrono:** `POST /generate` grava job PENDING e dispara uma **Lambda worker** (invocação Event) que roda o pipeline e atualiza o job.
- **Multi-campanha no dado, uma campanha ativa na UI:** manter `campaignId` em todos os modelos (padrão existente).
- **Contexto = apenas canon PUBLICO:** o compilador de contexto nunca ingere `valdren-context/MESTRE/`. Segredos protegidos por construção.

### Reuso do que já existe

| Já existe | Papel no novo sistema |
|---|---|
| `backend/src/ai/images.ts` (`gpt-image-1`, `images.generate`) | Base do gerador; **adicionar** caminho de edição (`images.edit` + `input_fidelity:"high"`) |
| `backend/src/storage/images.ts` (S3 `ImageStore`) | Estender para salvar assets visuais (original + thumbnail + metadados) |
| Galeria (`getGallery`, `GalleryPage`) | Evoluir para a aba Enciclopédia (galeria + estúdio + biblioteca) |
| `shared/src/imageDirectives.ts` (Diretrizes/World Bible) | Semente da `VisualStyleBible` v1 |
| Wiki + `valdren-context/PUBLICO` canon | Semente das `VisualEntity` e fonte de `canonicalText` |
| DynamoDB single-table (`keys.ts`) | Mesmo padrão para os novos itens |
| `backend/src/ai/openai.ts` (`ChatFn`) | Base do avaliador multimodal e compilador de prompt |

## 2. Modelo de dados (DynamoDB single-table)

Segue `campaignPk(campaignId)` + SK. Todos os acessos por GSI — **nenhum scan**.

| Modelo | PK / SK | GSIs |
|---|---|---|
| **VisualStyleBible** | `CAMPAIGN#x` / `VSTYLE#<version>` | status ACTIVE |
| **VisualEntity** | `CAMPAIGN#x` / `VENTITY#<entityId>` | `entityType`, `slug`, `houseId`/`regionId`, status |
| **VisualAsset** | `CAMPAIGN#x` / `VASSET#<assetId>` | `entityId`, `canonicalLevel` (CANONICAL/LOCKED), status |
| **VisualGeneration** | `CAMPAIGN#x` / `VGEN#<genId>` | status (PENDING p/ worker), `requestedBy` |
| **VisualSceneThread** | `CAMPAIGN#x` / `VSCENE#<threadId>` | status |
| **MapFeature** | `MAP#<mapId>` / `FEATURE#<featureId>` | `mapEntityId` |

- **Perfis** (`CharacterVisualProfile` / `CityVisualProfile` / `HouseVisualProfile`) ficam como bloco tipado `profile` **dentro** do `VisualEntity` — entidade autocontida, sem joins.
- `immutableTraits`, `flexibleTraits`, `prohibitedChanges`, `visualKeywords`, `negativeInstructions`, `scaleDescription` são campos estruturados no `VisualEntity`.
- **Sem** `visibility` / `hiddenGmContext` / `privateDescription` (decisão "totalmente aberto").
- Modelos de domínio ficam em `shared/src/visual/` e são exportados por `@ravenloft/content` (padrão do repo). Tipos puros + funções de clamp/validação testáveis isoladamente.

### VisualStyleBible (Bíblia Visual)

Versionada. Apenas uma versão `ACTIVE` por campanha. Nova versão **não apaga** anteriores; assets registram `styleBibleVersion` usada. Campos conforme o spec do usuário (artMedium, renderingStyle, lightingRules, colorPalette, architectureRenderingRules, characterRenderingRules, prohibitedStyles, globalNegativeInstructions, referenceAssetIds, etc.). **v1 semeada** a partir de `DEFAULT_IMAGE_DIRECTIVES` + guia de estilo (`17_GUIA_DE_ESTILO...`).

### VisualEntity

Tipos: CHARACTER, HOUSE, CITY, SETTLEMENT, REGION, LANDMARK, CREATURE, ANCESTRY, ARTIFACT, VEHICLE, SHIP, BUILDING, ROOM, MAP, SYMBOL, WEAPON, CLOTHING_SET, EVENT, SCENE. Campos conforme spec (canonicalName, aliases, slug, publicDescription, immutableTraits, flexibleTraits, prohibitedChanges, visualKeywords, negativeInstructions, scaleDescription, culturalContext, houseId, regionId, parentEntityId, relatedEntityIds, status, canonicalAssetIds, supportingAssetIds, referenceSheetAssetId, mapAssetId, version, profile).

### VisualAsset

Campos conforme spec (entityId, assetType, storageKey, thumbnailStorageKey, mimeType, width, height, aspectRatio, checksum, status, canonicalLevel, styleBibleVersion, entityVersion, generationId, parentAssetIds, referenceRoles, cameraAngle, viewType, description, extractedVisualDescription, consistencyScore, consistencyReport, tags).
- `canonicalLevel`: DRAFT | CANDIDATE | CANONICAL | LOCKED. LOCKED não pode ser apagado/substituído sem ação explícita.
- Não armazenar base64 no banco; só `storageKey`/URLs. Salvar original + thumbnail no S3.

### VisualGeneration (job + histórico)

Campos conforme spec (requestedBy, requestText, compiledPrompt, operationType GENERATE|EDIT, model, inputFidelity, size, quality, styleBibleVersion, entityVersions, referenceAssetIds, sceneThreadId, outputAssetIds, status, retryCount, usage, estimatedCost, latency, consistencyReport, error, createdAt, completedAt). `status`: PENDING → RUNNING → NEEDS_REVIEW | COMPLETED | FAILED.

## 3. Pipeline de geração assíncrono

```
POST /visual-generations
  ├─ valida input, rate-limit, orçamento da campanha
  ├─ grava VisualGeneration (PENDING) no Dynamo
  ├─ invoca Lambda worker (InvokeCommand, InvocationType=Event)
  └─ 202 { generationId }   ← retorna imediato

Worker Lambda (assíncrono, timeout alto):
  1. VisualContextCompiler → monta VisualContextPackage
  2. ReferenceSelector    → seleciona refs por papel (STYLE/IDENTITY/FACE/ARCHITECTURE/GEOGRAPHY/CONTINUITY…)
  3. PromptCompiler       → prompt estruturado (16 seções)
  4. Decide GENERATE vs EDIT (EDIT se entidade já tem canônica / é continuação → input_fidelity:"high")
  5. images.generate | images.edit
  6. Salva asset DRAFT no S3 (original + thumbnail)
  7. VisualConsistencyEvaluator (chamada multimodal) → JSON de scores/violações
  8. Decide: ACCEPT | RETRY(≤N) | EDIT-correção | NEEDS_REVIEW
  9. Atualiza VisualGeneration (COMPLETED/NEEDS_REVIEW/FAILED) + usage/custo/latência

GET /visual-generations/{id}  ← frontend faz polling até status final
```

- **Compilador de Contexto (`VisualContextCompiler`)** monta o `VisualContextPackage` com ordem de prioridade: segurança → LOCKED → mapa canônico → immutableTraits → Bíblia Visual ativa → assets CANONICAL → continuidade → pedido do usuário → detalhes flexíveis → improvisação. O pedido do usuário nunca sobrepõe LOCKED. Ingerе **apenas** canon PUBLICO.
- **Seletor de Referências (`ReferenceSelector`)** escolhe por função, não só por similaridade textual. Limita a: 1 ref de estilo, 1–2 por personagem, 1 da cidade, 1 de ambiente, 1 de continuidade — evita imagens que competem.
- **Compilador de Prompt (`PromptCompiler`)** gera as 16 seções (tipo, objetivo narrativo, estilo global, entidades, restrições imutáveis, local/geografia, arquitetura, roupas/símbolos, ação, composição, câmera, luz/atmosfera, materiais, continuidade, proibições, requisitos técnicos). Usa o prompt de sistema "Diretor de Arte Canônico de Valdren".
- **Verificador (`VisualConsistencyEvaluator`)** retorna JSON `{overallScore, styleScore, characterIdentityScore, …, violations[], recommendedAction, correctionInstructions[]}`. Limiares: ≥90 apresenta; 80–89 aviso/auto-correção; 65–79 edição corretiva; <65 rejeita e regera; qualquer violação HIGH em LOCKED → não apresenta como final (NEEDS_REVIEW). Retries automáticos limitados (custo/loop). Registra custo, tokens, latência, tentativas.

### Edição vs Nova Geração (automático)

- **EDIT** (`input_fidelity:"high"`): entidade já tem canônica; continuação de cena; mudar roupa/luz/expressão/pequeno elemento; cidade de outro ângulo preservando identidade; adicionar/remover objeto; detalhar mapa.
- **GENERATE**: entidade sem referência; conceito novo; nenhuma composição anterior a preservar.
- O backend escolhe sozinho e informa ao usuário apenas **"nova criação"** ou **"continuação canônica"**.

## 4. Seeding (a partir de `valdren-context/`)

Script/rotina de seed idempotente (executada uma vez, reexecutável sem duplicar):

1. **Upload das 10 imagens** de `valdren-images/` para o S3 como `VisualAsset` CANONICAL.
2. **VisualStyleBible v1 (ACTIVE)** a partir de `DEFAULT_IMAGE_DIRECTIVES` + `17_GUIA_DE_ESTILO...`.
3. **VisualEntity** semeadas e associadas às imagens:
   - CHARACTER: Alic Valerius (`Principe Alic Valerius.png`), Lady Celene Valerius.
   - MAP: Valdren (`Mapa Oficial.png`) → **LOCKED**.
   - CITY: Khar-Durak, Euralune (Ninho Alto), Solarion (Sahra-Lun).
   - ANCESTRY: Elfos de Solarion, Elfos de Sahra-Lun, Gnomos de Euralune, Clã Mandíbula de Osso.
   - Casas existentes → HOUSE entities (reusa imagens de Casa já geradas).
4. `canonicalText`/`publicDescription`/`immutableTraits` iniciais derivados do canon PUBLICO (Atlas Geográfico, Casas, Povos) — texto curado, orçamento por seção como em `buildProjectCanon`.

`valdren-context/` fica **fora do bundle Lambda** (só usado no seed/build); imagens vão para o S3.

## 5. API (endpoints)

Registrados em `router.ts` via `r(method,path,handler)`. Rotas **públicas** (sem admin token), com rate-limit por IP/usuário (`hitRateLimit`). Grupos:

- **Style Bible:** `GET/PUT /campaigns/{c}/visual-style`, `POST .../versions`, `POST .../{v}/activate`
- **Entidades:** `GET/POST /campaigns/{c}/visual-entities`, `GET/PUT /visual-entities/{id}`, `POST .../versions`, `GET .../assets`, `POST .../reference-sheet`, `POST .../generate`, `POST .../edit`
- **Gerações:** `POST /visual-generations`, `GET /visual-generations/{id}`, `POST .../retry`, `POST .../correct`
- **Assets:** `POST /visual-assets/{id}/canonize` (=salvar), `POST .../lock`, `POST .../unlock`, `POST .../compare`, `DELETE /visual-assets/{id}` (bloqueado se LOCKED)
- **Cenas:** `GET/POST /campaigns/{c}/visual-scene-threads`, `POST .../{id}/continue`
- **Mapa:** `GET/POST /campaigns/{c}/maps`, `POST /maps/{id}/features`, `PUT /map-features/{id}`, `POST /maps/{id}/generate-region`
- **Utilidades:** `POST /visual-context/preview` (mostra refs/avisos antes de gerar), `POST /visual-consistency/evaluate`

## 6. Frontend (aba Enciclopédia)

Nova rota pública (ex. `/enciclopedia`) com sub-abas. Todas as strings em **PT**. MUI, seguindo padrões existentes.

- **Galeria:** grid de assets canônicos com filtros (entidade, Casa, região, tipo, canônico/travado/rascunho, cena, versão, data, criador). Comparação lado a lado (nova × referência × versão anterior × relatório).
- **Estúdio Visual:** formulário (tipo de imagem, entidade principal, personagens, local, Casa, momento, descrição da cena, composição, câmera, horário, clima, iluminação, proporção). **Preview de referências** e avisos ("Identidade facial de Alic será preservada", "Asterhall usará geografia canônica", "brasão travado", "esta geração continua a cena X"). Botão **Gerar** → cria job → tela de progresso com polling → resultado com **Descartar** ou **Salvar na enciclopédia** (+ Travar, Solicitar variação, Corrigir mantendo identidade, Comparar, Criar folha de referência).
- **Entidade:** página por VisualEntity (descrição, traços imutáveis, assets canônicos, folha de referência, histórico de versões).
- Cliente de API estendido em `frontend/src/api/{client,httpClient,mockClient}.ts` + tipos em `types/api.ts` (padrão existente).

## 7. Segurança, custo e limites

- Chave OpenAI **só no backend**. Uploads validam tamanho/formato/origem; moderação conforme políticas atuais.
- **Rate limiting** por IP/usuário e **orçamento por campanha** (limite mensal configurável); `VisualGeneration` registra `estimatedCost`. Retry automático limitado a N tentativas.
- URLs assinadas para acesso privado quando necessário (assets públicos usam URL pública imutável, como hoje).
- Worker Lambda com timeout adequado (não limitado ao teto do API Gateway).

## 8. Testes

- **shared:** modelos/validação/clamp (`shared/src/visual/*.test.ts`), decisão GENERATE-vs-EDIT, montagem do VisualContextPackage (funções puras).
- **backend:** rotas (handlers com deps mockadas), parsing do JSON do avaliador, seleção de referências, seed idempotente, pipeline do worker com `image`/`chat`/`imageStore` mockados. TDD: teste antes da implementação.
- **frontend:** Estúdio (fluxo gerar→polling→salvar/descartar), Galeria (filtros), mockClient para novos endpoints.
- Build: `npm run build:shared` antes de backend/frontend; `npx vitest run`; `npx tsc --noEmit` por pacote.

## 9. Roteiro de entrega em fases

Cada fase é um ciclo spec-de-fase → plano → implementação → deploy independente, entregando valor visível.

- **Fase 1 — Fundação + Estúdio MVP (vertical slice):** modelos `shared/src/visual`; StyleBible v1 semeada; VisualEntity/VisualAsset + seed das 10 imagens e Casas; pipeline assíncrono (job + worker) com GENERATE/EDIT e Compilador de Contexto/Prompt (canon PUBLICO); aba Enciclopédia com Galeria + Estúdio (gerar → descartar/salvar) + preview de referências. **Verificador em modo "lite" (pontua e avisa)** nesta fase para reduzir risco; auto-retry vem na Fase 2.
- **Fase 2 — Verificador completo + auto-retry/correção:** loop de avaliação com retry/edição corretiva, NEEDS_REVIEW, limiares, comparação lado a lado, custo/orçamento.
- **Fase 3 — Folhas de Referência + faceLock:** fluxos de reference sheet (personagem/cidade/Casa/criatura); bloqueio facial; reuso obrigatório de folhas.
- **Fase 4 — Mapa Canônico + MapFeature:** upload/versionamento do mapa LOCKED, features, recorte regional, geração de região preservando geometria.
- **Fase 5 — Threads de Cena + continuidade:** `VisualSceneThread`, continuação preservando roupas/luz/objetos/posição.
- **Fase 6 — Biblioteca avançada + lote:** filtros completos, geração em lote (avaliada individualmente, sem canonização automática em lote), linhagem/histórico.

## 10. Riscos e mitigações

- **Custo/latência do gpt-image-1 + avaliador:** pipeline assíncrono + orçamento por campanha + retries limitados. Fase 1 usa avaliador lite.
- **Escopo enorme:** entrega em fases; cada fase é um ciclo completo.
- **`images.edit` + `input_fidelity`:** requer adicionar função nova ao `ai/images.ts`; validar contra a API OpenAI antes de depender dela na Fase 1.
- **Consistência de dados single-table:** confirmar GSIs antes de modelar; espelhar padrões de `keys.ts`/`db/*`.
