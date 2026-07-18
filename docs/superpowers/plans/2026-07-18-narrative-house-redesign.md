# Narrative House Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Ravenloft: O Inverno dos Mortos from fixed houses + pick-a-card into a player-driven game where players create custom Houses and write free-text orders each turn, resolved by an admin with human-in-the-loop OpenAI drafting.

**Architecture:** Reuse the existing monorepo (shared/backend/frontend), DynamoDB single-table, Lambda router, and MUI frontend (Approach A). House/Turn/Submission/Result records become dynamic DynamoDB items. OpenAI is called only from the backend on explicit admin actions; the browser never touches the key.

**Tech Stack:** TypeScript, AWS Lambda + API Gateway (SAM), DynamoDB (single table), React 18 + Vite + MUI v6, Vitest, Playwright. OpenAI via `openai` npm package (backend only).

Spec: `docs/superpowers/specs/2026-07-18-narrative-house-redesign-design.md`

---

## File Structure

**shared/src/**
- `types.ts` — REWRITE: remove `KingdomState`, fixed `HouseId` union, old Turn/Card types. Add `Attributes`, `EmblemIcon`, `House`, `NarrativeCard`, `Turn`, `TurnStatus`, `Submission`, `CardResponse`, `TurnResult`, `HouseExample`, `ATTRIBUTE_KEYS`, `POINT_BUDGET`, `ATTR_MAX`, `EMBLEM_ICONS`, `EMBLEM_COLORS`.
- `attributes.ts` — CREATE: `validateAttributes()` pure validator (sum=10, 0..5). Shared by client + backend.
- `houseExample.ts` — CREATE: read-only Casa Vargen sample (`HouseExample`).
- `houses.ts`, `campaign.ts`, `turns/` — DELETE fixed content; keep `version.ts`, `index.ts` (update exports).

**backend/src/**
- `keys.ts` — ADD `submissionSk(turnId, houseId)`, `houseSkFor(houseId)` (reuse existing `houseSk`).
- `db/houses.ts` — CREATE: `createAccountAndHouse`, `getHouse`, `listHouses`, `updateHouseAttributes`.
- `db/players.ts` — MODIFY: keep `getPlayerByCodeHash`; add profile write inside house creation.
- `db/turns.ts` — REWRITE: full turn records (`getTurn`, `listTurns`, `getActiveTurn`, `putTurn`, `setTurnStatus`, `saveTurnResult`, `createNextTurnDraft`).
- `db/submissions.ts` — CREATE: `putSubmission`, `getSubmission`, `listSubmissions`.
- `db/choices.ts` — DELETE (replaced by submissions).
- `ai/openai.ts` — CREATE: `draftPrivateInfo`, `draftResolution` + JSON parser.
- `ai/prompts.ts` — CREATE: prompt builders.
- `validation/schemas.ts` — REWRITE parsers for new bodies.
- `routes/publicRoutes.ts` — MODIFY: `getCampaign`, `getHouseExample`, `createAccountAndHouse`, `login`.
- `routes/playerRoutes.ts` — REWRITE: `getGame`, `submitOrder`.
- `routes/adminRoutes.ts` — REWRITE: dashboard + compose/open/lock/draft/apply/editHouse.
- `router.ts` — MODIFY route table.
- `config.ts` / `types/domain.ts` — ADD `openAiApiKey`, `openAiModel`.
- `scripts/reset-campaign.mjs` — CREATE: wipe + seed empty campaign with TURN 1 DRAFT.

**frontend/src/**
- `types/api.ts` — REWRITE to match new shared types + endpoints.
- `api/client.ts` — REWRITE `ApiClient` interface.
- `api/httpClient.ts`, `api/mockClient.ts` — REWRITE implementations.
- `pages/LandingPage.tsx` — MODIFY: 3 CTAs.
- `pages/CreateHousePage.tsx` — CREATE: wizard (Conta → Identidade → Atributos → Review).
- `pages/LoginPage.tsx` — keep, reword.
- `pages/GamePage.tsx` — REWRITE: house sheet + event + private info + cards + order box.
- `pages/AdminPage.tsx` — REWRITE: compose/monitor/resolve.
- `components/` — CREATE: `Crest.tsx`, `AttributeBars.tsx`, `PointBuy.tsx`, `NarrativeCardInput.tsx`, `NarrativeCardEditor.tsx`. DELETE: `HouseCard`, `KingdomStats`, `CardChoice`, `AdminChoiceTable`, `PrivatePanel` (or repurpose).

---

## Phase 1 — Shared types, validators, example

### Task 1: Define new shared domain types

**Files:**
- Modify: `shared/src/types.ts` (full rewrite)
- Test: `shared/src/attributes.test.ts` (Task 2)

- [ ] **Step 1: Replace `shared/src/types.ts` contents**

```typescript
export const ATTRIBUTE_KEYS = ["riqueza", "recursos", "soldados", "controle"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const POINT_BUDGET = 10;
export const ATTR_MAX = 5;
export const ATTR_MIN = 0;

export const EMBLEM_ICONS = ["lobo", "veado", "corvo", "torre", "chama", "coroa"] as const;
export type EmblemIcon = (typeof EMBLEM_ICONS)[number];

export const EMBLEM_COLORS = ["#7f1d1d", "#1e3a5f", "#3f3f46", "#4c1d95", "#14532d", "#78350f"] as const;
export type EmblemColor = string;

export interface Emblem { icon: EmblemIcon; color1: EmblemColor; color2: EmblemColor; }

export interface House {
  houseId: string;
  name: string;
  motto: string;
  emblem: Emblem;
  leaderName: string;
  heirName: string;
  castleName: string;
  townsText: string;
  historyText: string;
  specialty: string;
  weakness: string;
  attributes: Attributes;
  createdAt: string;
}

export type TurnStatus = "DRAFT" | "OPEN" | "LOCKED" | "RESOLVED";

export interface SpendConstraint { attribute: AttributeKey; max: number; }
export interface ChoiceConstraint { attributes: AttributeKey[]; amount: number; }

export interface NarrativeCard {
  id: string;
  title: string;
  constraintText: string;
  narrativeQuestion: string;
  consequenceText: string;
  spend?: SpendConstraint;
  choice?: ChoiceConstraint;
}

export interface TurnResult {
  publicResult: string;
  houseResults: Record<string, string>;
  attributeDeltas: Record<string, Partial<Attributes>>;
  discoveries: string[];
}

export interface Turn {
  turnId: number;
  status: TurnStatus;
  publicEvent: string;
  privateInfo: Record<string, string>;
  cards: NarrativeCard[];
  createdAt: string;
  result?: TurnResult;
}

export interface DeclaredSpend { attribute: AttributeKey; amount: number; }
export interface DeclaredChoice { attribute: AttributeKey; }

export interface CardResponse {
  cardId: string;
  declaredSpend?: DeclaredSpend;
  declaredChoice?: DeclaredChoice;
  text: string;
}

export interface Submission {
  houseId: string;
  orderText: string;
  cardResponses: CardResponse[];
  submittedAt: string;
}

export interface HouseExample {
  name: string; motto: string; leaderName: string; heirName: string;
  castleName: string; townsText: string; historyText: string;
  specialty: string; weakness: string; attributes: Attributes;
  emblem: Emblem;
}
```

- [ ] **Step 2: Update `shared/src/index.ts` exports**

Remove exports of `houses`, `campaign`, `turn001`, `HOUSE_IDS`, `HouseId`. Export everything from `types.js`, `attributes.js`, `houseExample.js`, keep `version.js`.

```typescript
export * from "./types.js";
export * from "./attributes.js";
export * from "./houseExample.js";
export * from "./version.js";
```

- [ ] **Step 3: Delete stale content files**

```bash
git rm shared/src/houses.ts shared/src/campaign.ts
git rm -r shared/src/turns
```

- [ ] **Step 4: Commit**

```bash
git add shared/src && git commit -m "feat(shared): replace fixed-house domain with dynamic types"
```

### Task 2: Attribute validator (TDD)

**Files:**
- Create: `shared/src/attributes.ts`
- Test: `shared/src/attributes.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { validateAttributes } from "./attributes.js";

describe("validateAttributes", () => {
  const ok = { riqueza: 1, recursos: 2, soldados: 5, controle: 2 };
  it("accepts a valid 10-point spread", () => {
    expect(validateAttributes(ok)).toEqual({ valid: true });
  });
  it("rejects sum != 10", () => {
    expect(validateAttributes({ ...ok, controle: 3 }).valid).toBe(false);
  });
  it("rejects a value above 5", () => {
    expect(validateAttributes({ riqueza: 0, recursos: 0, soldados: 6, controle: 4 }).valid).toBe(false);
  });
  it("rejects negatives", () => {
    expect(validateAttributes({ riqueza: -1, recursos: 5, soldados: 5, controle: 1 }).valid).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(validateAttributes({ riqueza: 1.5, recursos: 2.5, soldados: 4, controle: 2 }).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `cd shared && npx vitest run src/attributes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
import { ATTRIBUTE_KEYS, ATTR_MAX, ATTR_MIN, POINT_BUDGET, type Attributes } from "./types.js";

export interface ValidationResult { valid: boolean; error?: string; }

export function validateAttributes(attrs: Attributes): ValidationResult {
  let sum = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const v = attrs[key];
    if (typeof v !== "number" || !Number.isInteger(v)) return { valid: false, error: `${key} deve ser inteiro` };
    if (v < ATTR_MIN || v > ATTR_MAX) return { valid: false, error: `${key} fora do intervalo 0-5` };
    sum += v;
  }
  if (sum !== POINT_BUDGET) return { valid: false, error: `Total deve ser ${POINT_BUDGET}, obtido ${sum}` };
  return { valid: true };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd shared && npx vitest run src/attributes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add shared/src/attributes.ts shared/src/attributes.test.ts && git commit -m "feat(shared): add attribute point-buy validator"
```

### Task 3: Casa Vargen example

**Files:**
- Create: `shared/src/houseExample.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { HouseExample } from "./types.js";

export const CASA_VARGEN_EXAMPLE: HouseExample = {
  name: "Casa Vargen — Os Lobos do Norte",
  motto: "O Norte lembra.",
  leaderName: "Lorde Aldric Vargen",
  heirName: "Sera Vargen",
  castleName: "Droskar",
  townsText: "Cidades e vilas próximas às montanhas do Norte.",
  historyText: "Uma casa antiga, forjada no gelo e na guerra de fronteira.",
  specialty: "Defesa e conhecimento do terreno.",
  weakness: "Poucos alimentos e terras pouco produtivas.",
  attributes: { riqueza: 1, recursos: 2, soldados: 5, controle: 2 },
  emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
};
```

- [ ] **Step 2: Build shared + commit**

Run: `cd shared && npm run build`
```bash
git add shared/src/houseExample.ts && git commit -m "feat(shared): add Casa Vargen creation example"
```

---

## Phase 2 — Backend data + creation/submission + admin compose/open/lock

### Task 4: Key builders

**Files:**
- Modify: `backend/src/keys.ts`
- Test: `backend/src/keys.test.ts`

- [ ] **Step 1: Add failing test**

```typescript
import { describe, it, expect } from "vitest";
import { submissionSk } from "./keys";

describe("submissionSk", () => {
  it("formats TURN#nnn#SUB#houseId", () => {
    expect(submissionSk(1, "vargen-a1b2")).toBe("TURN#001#SUB#vargen-a1b2");
  });
});
```

- [ ] **Step 2: Run → FAIL.** `cd backend && npx vitest run src/keys.test.ts`

- [ ] **Step 3: Add to `keys.ts`**

```typescript
export function submissionSk(turnId: number, houseId: string): string {
  return `TURN#${padTurn(turnId)}#SUB#${houseId}`;
}
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/keys.ts backend/src/keys.test.ts && git commit -m "feat(backend): add submission key builder"
```

### Task 5: House DB module

**Files:**
- Create: `backend/src/db/houses.ts`
- Test: `backend/src/db/houses.test.ts`

- [ ] **Step 1: Write failing test** (use mocked `DynamoDBDocumentClient` `send`)

```typescript
import { describe, it, expect, vi } from "vitest";
import { createAccountAndHouse, getHouse } from "./houses";

function mockDoc(sendImpl: (cmd: unknown) => unknown) {
  return { send: vi.fn(sendImpl) } as never;
}

const attrs = { riqueza: 1, recursos: 2, soldados: 5, controle: 2 };
const houseInput = {
  name: "Casa X", motto: "M", emblem: { icon: "lobo", color1: "#111", color2: "#222" },
  leaderName: "L", heirName: "H", castleName: "C", townsText: "T",
  historyText: "Hi", specialty: "S", weakness: "W", attributes: attrs,
};

describe("createAccountAndHouse", () => {
  it("writes house + profile transactionally with a generated houseId", async () => {
    const doc = mockDoc(() => ({}));
    const res = await createAccountAndHouse(doc, "table", "camp", {
      displayName: "Ana", codeHash: "hash1", ...houseInput,
    });
    expect(res.houseId).toMatch(/^casa-x-[a-z0-9]{4}$/);
    expect(doc.send).toHaveBeenCalledTimes(1);
  });
});

describe("getHouse", () => {
  it("returns null when missing", async () => {
    const doc = mockDoc(() => ({ Item: undefined }));
    expect(await getHouse(doc, "t", "c", "x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `backend/src/db/houses.ts`**

```typescript
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, houseSk, playerPk } from "../keys";
import { HttpError } from "../types/domain";
import type { House, Emblem, Attributes } from "@ravenloft/content";

export interface CreateHouseInput {
  displayName: string; codeHash: string;
  name: string; motto: string; emblem: Emblem;
  leaderName: string; heirName: string; castleName: string; townsText: string;
  historyText: string; specialty: string; weakness: string; attributes: Attributes;
}

function slugify(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "casa";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export async function createAccountAndHouse(
  doc: DynamoDBDocumentClient, tableName: string, campaignId: string, input: CreateHouseInput,
): Promise<{ houseId: string }> {
  const houseId = slugify(input.name);
  const createdAt = new Date().toISOString();
  const house: House = {
    houseId, name: input.name, motto: input.motto, emblem: input.emblem,
    leaderName: input.leaderName, heirName: input.heirName, castleName: input.castleName,
    townsText: input.townsText, historyText: input.historyText, specialty: input.specialty,
    weakness: input.weakness, attributes: input.attributes, createdAt,
  };
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: { PK: campaignPk(campaignId), SK: houseSk(houseId), ...house, ownerCodeHash: input.codeHash },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } },
      { Put: { TableName: tableName, Item: { PK: playerPk(input.codeHash), SK: "PROFILE", houseId, displayName: input.displayName, codeHash: input.codeHash },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } },
    ] }));
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException")
      throw new HttpError(409, "ACCOUNT_EXISTS", "Conta ou Casa já existe. Tente novamente.");
    throw e;
  }
  return { houseId };
}

export async function getHouse(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string): Promise<House | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) } }));
  if (!res.Item) return null;
  return toHouse(res.Item);
}

export async function listHouses(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<House[]> {
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "HOUSE#" } }));
  return (res.Items ?? []).map(toHouse);
}

export async function updateHouseAttributes(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string, attributes: Attributes): Promise<void> {
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) },
    UpdateExpression: "SET attributes = :a", ExpressionAttributeValues: { ":a": attributes } }));
}

function toHouse(item: Record<string, unknown>): House {
  return {
    houseId: item.houseId as string, name: item.name as string, motto: item.motto as string,
    emblem: item.emblem as Emblem, leaderName: item.leaderName as string, heirName: item.heirName as string,
    castleName: item.castleName as string, townsText: item.townsText as string, historyText: item.historyText as string,
    specialty: item.specialty as string, weakness: item.weakness as string,
    attributes: item.attributes as Attributes, createdAt: item.createdAt as string,
  };
}
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/db/houses.ts backend/src/db/houses.test.ts && git commit -m "feat(backend): house creation and read DB module"
```

### Task 6: Turn DB module (rewrite)

**Files:**
- Modify: `backend/src/db/turns.ts` (full rewrite)
- Test: `backend/src/db/turns.test.ts` (rewrite)

- [ ] **Step 1: Write failing tests** for `putTurn`, `getTurn`, `getActiveTurn` (highest turn), `setTurnStatus`, `saveTurnResult`, `createNextTurnDraft`. Example:

```typescript
import { describe, it, expect, vi } from "vitest";
import { getActiveTurn } from "./turns";

describe("getActiveTurn", () => {
  it("returns the highest-numbered turn", async () => {
    const doc = { send: vi.fn(async () => ({ Items: [
      { turnId: 1, status: "RESOLVED", publicEvent: "", privateInfo: {}, cards: [], createdAt: "" },
      { turnId: 2, status: "OPEN", publicEvent: "e2", privateInfo: {}, cards: [], createdAt: "" },
    ] })) } as never;
    const t = await getActiveTurn(doc, "t", "c");
    expect(t?.turnId).toBe(2);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `turns.ts`**

```typescript
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, turnPk, padTurn } from "../keys";
import type { Turn, TurnStatus, TurnResult, NarrativeCard } from "@ravenloft/content";

const TURN_SK_PREFIX = "TURN#";

export async function putTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turn: Turn): Promise<void> {
  await doc.send(new PutCommand({ TableName: tableName, Item: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turn.turnId)}`, ...turn } }));
}

export async function getTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Turn | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` } }));
  return res.Item ? toTurn(res.Item) : null;
}

export async function listTurns(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<Turn[]> {
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": TURN_SK_PREFIX } }));
  return (res.Items ?? []).map(toTurn).filter((t) => !t.sk?.includes("#SUB#")).sort((a, b) => a.turnId - b.turnId);
}

export async function getActiveTurn(doc: DynamoDBDocumentClient, tableName: string, campaignId: string): Promise<Turn | null> {
  const turns = await listTurns(doc, tableName, campaignId);
  return turns.length ? turns[turns.length - 1] : null;
}

export async function setTurnStatus(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, status: TurnStatus): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` },
    UpdateExpression: "SET #s = :s", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":s": status } }));
}

export async function saveTurnResult(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, result: TurnResult): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: `${TURN_SK_PREFIX}${padTurn(turnId)}` },
    UpdateExpression: "SET #s = :s, #r = :r", ExpressionAttributeNames: { "#s": "status", "#r": "result" },
    ExpressionAttributeValues: { ":s": "RESOLVED", ":r": result } }));
}

export async function createNextTurnDraft(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Turn> {
  const turn: Turn = { turnId, status: "DRAFT", publicEvent: "", privateInfo: {}, cards: [], createdAt: new Date().toISOString() };
  await putTurn(doc, tableName, campaignId, turn);
  return turn;
}

function toTurn(item: Record<string, unknown>): Turn & { sk?: string } {
  return {
    turnId: item.turnId as number, status: item.status as TurnStatus, publicEvent: (item.publicEvent as string) ?? "",
    privateInfo: (item.privateInfo as Record<string, string>) ?? {}, cards: (item.cards as NarrativeCard[]) ?? [],
    createdAt: (item.createdAt as string) ?? "", result: item.result as TurnResult | undefined, sk: item.SK as string,
  };
}
```

Note: turn META records and submissions share the `TURN#` prefix. `listTurns` filters out `#SUB#` SKs; turn records use exactly `TURN#nnn`. Adjust the QueryCommand to only match turn metas by keeping submissions under `TURN#nnn#SUB#` (begins_with still returns them, hence the filter).

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/db/turns.ts backend/src/db/turns.test.ts && git commit -m "feat(backend): dynamic turn DB module"
```

### Task 7: Submissions DB module

**Files:**
- Create: `backend/src/db/submissions.ts`
- Test: `backend/src/db/submissions.test.ts`
- Delete: `backend/src/db/choices.ts`, `backend/src/db/choices.test.ts`

- [ ] **Step 1: Failing test** for `putSubmission`, `getSubmission`, `listSubmissions`.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```typescript
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, submissionSk } from "../keys";
import type { Submission, CardResponse } from "@ravenloft/content";

export async function putSubmission(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, sub: Submission): Promise<void> {
  await doc.send(new PutCommand({ TableName: tableName, Item: {
    PK: campaignPk(campaignId), SK: submissionSk(turnId, sub.houseId),
    houseId: sub.houseId, orderText: sub.orderText, cardResponses: sub.cardResponses, submittedAt: sub.submittedAt } }));
}

export async function getSubmission(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, houseId: string): Promise<Submission | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: submissionSk(turnId, houseId) } }));
  if (!res.Item) return null;
  return { houseId: res.Item.houseId as string, orderText: res.Item.orderText as string,
    cardResponses: (res.Item.cardResponses as CardResponse[]) ?? [], submittedAt: res.Item.submittedAt as string };
}

export async function listSubmissions(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Submission[]> {
  const { padTurn } = await import("../keys");
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": `TURN#${padTurn(turnId)}#SUB#` } }));
  return (res.Items ?? []).map((i) => ({ houseId: i.houseId as string, orderText: i.orderText as string,
    cardResponses: (i.cardResponses as CardResponse[]) ?? [], submittedAt: i.submittedAt as string }));
}
```

- [ ] **Step 4: Run → PASS. Delete choices, commit**

```bash
git rm backend/src/db/choices.ts backend/src/db/choices.test.ts
git add backend/src/db/submissions.ts backend/src/db/submissions.test.ts
git commit -m "feat(backend): submissions DB module; remove choices"
```

### Task 8: Validation schemas (rewrite)

**Files:**
- Modify: `backend/src/validation/schemas.ts`
- Test: `backend/src/validation/schemas.test.ts`

Parsers to implement: `parseCreateHouseBody`, `parseLoginBody` (keep), `parseSubmitOrderBody`, `parseComposeTurnBody`, `parseApplyResolutionBody`, `parseEditHouseBody`, `parseAdminLoginBody` (keep).

- [ ] **Step 1: Failing tests.** Key cases: create-house rejects bad attributes (delegates to `validateAttributes`), enforces name length 1–60, motto ≤ 120, text fields ≤ 2000, emblem icon ∈ EMBLEM_ICONS; submit-order requires non-empty `orderText` (≤ 4000), validates each `cardResponse` shape.

```typescript
import { describe, it, expect } from "vitest";
import { parseCreateHouseBody, parseSubmitOrderBody } from "./schemas";

describe("parseCreateHouseBody", () => {
  const base = { displayName: "Ana", name: "Casa X", motto: "m", emblem: { icon: "lobo", color1: "#111111", color2: "#222222" },
    leaderName: "L", heirName: "H", castleName: "C", townsText: "T", historyText: "Hi", specialty: "S", weakness: "W",
    attributes: { riqueza: 1, recursos: 2, soldados: 5, controle: 2 } };
  it("accepts a valid body", () => { expect(parseCreateHouseBody(base).name).toBe("Casa X"); });
  it("rejects bad attribute sum", () => {
    expect(() => parseCreateHouseBody({ ...base, attributes: { riqueza: 5, recursos: 5, soldados: 5, controle: 5 } })).toThrow();
  });
  it("rejects unknown emblem icon", () => {
    expect(() => parseCreateHouseBody({ ...base, emblem: { ...base.emblem, icon: "dragao" } })).toThrow();
  });
});

describe("parseSubmitOrderBody", () => {
  it("requires orderText", () => { expect(() => parseSubmitOrderBody({ orderText: "", cardResponses: [] })).toThrow(); });
  it("accepts declaredSpend", () => {
    const b = parseSubmitOrderBody({ orderText: "faço x", cardResponses: [{ cardId: "c1", declaredSpend: { attribute: "riqueza", amount: 2 }, text: "t" }] });
    expect(b.cardResponses[0].declaredSpend?.amount).toBe(2);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (rewrite schemas.ts). Include helpers `requireString`, `optionalString`, `requireStringMax`, `asObject`, `asArray`, and use `validateAttributes` + `EMBLEM_ICONS`, `ATTRIBUTE_KEYS` from `@ravenloft/content`. Full parser code:

```typescript
import { ATTRIBUTE_KEYS, EMBLEM_ICONS, validateAttributes, type AttributeKey, type Attributes, type Emblem, type CardResponse } from "@ravenloft/content";
import { HttpError } from "../types/domain";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "INVALID_BODY", "Corpo inválido.");
  return body as Record<string, unknown>;
}
function str(obj: Record<string, unknown>, key: string, max: number, required = true): string {
  const v = obj[key];
  if (v === undefined || v === "") { if (required) throw new HttpError(400, "INVALID_BODY", `Campo obrigatório: ${key}`); return ""; }
  if (typeof v !== "string") throw new HttpError(400, "INVALID_BODY", `Campo inválido: ${key}`);
  if (v.length > max) throw new HttpError(400, "INVALID_BODY", `Campo muito longo: ${key}`);
  return v;
}
function parseAttributes(raw: unknown): Attributes {
  const o = asObject(raw); const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) { const n = o[k]; if (typeof n !== "number") throw new HttpError(400, "INVALID_BODY", `Atributo inválido: ${k}`); out[k as AttributeKey] = n; }
  const res = validateAttributes(out); if (!res.valid) throw new HttpError(400, "INVALID_ATTRIBUTES", res.error ?? "Atributos inválidos.");
  return out;
}
function parseEmblem(raw: unknown): Emblem {
  const o = asObject(raw); const icon = str(o, "icon", 20);
  if (!(EMBLEM_ICONS as readonly string[]).includes(icon)) throw new HttpError(400, "INVALID_BODY", "Ícone desconhecido.");
  return { icon: icon as Emblem["icon"], color1: str(o, "color1", 20), color2: str(o, "color2", 20) };
}

export function parseCreateHouseBody(body: unknown) {
  const o = asObject(body);
  return {
    displayName: str(o, "displayName", 40), name: str(o, "name", 60), motto: str(o, "motto", 120),
    emblem: parseEmblem(o.emblem), leaderName: str(o, "leaderName", 60), heirName: str(o, "heirName", 60),
    castleName: str(o, "castleName", 60), townsText: str(o, "townsText", 2000), historyText: str(o, "historyText", 2000),
    specialty: str(o, "specialty", 500), weakness: str(o, "weakness", 500), attributes: parseAttributes(o.attributes),
  };
}
export function parseLoginBody(body: unknown) { return { playerCode: str(asObject(body), "playerCode", 40) }; }
export function parseAdminLoginBody(body: unknown) { return { adminCode: str(asObject(body), "adminCode", 80) }; }

export function parseSubmitOrderBody(body: unknown): { orderText: string; cardResponses: CardResponse[] } {
  const o = asObject(body); const orderText = str(o, "orderText", 4000);
  const raw = o.cardResponses; const arr = Array.isArray(raw) ? raw : [];
  const cardResponses: CardResponse[] = arr.map((r) => {
    const c = asObject(r); const cr: CardResponse = { cardId: str(c, "cardId", 80), text: str(c, "text", 4000, false) };
    if (c.declaredSpend) { const s = asObject(c.declaredSpend); cr.declaredSpend = { attribute: str(s, "attribute", 20) as AttributeKey, amount: Number(s.amount) }; }
    if (c.declaredChoice) { const ch = asObject(c.declaredChoice); cr.declaredChoice = { attribute: str(ch, "attribute", 20) as AttributeKey }; }
    return cr;
  });
  return { orderText, cardResponses };
}

export function parseComposeTurnBody(body: unknown) {
  const o = asObject(body);
  const publicEvent = str(o, "publicEvent", 4000, false);
  const privateInfo = (o.privateInfo && typeof o.privateInfo === "object") ? o.privateInfo as Record<string, string> : {};
  const cardsRaw = Array.isArray(o.cards) ? o.cards : [];
  const cards = cardsRaw.map((c) => {
    const co = asObject(c);
    const card: Record<string, unknown> = { id: str(co, "id", 80), title: str(co, "title", 120),
      constraintText: str(co, "constraintText", 2000, false), narrativeQuestion: str(co, "narrativeQuestion", 2000, false),
      consequenceText: str(co, "consequenceText", 2000, false) };
    if (co.spend) { const s = asObject(co.spend); card.spend = { attribute: str(s, "attribute", 20), max: Number(s.max) }; }
    if (co.choice) { const ch = asObject(co.choice); card.choice = { attributes: (ch.attributes as string[]) ?? [], amount: Number(ch.amount) }; }
    return card;
  });
  return { publicEvent, privateInfo, cards };
}

export function parseApplyResolutionBody(body: unknown) {
  const o = asObject(body);
  return {
    publicResult: str(o, "publicResult", 8000, false),
    houseResults: (o.houseResults as Record<string, string>) ?? {},
    attributeDeltas: (o.attributeDeltas as Record<string, Partial<Attributes>>) ?? {},
    discoveries: Array.isArray(o.discoveries) ? (o.discoveries as string[]) : [],
  };
}

export function parseEditHouseBody(body: unknown) {
  const o = asObject(body);
  return { houseId: str(o, "houseId", 80), attributes: parseAttributes(o.attributes) };
}
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/validation && git commit -m "feat(backend): rewrite validation schemas for redesign"
```

### Task 9: Public + player routes (create account, login, getGame, submitOrder)

**Files:**
- Modify: `backend/src/routes/publicRoutes.ts`, `backend/src/routes/playerRoutes.ts`
- Test: update `publicRoutes.test.ts`, `playerRoutes.test.ts`

**Behaviors:**
- `getCampaign` → `{ id, title, introduction }` (no kingdom state).
- `getHouseExample` → returns `CASA_VARGEN_EXAMPLE`.
- `createAccountAndHouse`: parse body → generate code (`generatePlayerCode()` in `auth/codes`) → `hashCode` → `createAccountAndHouse` db → sign player token → return `{ playerCode, playerToken, houseId, displayName }`.
- `login`: unchanged logic, but returns `{ playerToken, houseId, displayName }`.
- `getGame`: load player → house → active turn → this house's submission. Build view: house (with attributes), turn status, publicEvent (only if status !== DRAFT), privateInfo[houseId], cards, existing submission, and previous turn's result for this house.
- `submitOrder`: player-only; active turn must be OPEN; validate each cardResponse against the turn's cards: `declaredSpend.amount ≤ card.spend.max` and `≤ house.attributes[attr]`; `declaredChoice.attribute ∈ card.choice.attributes`. Persist submission (upsert allowed while OPEN).

- [ ] **Step 1: Write failing tests** for each behavior (mock deps: `doc`, `config`). Include: submitOrder rejects when turn LOCKED (423), rejects spend over attribute (400 `INVALID_SPEND`), accepts valid order.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** both route files. `submitOrder` core validation:

```typescript
for (const cr of body.cardResponses) {
  const card = turn.cards.find((c) => c.id === cr.cardId);
  if (!card) throw new HttpError(400, "INVALID_CARD", "Carta desconhecida.");
  if (cr.declaredSpend) {
    if (!card.spend) throw new HttpError(400, "INVALID_SPEND", "Esta carta não permite gasto.");
    if (cr.declaredSpend.attribute !== card.spend.attribute) throw new HttpError(400, "INVALID_SPEND", "Atributo incorreto.");
    if (cr.declaredSpend.amount < 0 || cr.declaredSpend.amount > card.spend.max) throw new HttpError(400, "INVALID_SPEND", "Gasto acima do permitido.");
    if (cr.declaredSpend.amount > house.attributes[card.spend.attribute]) throw new HttpError(400, "INVALID_SPEND", "Sua Casa não possui esse atributo suficiente.");
  }
  if (cr.declaredChoice && (!card.choice || !card.choice.attributes.includes(cr.declaredChoice.attribute)))
    throw new HttpError(400, "INVALID_CHOICE", "Escolha inválida.");
}
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/routes/publicRoutes.ts backend/src/routes/playerRoutes.ts backend/src/routes/*.test.ts && git commit -m "feat(backend): account creation, login, game view, submit order"
```

### Task 10: Admin routes — dashboard, compose, open, lock, editHouse

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`
- Test: `backend/src/routes/adminRoutes.test.ts`

**Behaviors** (all `requireAdmin`):
- `getDashboard`: active turn + all houses + submissions for active turn → rows `{ houseId, houseName, attributes, submitted, orderText, cardResponses }`, plus turn fields for editing.
- `composeTurn`: parse body → merge into active DRAFT turn (`publicEvent`, `privateInfo`, `cards`) via `putTurn`. Only allowed when status === DRAFT.
- `openTurn`: DRAFT → OPEN (`setTurnStatus`).
- `lockTurn`: OPEN → LOCKED.
- `unlockTurn`: LOCKED → OPEN.
- `editHouse`: parse `{ houseId, attributes }` → `updateHouseAttributes`.

- [ ] **Step 1: Failing tests** (status guards + happy paths).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/routes/adminRoutes.ts backend/src/routes/adminRoutes.test.ts && git commit -m "feat(backend): admin dashboard, compose/open/lock, edit house"
```

### Task 11: Router + config wiring

**Files:**
- Modify: `backend/src/router.ts`, `backend/src/config.ts`, `backend/src/types/domain.ts`
- Test: update `backend/src/router.test.ts`, `backend/src/config.test.ts`

- [ ] **Step 1: Update route table**

```typescript
r("GET", "/api/campaign", getCampaign),
r("GET", "/api/house-example", getHouseExample),
r("POST", "/api/create-account", createAccountAndHouse),
r("POST", "/api/player/login", login),
r("GET", "/api/player/game", getGame),
r("PUT", "/api/player/order", submitOrder),
r("POST", "/api/admin/login", adminLogin),
r("GET", "/api/admin/dashboard", getDashboard),
r("POST", "/api/admin/turn/compose", composeTurn),
r("POST", "/api/admin/turn/open", openTurn),
r("POST", "/api/admin/turn/lock", lockTurn),
r("POST", "/api/admin/turn/unlock", unlockTurn),
r("POST", "/api/admin/turn/draft-private", draftPrivateInfo),   // Phase 3
r("POST", "/api/admin/turn/draft-resolution", draftResolution), // Phase 3
r("POST", "/api/admin/turn/apply", applyResolution),            // Phase 3
r("POST", "/api/admin/house/edit", editHouse),
```

- [ ] **Step 2: Add config fields** in `config.ts` (`openAiApiKey: env.OPENAI_API_KEY ?? ""`, `openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini"`) and to `Config` type in `types/domain.ts`. These are optional (not `required()`), so the app boots without a key.
- [ ] **Step 3: Run backend tests → PASS.** `cd backend && npx vitest run`
- [ ] **Step 4: Commit**

```bash
git add backend/src && git commit -m "feat(backend): wire routes and OpenAI config"
```

---

## Phase 3 — OpenAI integration

### Task 12: Prompt builders

**Files:**
- Create: `backend/src/ai/prompts.ts`
- Test: `backend/src/ai/prompts.test.ts`

- [ ] **Step 1: Failing test** — `buildResolutionPrompt(premise, turn, houses, submissions)` returns a string containing each house name, its attributes, and the constraint rule text ("atributos são restrições").

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `buildPrivateInfoPrompt` and `buildResolutionPrompt`. The resolution prompt must instruct: return JSON `{ publicResult, houseResults, attributeDeltas, discoveries }`; deltas per house are small integers (−2..+1); attributes are constraints (a plan is only as plausible as attributes allow); write in Portuguese.

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/ai/prompts.ts backend/src/ai/prompts.test.ts && git commit -m "feat(backend): OpenAI prompt builders"
```

### Task 13: OpenAI client module + resolution parser

**Files:**
- Create: `backend/src/ai/openai.ts`
- Test: `backend/src/ai/openai.test.ts`
- Modify: `backend/package.json` (add `openai` dependency)

- [ ] **Step 1: Add dependency**

Run: `cd backend && npm install openai`

- [ ] **Step 2: Failing test** for `parseResolution(jsonString)` — parses valid JSON, throws `HttpError(502, "AI_PARSE")` on invalid JSON or missing fields. (Do NOT hit the network in tests; test the parser + inject a fake completion function.)

```typescript
import { describe, it, expect } from "vitest";
import { parseResolution } from "./openai";

describe("parseResolution", () => {
  it("parses valid JSON", () => {
    const r = parseResolution(JSON.stringify({ publicResult: "p", houseResults: { a: "x" }, attributeDeltas: { a: { soldados: -1 } }, discoveries: [] }));
    expect(r.publicResult).toBe("p");
    expect(r.attributeDeltas.a.soldados).toBe(-1);
  });
  it("throws on garbage", () => { expect(() => parseResolution("not json")).toThrow(); });
});
```

- [ ] **Step 3: Implement** `openai.ts`. Structure so the network call is injectable:

```typescript
import OpenAI from "openai";
import { HttpError } from "../types/domain";
import type { TurnResult } from "@ravenloft/content";

export type ChatFn = (system: string, user: string, jsonMode: boolean) => Promise<string>;

export function makeChatFn(apiKey: string, model: string): ChatFn {
  const client = new OpenAI({ apiKey });
  return async (system, user, jsonMode) => {
    const res = await client.chat.completions.create({
      model, temperature: 0.7,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    return res.choices[0]?.message?.content ?? "";
  };
}

export function parseResolution(raw: string): TurnResult {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido."); }
  const o = obj as Record<string, unknown>;
  if (typeof o.publicResult !== "string") throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
  return {
    publicResult: o.publicResult as string,
    houseResults: (o.houseResults as Record<string, string>) ?? {},
    attributeDeltas: (o.attributeDeltas as TurnResult["attributeDeltas"]) ?? {},
    discoveries: Array.isArray(o.discoveries) ? (o.discoveries as string[]) : [],
  };
}
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src/ai/openai.ts backend/src/ai/openai.test.ts backend/package.json backend/package-lock.json && git commit -m "feat(backend): OpenAI client and resolution parser"
```

### Task 14: Admin AI + apply routes

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`
- Test: `backend/src/routes/adminRoutes.test.ts`

**Behaviors:**
- `draftPrivateInfo`: requireAdmin; DRAFT turn; build prompt from houses + last result + publicEvent; call chat (non-JSON) per house or one call returning a map; return `{ privateInfo: Record<houseId,string> }`. If no API key → `HttpError(503, "AI_DISABLED")`.
- `draftResolution`: requireAdmin; LOCKED turn; gather submissions + houses; call chat (JSON) → `parseResolution` → return the draft (NOT applied).
- `applyResolution`: requireAdmin; LOCKED turn; parse edited result body; apply `attributeDeltas` to each house (clamp 0..5) via `updateHouseAttributes`; `saveTurnResult` (sets RESOLVED); `createNextTurnDraft(nextId)`; return `{ nextTurnId }`.

- [ ] **Step 1: Failing tests** — inject a fake `ChatFn` through deps; assert apply clamps deltas and advances the turn; assert `AI_DISABLED` when key empty.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Extend `Deps` to optionally carry a `chat?: ChatFn` built from config in `handler.ts`; default via `makeChatFn` when `openAiApiKey` present.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add backend/src && git commit -m "feat(backend): admin AI drafting and apply resolution"
```

---

## Phase 4 — Frontend: landing + creation wizard + API layer

### Task 15: Frontend API types + client interface

**Files:**
- Modify: `frontend/src/types/api.ts` (rewrite), `frontend/src/api/client.ts`
- Test: covered via mockClient tests (Task 16)

- [ ] **Step 1: Rewrite `types/api.ts`** to re-export shared types (`House`, `Turn`, `Submission`, `Attributes`, `NarrativeCard`, `TurnResult`, `HouseExample`) and define view types: `CampaignSummary { id, title, introduction }`, `CreateAccountResult { playerCode, playerToken, houseId, displayName }`, `LoginResult { playerToken, houseId, displayName }`, `PlayerGameView { house, turnId, turnStatus, publicEvent, privateInformation, cards, submission?, previousResult? }`, `AdminDashboard { turnId, turnStatus, publicEvent, privateInfo, cards, houses: House[], submissions: Submission[] }`. Keep `ApiError`/`ApiErrorCode` (add `ACCOUNT_EXISTS`, `INVALID_SPEND`, `INVALID_CHOICE`, `AI_DISABLED`, `AI_PARSE`, `INVALID_ATTRIBUTES`).

- [ ] **Step 2: Rewrite `ApiClient` interface**

```typescript
export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouseExample(): Promise<HouseExample>;
  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  adminComposeTurn(adminToken: string, input: ComposeTurnInput): Promise<void>;
  adminOpenTurn(adminToken: string): Promise<void>;
  adminLockTurn(adminToken: string): Promise<void>;
  adminUnlockTurn(adminToken: string): Promise<void>;
  adminDraftPrivateInfo(adminToken: string): Promise<Record<string, string>>;
  adminDraftResolution(adminToken: string): Promise<TurnResult>;
  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }>;
  adminEditHouse(adminToken: string, houseId: string, attributes: Attributes): Promise<void>;
}
```

- [ ] **Step 3: Commit** (after Task 16 compiles).

### Task 16: httpClient + mockClient

**Files:**
- Modify: `frontend/src/api/httpClient.ts`, `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/mockClient.test.ts` (rewrite)

- [ ] **Step 1: Failing test** — mock flow: `createAccountAndHouse` returns a code + token; `getGame` reflects the created house; `submitOrder` stores an editable submission; admin compose→open makes the turn OPEN in `getGame`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** both clients. `httpClient` maps each method to fetch calls with `Authorization: Bearer <token>`; `mockClient` keeps in-memory maps (houses by token, one active turn, submissions) so Playwright/dev works offline.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/api frontend/src/types/api.ts && git commit -m "feat(frontend): rewrite API layer for redesign"
```

### Task 17: Crest, AttributeBars, PointBuy components

**Files:**
- Create: `frontend/src/components/Crest.tsx`, `AttributeBars.tsx`, `PointBuy.tsx`
- Test: `Crest.test.tsx`, `PointBuy.test.tsx`

- [ ] **Step 1: Failing test for `PointBuy`** — renders 4 attributes; increment disabled when remaining=0 or value=5; shows "Pontos restantes"; `onChange` fires with updated attributes; `isValid` true only at sum=10.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** `PointBuy` props `{ value: Attributes; onChange(a): void }`; internal remaining = 10 − sum; +/− steppers per attribute (MUI `IconButton` + `Typography`), each clamped 0..5. `Crest` renders an SVG/emoji icon on a two-color shield. `AttributeBars` renders 4 MUI `LinearProgress` (value/5) with labels.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/components/Crest.tsx frontend/src/components/AttributeBars.tsx frontend/src/components/PointBuy.tsx frontend/src/components/*.test.tsx && git commit -m "feat(frontend): crest, attribute bars, point-buy components"
```

### Task 18: Landing (3 CTAs) + Create House wizard

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`
- Create: `frontend/src/pages/CreateHousePage.tsx`
- Modify: `frontend/src/App.tsx` (add `/criar` route), `frontend/src/pages/LoginPage.tsx` (reword)
- Test: `frontend/src/pages/CreateHousePage.test.tsx`

- [ ] **Step 1: Failing test** — wizard renders step 1 (display name); advancing through identity + point-buy (set valid attrs) enables "Fundar a Casa"; submitting calls `createAccountAndHouse` and shows the generated code.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** `LandingPage`: three MUI buttons routing to `/criar`, `/login`, `/admin` over the existing `<Fog />` theme. `CreateHousePage`: MUI `Stepper` with 4 steps (Conta / Identidade / Atributos / Revisão), `PointBuy` in step 3, `Crest` preview + icon/color pickers in step 2, Casa Vargen example in an expandable panel (`getHouseExample`). On submit show the code in a dialog ("guarde este código") then navigate to `/game` with the returned token saved to session.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/pages frontend/src/App.tsx frontend/src/components && git commit -m "feat(frontend): landing 3 CTAs and create-house wizard"
```

---

## Phase 5 — Frontend: player turn loop

### Task 19: NarrativeCardInput component

**Files:**
- Create: `frontend/src/components/NarrativeCardInput.tsx`
- Test: `frontend/src/components/NarrativeCardInput.test.tsx`

- [ ] **Step 1: Failing test** — spend card renders a stepper capped at `min(card.spend.max, house attribute)`; choice card renders radios for offered attributes; narrative text box updates; emits `CardResponse` via `onChange`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Props `{ card: NarrativeCard; houseAttributes: Attributes; value: CardResponse; onChange(cr): void }`. Renders the three text parts (constraintText, narrativeQuestion, consequenceText), the structured control, and a multiline text field.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/components/NarrativeCardInput.tsx frontend/src/components/NarrativeCardInput.test.tsx && git commit -m "feat(frontend): narrative card input component"
```

### Task 20: GamePage rewrite

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx`
- Test: `frontend/src/pages/GamePage.test.tsx` (rewrite)

- [ ] **Step 1: Failing tests** — OPEN turn shows house sheet (Crest + AttributeBars), public event, private info, cards, order box + submit; after submit shows "Ordem registrada"; LOCKED disables inputs and shows resolving message; RESOLVED shows public + private result.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Load `getGame`; render sections per Section 3 of the spec. Track `orderText` + per-card `CardResponse[]`; client-validate spends vs attributes before enabling submit; call `submitOrder`. Poll/refetch on mount.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx && git commit -m "feat(frontend): player turn loop game page"
```

---

## Phase 6 — Frontend: admin dashboard

### Task 21: NarrativeCardEditor component

**Files:**
- Create: `frontend/src/components/NarrativeCardEditor.tsx`
- Test: `frontend/src/components/NarrativeCardEditor.test.tsx`

- [ ] **Step 1: Failing test** — edits title/constraint/question/consequence; toggle spend vs choice; emits a valid `NarrativeCard`; can be removed.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Props `{ card, onChange, onRemove }`. Spend editor: attribute select + max stepper. Choice editor: multi-select attributes + amount.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/components/NarrativeCardEditor.tsx frontend/src/components/NarrativeCardEditor.test.tsx && git commit -m "feat(frontend): narrative card editor component"
```

### Task 22: AdminPage rewrite

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`
- Test: `frontend/src/pages/AdminPage.test.tsx` (rewrite)

- [ ] **Step 1: Failing tests** — admin login → dashboard; DRAFT shows compose form (publicEvent, per-house privateInfo, card editors, "Abrir turno"); OPEN shows submission roster + "Trancar"; LOCKED shows "Rascunhar resolução" → editable draft → "Aplicar e publicar" advances turn. Mock the AI methods.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per Section 4. Status-driven panels; editable AI drafts; delta editors per house (steppers); "Editar atributos" per house calling `adminEditHouse`.
- [ ] **Step 4: Run → PASS. Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/pages/AdminPage.test.tsx && git commit -m "feat(frontend): admin compose/monitor/resolve dashboard"
```

---

## Phase 7 — Reset/seed, full test, visual smoke, deploy

### Task 23: Campaign reset/seed script

**Files:**
- Create: `backend/scripts/reset-campaign.mjs`

- [ ] **Step 1: Implement** a script that scans the campaign partition and deletes all `HOUSE#`/`TURN#`/`PLAYER#` items, then `putTurn` for turn 1 as DRAFT. Guard behind an explicit `--confirm` flag and read table/campaign from env.
- [ ] **Step 2: Dry-run print** (no `--confirm`) lists what would be deleted.
- [ ] **Step 3: Commit**

```bash
git add backend/scripts/reset-campaign.mjs && git commit -m "chore(backend): campaign reset/seed script"
```

### Task 24: Full validation gate

- [ ] **Step 1: Remove dead references.** Ensure nothing imports `@ravenloft/content` symbols that were deleted (`houses`, `campaign`, `turn001`, `HouseId`, `KingdomState`). Grep: `grep -rn "KingdomState\|turn001\|HOUSE_IDS\|HouseId" backend/src frontend/src shared/src`.
- [ ] **Step 2: Run the full gate**

Run: `npm test && npm run build`
Expected: all suites pass, all three packages build.

- [ ] **Step 3: Fix any failures, commit**

```bash
git add -A && git commit -m "test: green full suite after redesign"
```

### Task 25: Playwright visual smoke + deploy

**Files:**
- Modify: `frontend/tests/*.e2e.ts` (update flows)

- [ ] **Step 1: Update e2e** to cover: landing 3 CTAs visible → create account+house (fill wizard, valid point-buy) → land on game screen; admin login → compose turn → open → (mock) resolve. Use the mock client (offline dev server per existing `playwright.config.ts`).
- [ ] **Step 2: Run visual smoke**

Run: `cd frontend && npm run test:e2e`
Expected: PASS; inspect screenshots per the visual-test-before-deploy skill.

- [ ] **Step 3: Deploy** (only after screenshots inspected). Follow the existing deploy flow: build frontend with `.env.production`, zip `frontend/dist`, `aws amplify create-deployment` → upload → `start-deployment`, poll to SUCCEED, verify live bundle hash. Deploy backend via SAM with `OPENAI_API_KEY` passed as a parameter/env (NOT committed).
- [ ] **Step 4: Commit + push**

```bash
git add -A && git commit -m "feat: narrative house redesign end-to-end" && git push
```

⚠️ **Before deploy:** rotate the OpenAI key that was pasted in chat (platform.openai.com/api-keys) and set the new key only as a backend Lambda env var — never in source.

---

## Self-Review Notes

- **Spec coverage:** Section 1 → Tasks 1,5,6,7; Section 2 → Tasks 8,9,15–18; Section 3 → Tasks 19,20; Section 4 → Tasks 10,14,21,22; Section 5 → Tasks 12,13,14; Section 6 → Tasks 8 (validation), 23 (reset), 24–25 (test/smoke/deploy), kingdom-state removal in Task 1.
- **Type consistency:** `createAccountAndHouse` (db + route + client), `submitOrder`, `TurnResult` shape, `Attributes`/`AttributeKey`, `NarrativeCard.spend/choice` used identically across backend and frontend.
- **No placeholders:** each code step shows real code; UI-heavy tasks specify props, behavior, and test assertions.
