# Ravenloft: O Inverno dos Mortos — MVP Design

**Date:** 2026-07-17
**Status:** Approved design, ready for implementation planning
**Source spec:** `ravenloft_inverno_dos_mortos_site_spec.md` (campaign + site specification, Portuguese)
**Repository:** https://github.com/tuliosoria/turnbasedrpg

---

## 1. Purpose & context

**O Inverno dos Mortos** is a cooperative narrative-strategy campaign site set in a Ravenloft-compatible Domain of Dread. Each player controls a Great House and submits **one card per turn**. The site is a *reading portal + decision selector + choice store + admin panel + published history* — it is **not** the game master. Turn resolution stays human: the admin exports the choices and resolves them manually (with Claude Code), then commits new content and redeploys.

The site never contains the whole campaign in advance. The repository holds only: the permanent introduction, the Houses, published results, and the currently active turn.

### Decisions locked in during brainstorming

| Decision | Choice |
|---|---|
| Location | Build in existing repo `tuliosoria/turnbasedrpg` |
| Scope | Full MVP now, real AWS (account available) |
| Frontend hosting | AWS Amplify Hosting (git-connected auto-deploy) |
| Backend | AWS SAM — API Gateway HTTP API + single Lambda + one DynamoDB table |
| Content/UI language | Portuguese UI + Portuguese content; code identifiers/IDs stay English |
| Repo architecture | npm workspaces monorepo (`frontend/`, `backend/`, `shared/`) |
| Region | us-east-1 |

---

## 2. Non-goals (explicitly out of MVP)

Email signup, password recovery, player chat, automated combat, in-site AI, automatic narrative generation, pre-writing future turns, native mobile app, complex inventory, payments, WebSockets/real-time, interactive maps, direct browser→DynamoDB access.

---

## 3. Architecture

```
React (browser) --HTTPS JSON--> API Gateway HTTP API --> Lambda --> DynamoDB
                                                          Lambda --> @ravenloft/content (bundled)
Claude Code --updates story & active turn--> Git --> deploy --> Amplify (frontend) + SAM (backend)
```

The browser never holds AWS credentials or touches DynamoDB. React calls the HTTP API; the Lambda validates the player and reads/writes DynamoDB. Campaign **content** is versioned in Git; mutable **state** lives in DynamoDB.

---

## 4. Repository & build architecture (npm workspaces monorepo)

```
turnbasedrpg/
  package.json                 # workspaces: ["frontend", "backend", "shared"] + top-level scripts
  shared/                      # @ravenloft/content — SINGLE SOURCE OF TRUTH
    src/
      types.ts                 # HouseId, CardCategory, KingdomState, HouseDefinition,
                               #   TurnCard, HouseTurnContent, PublishedTurnResult,
                               #   TurnDefinition, CampaignDefinition (spec §31)
      campaign.ts              # CampaignDefinition (title, activeTurnId, introduction, initialState)
      houses.ts                # 6 HouseDefinition records
      turns/turn-001.ts        # TurnDefinition for Turn 1 (publishedResult: undefined)
      version.ts               # CONTENT_VERSION = "2026-07-17-turn-001"
      index.ts
    package.json
    tsconfig.json
  frontend/                    # React + TypeScript + Vite (Amplify builds this)
    src/
      api/client.ts
      components/ CardChoice.tsx HouseCard.tsx KingdomStats.tsx PrivatePanel.tsx
                  AdminChoiceTable.tsx LoadingState.tsx
      pages/ LandingPage.tsx ClaimHousePage.tsx LoginPage.tsx GamePage.tsx AdminPage.tsx
      auth/ playerSession.ts adminSession.ts
      types/ api.ts
      App.tsx main.tsx
    index.html vite.config.ts package.json tsconfig.json
  backend/                     # Lambda + SAM
    src/
      handler.ts router.ts
      auth/ playerAuth.ts adminAuth.ts tokens.ts
      routes/ publicRoutes.ts playerRoutes.ts adminRoutes.ts
      db/ dynamo.ts players.ts choices.ts turns.ts
      validation/ schemas.ts        # request-body validation (clean 400s)
      types/ domain.ts
    template.yaml package.json tsconfig.json
  scripts/validate-content.ts
  docs/superpowers/specs/2026-07-17-ravenloft-winter-mvp-design.md
  README.md
```

Both `frontend` and `backend` import `@ravenloft/content`. Amplify build settings target `frontend/`. SAM bundles the Lambda with esbuild, inlining the shared package. `CONTENT_VERSION` lives once in `shared/` and is returned by `GET /api/campaign` so an old frontend can detect a content mismatch (spec §44).

---

## 5. Shared content model (Turn 1)

Types are exactly as defined in spec §31. Turn 1 content is transcribed **verbatim** from the source spec into typed TS:

- **6 Houses** (`vargen`, `auremont`, `valerius`, `iron-guild`, `pale-bell`, `ravens`): name, subtitle, motto, public + private introduction, leader, strength, weakness, public interest, private objective, private concern.
- **Turn 1** (`A Estrada de Varn`): public event, per-house private information, `stateBefore` (Provisões 6, Força Militar 5, Unidade 5, Ordem Pública 6, Conhecimento 0, Avanço dos Mortos 1), admin resolution notes.
- **18 cards** (3 per House): id, houseId, title, categories, description, contribution, risk/cost, adminTags.
- `publishedResult` is `undefined` (turn unresolved).

---

## 6. Backend design

**Single Lambda** behind an API Gateway HTTP API, with an internal router dispatching to `publicRoutes / playerRoutes / adminRoutes`.

### Auth (no Cognito — HMAC tokens)
- HMAC-signed tokens signed with `TOKEN_SIGNING_SECRET`.
- Player payload `{ type:"player", campaignId, houseId, exp }`; admin payload `{ type:"admin", campaignId, exp }`.
- Signature + expiry validated on every private route. Secret never sent to the frontend. Token kept in `sessionStorage`. Tokens/codes never logged.
- The player never sends `houseId` on `/api/player/game`; the House is derived from the token.

### Player codes
Generated server-side, format `vargen-4K7P` (House prefix + ≥4 random chars), sha256-hashed before storage, shown in full only once at creation.

### DynamoDB — single table `ravenloft-game`
`PAY_PER_REQUEST`, PITR enabled. Keys `PK` (S, HASH) / `SK` (S, RANGE).

| Item | PK | SK |
|---|---|---|
| Campaign meta | `CAMPAIGN#WINTER_DEAD` | `META` |
| House claim | `CAMPAIGN#WINTER_DEAD` | `HOUSE#<HOUSE_ID>` |
| Player profile | `PLAYER#<sha256(code)>` | `PROFILE` |
| Choice | `CAMPAIGN#WINTER_DEAD#TURN#001` | `HOUSE#<HOUSE_ID>` |
| Per-turn status | `CAMPAIGN#WINTER_DEAD#TURN#<NNN>` | `META` (turnStatus OPEN/LOCKED) |

**Atomic claim:** `TransactWriteItems` creates the `HOUSE#…` item with `attribute_not_exists(PK) AND attribute_not_exists(SK)` and the `PLAYER#…` profile together. Conflict → HTTP **409**.

Turn status (OPEN/LOCKED) is stored per **active turn** so it is never reused from a previous turn.

### HTTP API (`/api`)

**Public:** `GET /api/campaign` (title, short intro, public state, active turn, status, **contentVersion**) · `GET /api/houses` (public descriptions + availability, never private intros) · `POST /api/claim-house` → `{ playerCode, playerToken, houseId }` · `POST /api/player/login` → `{ playerToken, houseId, displayName }`.

**Player (Authorization header):** `GET /api/player/me` · `GET /api/player/game` (public + own-House private intro, previous public + own private result, current public event, current private info, 3 cards, current choice, kingdom state, turn status) · `PUT /api/turns/:turnId/choice` (validates token, active turn, turn open, card belongs to House + turn + is one of the 3 options; replaces prior choice while open).

**Admin:** `POST /api/admin/login` (compares hash vs `ADMIN_CODE_HASH`) · `GET /api/admin/dashboard` (houses/players, active turn, status, all choices, indicators, copy-ready summary) · `POST /api/admin/turn/lock` · `POST /api/admin/turn/unlock` · `DELETE /api/admin/turns/:turnId/choices/:houseId` (optional) · `POST /api/admin/houses/:houseId/reset` (optional).

### Request validation
A validation layer (`validation/schemas.ts`) checks request bodies and returns clean 400s. Error responses never expose stack traces or DynamoDB details.

### IAM (least privilege)
Lambda limited to the single table with only: `GetItem, PutItem, UpdateItem, DeleteItem, Query, TransactWriteItems`. No `dynamodb:*` / `Resource: *`.

### CORS
Methods `GET, POST, PUT, DELETE, OPTIONS`; headers `Content-Type, Authorization`. Origin = `http://localhost:5173` (dev) / the Amplify frontend domain (prod).

---

## 7. Frontend design

- **Routes:** `/` landing · `/claim` House selection · `/login` player login · `/game` private area · `/admin` admin login + dashboard. Private routes redirect to `/login` without a valid token.
- **Player screen (vertical, mobile-first):** header (campaign title, House, display name, "Sair") · KingdomStats (6 values) · previous result (only after a turn is resolved) · current event (turn number/title, public narrative, private info) · exactly **3 cards** (name, category, description, contribution, risk/cost, "Escolher esta carta") · current choice with timestamp + "Trocar escolha" while open; when locked shows "O Conselho está resolvendo o turno".
- **House selection:** 6 factions as a grid — name, subtitle, motto, strength summary, "Disponível"/"Escolhida". Private intro never sent before claim + auth. Confirmation before claiming; the generated code is shown prominently once.
- **Admin screen:** code login (no admin code in the bundle) · overview (active turn, status, claimed houses, received choices, indicators) · players table · choices table · actions (lock, unlock, copy summary for Claude Code, optional clear-choice, optional reset-house).
- **Components:** `HouseCard`, `CardChoice`, `KingdomStats`, `PrivatePanel` (visually distinct "private to you"), `AdminChoiceTable`, `LoadingState`.
- **Visual direction (§45):** near-black background, cool-gray surfaces, aged-white text, dark-red/winter-blue accent, metallic-gray borders; serif titles + sans-serif body; comfortable mobile sizes; no heavy animation/video/audio; large clear cards; loading state on every button; confirmation before claim; visual confirmation after save.

### Mandatory interface states (§47)
loading · success · recoverable error · session expired · no published turn · House already taken · turn locked · invalid card · version conflict · offline.

---

## 8. Security & validation rules (§40) — enforced server-side

Prevent: a player requesting another House's private content; choosing a card not in their hand; choosing a card from another turn; changing a choice after lock; two players claiming the same House; the frontend receiving the admin code; the frontend receiving all private info; admin routes used without an admin token; codes/tokens appearing in logs; an old frontend submitting a choice to a new turn (version guard).

---

## 9. Content-update flow (Claude Code, human-resolved)

1. All players submit cards. 2. Admin opens `/admin`, confirms all active Houses chose, clicks **Bloquear turno**, clicks **Copiar resumo**. 3. Admin pastes the summary into Claude Code with the resolution instruction. 4. Claude Code writes: public result, per-House private result, new kingdom state, discoveries, next public event, next-turn private info per House, 3 new cards per House — updating content files, keeping all prior results, incrementing `activeTurnId`, running TypeScript validation + tests. **No automatic resolution.** 5. Admin reviews, commits, redeploys. 6. New deploy shows previous result + next turn; turn status returns to `OPEN`.

Resolved turn stores `publishedResult` in the turn file; the next turn is a new file (`turn-002.ts`); the manifest bumps `activeTurnId`. Old choices are never deleted (each turn is its own partition).

---

## 10. Infrastructure & deployment

- **Backend (SAM `template.yaml`):** `AWS::Serverless::HttpApi` + `AWS::Serverless::Function` + `AWS::DynamoDB::Table` (PAY_PER_REQUEST, PK/SK, PITR on). Table name passed to the Lambda via env var.
- **Frontend:** AWS Amplify Hosting, git-connected auto-deploy; `VITE_API_BASE_URL` env var points at the deployed API.
- **Env vars (never committed):** `TABLE_NAME`, `CAMPAIGN_ID=winter-dead`, `ADMIN_CODE_HASH`, `TOKEN_SIGNING_SECRET`, `ALLOWED_ORIGIN`, `AWS_REGION=us-east-1`.
- **Local dev:** frontend `npm run dev`; backend `sam build && sam local start-api`; optional DynamoDB Local. Local tests never point at the production table by default.

---

## 11. Testing

- **Backend (§50):** claim available House · reject already-claimed House (409) · login valid code · reject invalid code · player receives only own-House content · save valid choice · reject other-House card · replace choice while open · reject change when locked · admin sees all choices · player cannot reach admin endpoint.
- **Frontend:** lists Houses · shows unavailability · stores session token · renders 3 cards · confirms choice · blocks selection when locked · dashboard shows received choices.
- **Content — `scripts/validate-content.ts`:** all six Houses exist · each House has exactly three cards in the turn · all card IDs unique · all referenced cards exist · active turn has private content for every House · published result has valid 0–10 state · active turn has no published result · previous turns have published results.

---

## 12. Acceptance criteria (MVP)

**Player:** can see available Houses; claim a free House; receive a simple code; log back in with it; see only their House's private intro; see the public event; see exactly three cards; select one; choice persists across refresh; change choice while open; cannot change after lock.

**Admin:** admin code never in the frontend; can log in; sees who claimed each House; sees all selected cards; can copy the summary; can lock/unlock the turn; a normal player cannot access admin data.

**Content:** Claude Code can add a new turn without changing DB structure; a new deploy shows the previous result and the new event/cards; old-turn choices remain in DynamoDB; the backend rejects cards not belonging to the active content version.

---

## 13. Build order (verification checkpoints)

1. **Phase 1 — Content + static frontend:** Vite/React/TS project; shared types + Turn 1 content; Landing/Claim/Login/Game/Admin pages against a mock API; responsive check.
2. **Phase 2 — Backend + DynamoDB:** SAM template + table; Lambda routing; code generation + hashing; tokens; atomic claim; login; choices.
3. **Phase 3 — Administration:** admin login; dashboard; lock/unlock; copyable summary; optional reset.
4. **Phase 4 — Deploy:** deploy backend; configure CORS; deploy frontend (Amplify); set `VITE_API_BASE_URL`; run prod smoke tests; claim test Houses then clean the table.

---

## 14. Additions beyond the spec (approved)

- Backend request-body validation layer for clean 400 responses.
- Top-level npm scripts (`dev`, `build`, `test`, `validate-content`, `deploy`) so each step of the flow is one command.

---

## 15. Intellectual property

Unofficial fan project inspired by Ravenloft and political fantasy. If published, include a fan-project note and avoid copying official images, logos, or text. The domain, Houses, characters, and narrative in the source spec are original.
