# Ravenloft: O Inverno dos Mortos — Narrative House Redesign

**Date:** 2026-07-18
**Status:** Approved (brainstorming complete)

## Overview

Redesign the game from a fixed 6-house, pick-a-card experience into a
player-driven narrative-strategy game where each player **creates their own
Great House** and, each turn, **writes their own free-text orders**. House
attributes stop being action currency and become **constraints** that define
what a plan can plausibly achieve. Pre-made action cards are replaced by
**narrative cards** (a constraint + a narrative question + an open
consequence). An embedded, **human-in-the-loop OpenAI** flow drafts turn
content and resolutions; the admin reviews/edits everything and clicks
**RODAR TURNO** to resolve.

This is a full **A + B + C** redesign on **Approach A** (reuse the existing
DynamoDB single-table + Lambda backend + MUI React frontend; no new
microservice; the browser never calls OpenAI directly).

## Goals

- Players create custom Houses (identity + emblem + 4 attributes via point-buy).
- Free-text turn orders; attributes as constraints, not menu choices.
- Narrative cards with three parts + a machine-readable constraint.
- Admin composes, opens, locks, and resolves turns (human-in-the-loop AI).
- Fresh start: remove the 6 fixed houses and kingdom-wide state.

## Non-Goals

- No image upload for crests (preset icon + two preset colors only).
- No automatic AI application — the admin approves every change.
- No player-to-player messaging or real-time updates (poll on load).
- No migration of existing players (campaign is reset clean).

---

## Section 1 — Data Model

All records live under the campaign partition in the existing single table
`ravenloft-game`. Key builders extend `backend/src/keys.ts`.

### Player / Account
- `PK = PLAYER#<codeHash>`, `SK = PROFILE`
- Fields: `displayName`, `codeHash`, `houseId`, `createdAt`
- Login is by secret code (hashed); one house per account.

### House (player-created)
- `PK = CAMPAIGN#<id>`, `SK = HOUSE#<houseId>`
- `houseId` = generated slug (e.g. `vargen-a1b2`) — **runtime string**, not an enum.
- Fields:
  - `name`, `motto`
  - `emblem { icon, color1, color2 }` (icon from a preset list)
  - `leaderName`, `heirName`, `castleName`, `townsText`
  - `historyText`, `specialty`, `weakness`
  - `attributes { riqueza, recursos, soldados, controle }` (each 0–5)
  - `ownerCodeHash`, `createdAt`

### Turn
- `PK = CAMPAIGN#<id>`, `SK = TURN#<nnn>`
- Fields:
  - `status`: `DRAFT | OPEN | LOCKED | RESOLVED`
  - `publicEvent` (text)
  - `privateInfo`: `{ [houseId]: string }`
  - `cards`: array of narrative cards (see below)
  - `createdAt`
- On resolution, results are stored on the turn:
  - `publicResult`, `houseResults { [houseId]: string }`
  - `attributeDeltas { [houseId]: { [attr]: int } }`
  - `discoveries: string[]`

### Narrative Card
```
{
  id,
  title,
  constraintText,      // "o que permite"
  narrativeQuestion,
  consequenceText,     // open consequence
  spend?:  { attribute, max },        // spend card
  choice?: { attributes: string[], amount }  // choice card
}
```
Exactly one of `spend` / `choice` is present.

### Submission
- `PK = CAMPAIGN#<id>`, `SK = TURN#<nnn>#SUB#<houseId>`
- Fields:
  - `orderText` (required free text)
  - `cardResponses`: `[{ cardId, declaredSpend? | declaredChoice?, text }]`
  - `submittedAt`

### Campaign config
- Optional `maxHouses` (admin-configurable; default unlimited).

---

## Section 2 — Landing + Account + House Creation

**Landing (`/`)** — three CTAs over the fog theme:
- **Criar conta**, **Entrar** (já tenho código), **Entrar como Admin**.

**Create account → house wizard (`/criar`):**
1. **Conta** — display name → system generates the secret code, shown once
   ("guarde este código").
2. **Identidade da Casa** — name, motto, emblem (preset icon + 2 colors →
   rendered crest), leaderName, heirName, castleName, towns, history,
   specialty, weakness.
3. **Atributos** — point-buy of **10 points** across Riqueza / Recursos /
   Soldados / Controle, each 0–5, live "Pontos restantes: N". Confirm disabled
   until sum = 10 and none > 5.
4. **Review → Fundar a Casa** — persists house + player profile atomically,
   saves the session, routes into the game. A read-only **Casa Vargen** example
   is available for inspiration.

**Entrar (`/login`)** — existing code-based login, reworded.

**API changes (`ApiClient`):**
- `createAccountAndHouse(input) → { playerCode, playerToken, houseId }`
  (replaces `claimHouse`)
- `getHouseExample() → HouseExample` (read-only Casa Vargen sample)
- `login` unchanged
- `getHouses` becomes admin-facing

Validation enforced client-side and in backend `validation/schemas.ts`.

---

## Section 3 — Player Turn Loop

When a turn is **OPEN**, `/game` shows:
- **Sua Casa** — crest + the four attributes as 0–5 bars (reference/constraint).
- **Evento público** — turn public event text.
- **Informação privada da sua Casa** — private info for this house.
- **Cartas narrativas** (0+) — each renders the three parts plus a structured
  control:
  - spend card → stepper `0…max`, also capped at the house's current attribute
    value;
  - choice card → radio among offered attributes;
  - plus a narrative text box per card.
- **Sua ordem** — one required free-text box.
- **Enviar ordem** — saves the submission, editable while OPEN.

States: **LOCKED/resolving** disables inputs ("O Conselho está resolvendo o
turno."); **RESOLVED** shows public result + this house's private result, then
the next turn opens.

Client validates declared spends against current attributes; backend
re-validates on submit. Only the house owner may submit; only OPEN turns accept
submissions.

---

## Section 4 — Admin Flow ("RODAR TURNO")

Dashboard `/admin`. Turn lifecycle: **DRAFT → OPEN → LOCKED → RESOLVED**.

1. **Compose (DRAFT):** author `publicEvent`, per-house `privateInfo` (AI draft
   available), and narrative cards (title, constraintText, narrativeQuestion,
   consequenceText, spend/choice). **Abrir turno** → OPEN.
2. **Monitor (OPEN):** live roster of submitted/not-submitted; read
   submissions. **Trancar turno** → LOCKED.
3. **Resolve (LOCKED → RESOLVED) = RODAR TURNO:**
   - **Rascunhar resolução (IA)** → backend sends submissions + attributes to
     OpenAI → draft `{ publicResult, houseResults, attributeDeltas }`.
   - Draft lands in **editable fields**; admin rewrites text and adjusts deltas.
   - **Aplicar e publicar** → applies deltas to houses, stores results, sets
     RESOLVED, creates the next turn as DRAFT.

Admin edit powers: edit any house's attributes, any submission text, any AI
draft. Nothing applies without explicit "Aplicar".

**New API:** `adminComposeTurn`, `adminOpenTurn`, `adminLockTurn`,
`adminDraftResolution`, `adminApplyResolution`, `adminEditHouse`,
`adminDraftPrivateInfo`. All gated by the admin code + correct status.

---

## Section 5 — OpenAI Integration

Backend module `backend/src/ai/openai.ts`. Browser never calls OpenAI.

**Draft endpoints** (drafts only, never auto-applied):
1. **Draft private info** (during DRAFT) — input: premise + houses (identity +
   attributes) + last results + new public event → a private-info paragraph per
   house.
2. **Draft resolution** (during LOCKED) — input: premise + public event + house
   attributes + all submissions (order + card declarations + narrative) →
   JSON `{ publicResult, houseResults{houseId→text},
   attributeDeltas{houseId→{attr→int}} }`.

Prompt encodes the core rule: **attributes are constraints — a plan is only as
plausible as the house's attributes allow**. Deltas stay small (≈ −2…+1) and
must be justified by the narrative.

**Model/format:** single configurable model (default `gpt-4o-mini`, override via
env), `response_format: json_object` for resolution parsing, modest temperature.

**Key handling:** stored ONLY as a gitignored Lambda env var (like the existing
admin-code secret), passed at deploy — never in source or committed files. ⚠️
The key pasted in chat must be rotated at platform.openai.com/api-keys before
deploy.

**Failure/cost:** on error/timeout/unparseable JSON, return a clear error; the
admin can retry or write the resolution by hand. Game never blocks on AI. Calls
only fire on explicit admin clicks.

---

## Section 6 — Testing, Migration, Phasing

**Kingdom-state removal:** the 6-attribute `KingdomState` is removed; only the
per-house 4 attributes remain. Fixed-house content (`shared/src/houses.ts`,
pre-authored turns) removed from playable content; Casa Vargen text kept only as
the creation example.

**Fresh-start reset:** clear existing houses/claims/turns; seed one empty
campaign with an initial DRAFT turn. No players to migrate.

**Max house slots:** admin-configurable, default unlimited (practically ~8).

**Validation (`validation/schemas.ts`):** displayName 1–40 chars; house
name/motto/fields length-capped; attributes integers 0–5 summing to 10 at
creation; declared spends ≤ card max and ≤ current attribute value; choice ∈
offered attributes; owner-only submit; OPEN-only submissions; admin actions
gated by admin code + valid status transitions.

**Testing:** unit tests for point-buy/attribute validators, submission
validation, resolution JSON parser (mock OpenAI); shared/backend/frontend suites
green. Per the pre-deploy skill: Playwright visual smoke (landing 3 CTAs →
create account+house → game screen; admin login → compose/open/resolve draft) +
screenshot inspection before any deploy.

**Phasing:**
1. Shared types + data model + validators.
2. Backend: account/house creation, submissions, admin compose/open/lock.
3. Backend: OpenAI drafts + apply resolution.
4. Frontend: landing + creation wizard.
5. Frontend: player turn loop.
6. Frontend: admin dashboard.
7. Reset/seed + full test + visual smoke + deploy.
