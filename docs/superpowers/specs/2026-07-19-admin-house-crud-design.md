# Admin House CRUD — Design

Date: 2026-07-19
Status: Approved (pending spec review)

## Goal

Give the admin full control over Houses: **create** new Houses, **edit every
field** of existing Houses, and **delete** Houses. Scope is limited to Houses
(not turns, players, or submissions as standalone entities — though deleting a
House cascades to its player account and submissions).

## Decisions (from brainstorming)

1. **Scope:** Houses only — full create / edit-all-fields / delete.
2. **Delete semantics:** cascade — delete the House **+** its linked player
   account (`PLAYER#<ownerCodeHash>/PROFILE`) **+** all of that House's
   submissions (`TURN#<nnn>#SUB#<houseId>` across all turns).
3. **Admin create:** generates a player login code (like the public signup),
   returned to the admin so they can hand it to a player. The House is playable.
4. **Attributes:** admin uses **free mode** — each attribute an integer 0–5,
   **no** 10-point-total requirement (players still use the 10-point budget).
5. **`displayName`:** lives on the player account, not the House. Out of scope
   for House editing.
6. **`/api/admin/house/edit`** (attributes-only, enforced 10-point budget) is
   **removed** and superseded by the new full `update` endpoint.

## Data model (existing single-table DynamoDB `ravenloft-game`)

A House spans three item types:

- **House:** `PK=CAMPAIGN#WINTER_DEAD`, `SK=HOUSE#<houseId>`, all House fields +
  `ownerCodeHash`.
- **Player account:** `PK=PLAYER#<codeHash>`, `SK=PROFILE`,
  `{ houseId, displayName, codeHash }`.
- **Submissions:** `PK=CAMPAIGN#WINTER_DEAD`, `SK=TURN#<nnn>#SUB#<houseId>`.

## Backend

### shared

- Add `validateAttributeRanges(attrs): ValidationResult` in
  `shared/src/attributes.ts` — each attribute is an integer within `ATTR_MIN..ATTR_MAX`
  (0–5), **without** the `POINT_BUDGET` sum check. `validateAttributes`
  (budget) stays for the player flow.

### `backend/src/validation/schemas.ts`

- Add `parseAdminAttributes(raw)` using `validateAttributeRanges` (free 0–5).
- Add `parseAdminCreateHouseBody(body)` — all House fields (same as
  `parseCreateHouseBody`) + `displayName`, but attributes via
  `parseAdminAttributes`.
- Add `parseAdminUpdateHouseBody(body)` — `houseId` + all editable House fields,
  attributes via `parseAdminAttributes`.
- Add `parseAdminDeleteHouseBody(body)` — `{ houseId }`.
- Remove `parseEditHouseBody`.

### `backend/src/db/houses.ts`

- **Create:** reuse `createAccountAndHouse` (already stores House + player
  profile transactionally). No change needed to the db function.
- **`updateHouseFull(doc, table, campaign, houseId, fields)`** — `UpdateCommand`
  (or conditional Put) that sets name, motto, emblem, leaderName, heirName,
  castleName, townsText, historyText, specialty, weakness, attributes. Preserves
  `PK`, `SK`, `houseId`, `ownerCodeHash`, `createdAt`. Uses a
  `ConditionExpression: attribute_exists(SK)` so updating a missing House 404s.
- **`deleteHouseCascade(doc, table, campaign, houseId)`** —
  1. `getHouse` → obtain `ownerCodeHash` (404 if missing).
  2. Query campaign items with `begins_with(SK, "TURN#")`; filter to
     `SK` ending in `#SUB#<houseId>`.
  3. Batch-delete (chunks of 25): the House item, the submissions, and
     `PLAYER#<ownerCodeHash>/PROFILE` (if `ownerCodeHash` present).
  4. Return `{ deleted }` count.
  - Note: `getHouse` currently returns `House` without `ownerCodeHash`. Add an
    internal helper (or extend the item read) to obtain `ownerCodeHash` for the
    delete path without changing the public `House` type.

### `backend/src/routes/adminRoutes.ts`

- **`createHouse`** — `requireAdmin`; parse body; generate `playerCode` via
  `generatePlayerCode(prefix from name)`; `hashCode`; `createAccountAndHouse`;
  return `200 { houseId, playerCode }`.
- **`updateHouse`** — `requireAdmin`; parse; `updateHouseFull`; `204`.
- **`deleteHouse`** — `requireAdmin`; parse; `deleteHouseCascade`;
  `200 { deleted }`.
- Remove `editHouse`.

### `backend/src/router.ts`

- `POST /api/admin/house/create` → `createHouse`
- `POST /api/admin/house/update` → `updateHouse`
- `POST /api/admin/house/delete` → `deleteHouse`
- Remove `POST /api/admin/house/edit`.

## Frontend

### `shared`/types + api layer

- `client.ts` interface: add `adminCreateHouse(token, input) => { houseId, playerCode }`,
  `adminUpdateHouse(token, input) => void`, `adminDeleteHouse(token, houseId) => { deleted }`;
  remove `adminEditHouse`.
- Implement in `httpClient.ts` and `mockClient.ts` (mock: create adds to the
  in-memory maps and returns a code; update mutates; delete cascades in-memory).

### `frontend/src/components/HouseForm.tsx` (new)

- Renders all House fields: name, motto, emblem (icon + color1 + color2 selects
  with color names), leaderName, heirName, castleName, townsText, historyText,
  specialty, weakness, and the attribute editor.
- Props: `value: HouseFormValue`, `onChange`, `attributeMode: "budget" | "free"`.
- `PointBuy` gains a `freeMode?: boolean` prop: when true, no "pontos restantes"
  gate and no total requirement (each attribute 0–5 steppers).
- `CreateHousePage` refactored to compose its identity + attributes steps from
  `HouseForm` (attributeMode `"budget"`), preserving current player behavior.

### `frontend/src/pages/AdminPage.tsx`

Replace the "Editar atributos das Casas" card with **"Gerenciar Casas"**:

- **List** each House with **Editar** and **Deletar** buttons.
- **Editar** → expands a `HouseForm` (free mode) prefilled from the House;
  **Salvar** → `adminUpdateHouse`, then refresh + notice.
- **Deletar** → confirmation `Dialog` (warns it removes the player account +
  submissions) → `adminDeleteHouse`, refresh + notice.
- **Adicionar Casa** → `HouseForm` (free mode) + a `displayName` field →
  `adminCreateHouse`; on success show the generated **player code** in a Dialog.

## Testing (TDD)

- **shared:** `validateAttributeRanges` — accepts free 0–5, rejects out-of-range
  and non-integers; does not require sum 10.
- **backend db:** `deleteHouseCascade` deletes House + player + that House's
  submissions only (leaves other Houses/players/submissions); 404 on missing.
  `updateHouseFull` overwrites fields, preserves `ownerCodeHash`/`createdAt`,
  404 on missing.
- **backend routes:** `createHouse` returns `{ houseId, playerCode }`;
  `updateHouse` → 204; `deleteHouse` → `{ deleted }`; each requires admin (401
  without token); attributes validated with free mode.
- **frontend:** `HouseForm` renders and edits fields in both modes; `AdminPage`
  — create shows the generated code, edit calls `adminUpdateHouse`, delete
  confirms and calls `adminDeleteHouse`. Update all client mocks
  (remove `adminEditHouse`, add the three new methods).

## Verification & deploy

- `npm run build --workspace shared`; backend `npx vitest run`; frontend
  `npx vitest run` + `npx tsc --noEmit`; frontend `npm run build`.
- Deploy backend (SAM) and frontend (Amplify) per the established manual steps.

## Out of scope

- Editing/deleting turns, submissions, or player accounts as standalone
  entities.
- Editing player `displayName`.
- Removing attribute upper bound (kept at 5).
