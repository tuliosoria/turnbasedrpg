# Design — AI World Context (World Bible + Visual Directives)

Date: 2026-07-18
Status: Approved (pending written-spec review)
Scope: **Spec 1 of 2.** This spec covers the *text* context that makes the game's
AI aware of the world and its visual identity. The actual image
generation/evolution/gallery pipeline is **Spec 2** and will be brainstormed
separately.

## Problem

The game's AI (OpenAI, running in the backend Lambda) drafts per-house private
information and turn resolutions. Today its only context is a short hardcoded
`PREMISE` string in `backend/src/ai/prompts.ts` — one line of setting plus the
"attributes are constraints" rule. It has:

- no rich world lore (geography, races, magic, tone of Valdren),
- no memory of what happened in previous turns beyond the single last public
  result,
- no awareness of the campaign's visual identity.

As a result the AI cannot keep the setting coherent or build on prior events,
and there is no way for the admin (DM) to shape the world without a code change.

## Goal

Introduce a **World Bible**: an admin-editable, campaign-level context document,
plus an automatically-derived chronicle of resolved turns, injected into the
AI's text prompts. Include a second editable field for **Visual Directives**
(art-style/continuity guidance) that is stored now and consumed by Spec 2.

Non-goals (Spec 2): generating, editing, storing, or displaying images.

## Approach (chosen: A)

- Store the World Bible as a single campaign-level DynamoDB item (editable at
  runtime by the admin).
- Derive the "chronicle" on the fly from resolved turns (which already persist
  `result.publicResult`) — no new storage for history.
- Inject `PREMISE + lore + recent chronicle` into the text-drafting prompts.
- Store `visualDirectives` now (editable + seeded) but do **not** inject it into
  the text prompts; it is reserved for Spec 2's image prompts.

Rejected alternatives:
- **B (lore as a code constant):** not editable at runtime — fails the
  requirement that the admin edits it in the panel.
- **C (AI-summarized rolling chronicle):** extra OpenAI calls, cost, latency, and
  moving parts. YAGNI for now; can be added later if the plain chronicle is thin.

## Data model & storage

New campaign-level item in the existing single table `ravenloft-game`:

- `PK = campaignPk(campaignId)` → `CAMPAIGN#WINTER_DEAD`
- `SK = "WORLDBIBLE"`
- Attributes:
  ```ts
  {
    lore: string;              // admin-editable world lore + rules
    visualDirectives: string;  // admin-editable art-style/continuity guide (Spec 2)
    updatedAt: string;         // ISO timestamp
  }
  ```

Key helper (add to `backend/src/keys.ts`):
```ts
export function worldBibleSk(): string { return "WORLDBIBLE"; }
```

The chronicle is **not** stored here. It is derived from `listTurns(...)`:
filter `status === "RESOLVED"` with a `result.publicResult`, sort by `turnId`,
and take the last N (default **10**).

## Domain types (shared package `@ravenloft/content`)

Add to `shared/src/types.ts`:
```ts
export interface WorldBible {
  lore: string;
  visualDirectives: string;
  updatedAt: string;
}

export const CHRONICLE_MAX_TURNS = 10;
```
Export from `shared/src/index.ts`.

## Backend

### DB module — `backend/src/db/worldBible.ts` (new)
- `getWorldBible(doc, tableName, campaignId): Promise<WorldBible | null>`
  — `GetCommand` on `{PK: campaignPk, SK: worldBibleSk()}`.
- `putWorldBible(doc, tableName, campaignId, { lore, visualDirectives }): Promise<WorldBible>`
  — `PutCommand`, sets `updatedAt = new Date().toISOString()`, returns the saved item.

### AI context assembly — `backend/src/ai/prompts.ts`
Add a helper that turns resolved turns into a chronicle block:
```ts
export function buildChronicle(resolvedTurns: Turn[], max = CHRONICLE_MAX_TURNS): string
```
- Input: full turn list (or already-resolved subset). It filters RESOLVED turns
  with a non-empty `result.publicResult`, sorts ascending by `turnId`, keeps the
  last `max`, and renders lines: `Turno {turnId}: {publicResult}`.
- Returns `""` when there is no resolved history.

Update the two prompt builders to accept the lore and chronicle and prepend a
context block after `PREMISE`:
```
PREMISE
+ (lore ? "\n\nMUNDO:\n" + lore : "")
+ (chronicle ? "\n\nCRÔNICA (turnos recentes):\n" + chronicle : "")
```
- `buildPrivateInfoPrompt(houses, publicEvent, opts: { lore?: string; chronicle?: string })`
- `buildResolutionPrompt(turn, houses, submissions, opts: { lore?: string; chronicle?: string })`

The `lastPublicResult` argument currently used by `buildPrivateInfoPrompt` is
superseded by the chronicle and removed. `PREMISE` (the core rules) is unchanged.
`visualDirectives` is **not** referenced here.

### Admin routes — `backend/src/routes/adminRoutes.ts`
- `getWorldBible(deps, req)` → `requireAdmin`; returns
  `{ lore, visualDirectives, updatedAt }`, defaulting to empty strings when the
  item is missing.
- `putWorldBible(deps, req)` → `requireAdmin`; validates the body via a new
  `parseWorldBibleBody` (both fields strings, each length-capped, e.g. ≤ 8000
  chars); saves via `putWorldBible` db; returns `204`.

Wire the two calls in the AI draft handlers so context is injected:
- `draftPrivateInfo` and `draftResolution` load the World Bible
  (`getWorldBible`) and build the chronicle (`buildChronicle(await listTurns(...))`),
  then pass `{ lore, chronicle }` into the prompt builders.

### Validation — `backend/src/validation/schemas.ts`
Add `parseWorldBibleBody(body): { lore: string; visualDirectives: string }`
following the existing parser conventions (throws `HttpError(400, "INVALID_BODY", ...)`).

### Router — `backend/src/router.ts`
Register:
- `GET  /api/admin/world-bible` → `getWorldBible`
- `PUT  /api/admin/world-bible` → `putWorldBible`

## Frontend

### API layer — `frontend/src/api/*`
- Types in `types/api.ts`: `WorldBible` shape.
- `client.ts` interface + `httpClient.ts` + `mockClient.ts`:
  - `adminGetWorldBible(adminToken): Promise<WorldBible>`
  - `adminPutWorldBible(adminToken, { lore, visualDirectives }): Promise<void>`
- Mock client stores an in-memory World Bible so offline/dev and tests work.

### Admin panel — `frontend/src/pages/AdminPage.tsx`
Add a collapsible "Bíblia do Mundo" section (DM/AI-only; not shown to players):
- Two multiline textareas: **Lore do Mundo** (`lore`) and
  **Diretrizes Visuais** (`visualDirectives`).
- A **Salvar** button using the existing `runAction` pattern
  (`adminPutWorldBible`, success notice "Bíblia salva.").
- Loaded on dashboard load via `adminGetWorldBible`.

## Seeding & migration

- `backend/scripts/reset-campaign.mjs`: when seeding, also write the `WORLDBIBLE`
  item with `lore` = the Valdren world text (Appendix A) and `visualDirectives`
  = the visual directive text (Appendix B).
- One-off migration `backend/scripts/seed-world-bible.mjs` (dry-run by default,
  `--confirm` to apply): writes/overwrites the `WORLDBIBLE` item for the current
  live campaign so no full reset is required. Idempotent.

## Testing

- `shared`: type export smoke (build).
- `backend/src/db/worldBible.test.ts`: get returns null when absent; put sets
  `updatedAt` and round-trips.
- `backend/src/ai/prompts.test.ts`: `buildChronicle` caps at 10, orders
  ascending, ignores non-resolved/empty; prompt builders include `MUNDO:` +
  `CRÔNICA:` when provided and omit them when empty; `visualDirectives` never
  appears in text prompts.
- `backend/src/routes/adminRoutes.test.ts`: GET returns defaults when missing;
  PUT validates + saves; both require admin; `draftResolution`/`draftPrivateInfo`
  pass lore + chronicle into the builders.
- `backend/src/validation/schemas.test.ts`: `parseWorldBibleBody` accepts valid,
  rejects non-string / oversized.
- `frontend`: mock client round-trips World Bible; AdminPage renders the section
  (light test consistent with existing coverage).
- Existing `PREMISE`/parse tests stay green.

## Rollout

1. Merge on a feature branch; run full `npm test` + builds.
2. Deploy backend (SAM) — no new infra/params (uses existing table + OpenAI env).
3. Run `seed-world-bible.mjs --confirm` against the live campaign.
4. Deploy frontend (Amplify manual zip flow).
5. Verify: admin panel shows/saves the Bible; an AI resolution draft reflects the
   lore and recent chronicle.

## Appendix A — seed `lore`

> Vamos começar uma campanha narrativa de estratégia e fantasia chamada **O
> Inverno dos Mortos**. Valdren é um reino de Ravenloft cercado pelas Brumas. É
> uma grande ilha, aproximadamente do tamanho da Inglaterra. Ao sul, o oceano
> termina em uma parede de Brumas; ao norte, existem montanhas e geleiras
> praticamente intransponíveis. O reino possui humanos, elfos, anões e outras
> raças, além de magia, criaturas místicas, religiões e perigos sobrenaturais.
> Cada jogador é o líder de uma Grande Casa, em um estilo parecido com *Game of
> Thrones*.
>
> Cada Casa possui quatro atributos, de **0 a 5**:
> **Riqueza** (dinheiro, comércio, contratar serviços), **Recursos** (alimentos,
> madeira, ferro, cavalos, suprimentos), **Soldados** (força militar e defesa),
> **Controle** (lealdade da população, estabilidade, autoridade política). Cada
> Casa começa com **10 pontos** distribuídos, nenhum atributo acima de 5.
>
> Exemplo — **Casa Vargen — Os Lobos do Norte**: Castelo Droskar; território de
> cidades e vilas próximas às montanhas do Norte; especialidade em defesa e
> conhecimento do terreno; fraqueza em alimentos e terras pouco produtivas;
> Riqueza 1, Recursos 2, Soldados 5, Controle 2 (total 10).
>
> A cada turno as Casas recebem um evento e informações privadas. Em vez de
> escolher uma ação pronta, escrevem o que desejam fazer usando seus recursos e
> capacidades. As decisões criam a história, mudam o reino e geram consequências
> nos próximos turnos. Os atributos são **restrições**, não ações: limitam o que
> é plausível.

## Appendix B — seed `visualDirectives` (consumed in Spec 2)

**Verbatim source:** the seed value MUST be the exact text of the user's pasted
message titled "**Prompt – Diretrizes para Geração e Evolução de Imagens**"
(the implementer copies that full markdown text into the seed script). The
summary below is only an index of what that text covers — do not paraphrase it
into the seed.

Covered sections: art style (Dark Fantasy / Ravenloft / gótico medieval /
pintura digital cinematográfica / muito detalhada / tons frios / atmosfera
pesada / neve, névoa e iluminação dramática / consistência entre personagens,
cidades e arquitetura), priority on editing existing images over creating new
ones, permanent base images (mapa de Valdren, cada Grande Casa, brasões,
castelos principais, principais cidades, Rei Pálido, NPCs importantes,
artefatos lendários, fortalezas do Norte), visual-evolution guidance (castelos,
cidades, mapa, personagens, brasões), turn-result image selection (illustrate
only high-impact events, with the three worked examples), when NOT to generate
(eventos pequenos), and the end goal of a chronicle-like illustrated gallery.
Stored verbatim; not injected into text prompts in Spec 1.
