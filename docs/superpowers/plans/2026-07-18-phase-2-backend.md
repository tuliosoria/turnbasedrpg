# Phase 2 — Backend + DynamoDB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AWS SAM backend — a single Lambda behind an API Gateway HTTP API, backed by one DynamoDB table — implementing every route the Phase-1 `ApiClient` interface already consumes, with server-side security enforced.

**Architecture:** One Lambda with an internal router dispatching to public / player / admin route handlers. Handlers are **pure functions** that receive a `Deps` object (`{ doc, config }`), so they unit-test with `aws-sdk-client-mock` — no Docker/DynamoDB Local required. HMAC-signed tokens (no Cognito). Atomic house claim via `TransactWriteItems`. Campaign **content** comes from the bundled `@ravenloft/content`; mutable **state** lives in DynamoDB.

**Tech Stack:** Node 20 Lambda (TypeScript, ESM), `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`, esbuild (SAM bundling), Vitest + `aws-sdk-client-mock`, AWS SAM (`template.yaml`).

---

## File structure

```
backend/
  package.json            # @ravenloft/backend workspace
  tsconfig.json
  vitest.config.ts
  template.yaml           # SAM: HttpApi + Function + DynamoDB table
  src/
    types/domain.ts       # Config, HandlerRequest/Response, HttpError, Deps
    keys.ts               # DynamoDB key builders (campaignPk, turnPk, padTurn, ...)
    auth/tokens.ts        # HMAC sign/verify (player + admin payloads)
    auth/codes.ts         # player-code generation + sha256 hashing
    auth/playerAuth.ts    # extract+verify player token from headers
    auth/adminAuth.ts     # extract+verify admin token from headers
    db/dynamo.ts          # DocumentClient factory
    db/players.ts         # claimHouse (transact), getPlayerByCodeHash, listHouseClaims
    db/choices.ts         # putChoice, getChoice, listChoices
    db/turns.ts           # getTurnStatus, setTurnStatus
    validation/schemas.ts # request-body validation → HttpError(400)
    routes/publicRoutes.ts# getCampaign, getHouses, claimHouse, login
    routes/playerRoutes.ts# me, game, submitChoice
    routes/adminRoutes.ts # login, dashboard, lock, unlock
    router.ts             # method+path → handler, CORS, error→HTTP mapping
    handler.ts            # Lambda entry: builds Deps from env, calls router
    config.ts             # loadConfig() from process.env
```

**Shared contract:** The backend reuses `@ravenloft/content` (`campaign`, `houses`, `turn001`, `HOUSE_IDS`, `CONTENT_VERSION`, types). Response shapes MUST match `frontend/src/types/api.ts` (`CampaignSummary`, `HouseSummary`, `ClaimResult`, `LoginResult`, `PlayerGameView`, `CurrentChoice`, `AdminDashboard`, `AdminChoiceRow`, `TurnStatus`) so the Phase-3 HTTP client is a drop-in for `MockApiClient`.

---

## Task 1: Backend workspace scaffold + domain types

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/types/domain.ts`
- Create: `backend/src/keys.ts`
- Modify: root `package.json` (add `backend` to workspaces + backend scripts)

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "@ravenloft/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "esbuild src/handler.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/handler.mjs --banner:js=\"import{createRequire}from'module';const require=createRequire(import.meta.url);\""
  },
  "dependencies": {
    "@ravenloft/content": "*",
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/lib-dynamodb": "^3.700.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/node": "^20.17.9",
    "aws-sdk-client-mock": "^4.1.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node", "vitest/globals"],
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `backend/src/types/domain.ts`**

```ts
export interface Config {
  tableName: string;
  campaignId: string;
  adminCodeHash: string;
  tokenSigningSecret: string;
  allowedOrigin: string;
  tokenTtlSeconds: number;
}

export interface HandlerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  pathParams: Record<string, string>;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
```

- [ ] **Step 5: Create `backend/src/keys.ts`**

```ts
export function campaignPk(campaignId: string): string {
  return `CAMPAIGN#${campaignId.toUpperCase().replace(/-/g, "_")}`;
}

export function padTurn(turnId: number): string {
  return String(turnId).padStart(3, "0");
}

export function turnPk(campaignId: string, turnId: number): string {
  return `${campaignPk(campaignId)}#TURN#${padTurn(turnId)}`;
}

export function houseSk(houseId: string): string {
  return `HOUSE#${houseId}`;
}

export function playerPk(codeHash: string): string {
  return `PLAYER#${codeHash}`;
}
```

- [ ] **Step 6: Add `backend` to root workspaces and add backend scripts**

Modify root `package.json`. Change the `workspaces` array to include `backend`, and add these scripts (keep existing ones):

```json
{
  "workspaces": ["shared", "backend", "frontend"],
  "scripts": {
    "build:shared": "npm run build --workspace shared",
    "validate-content": "npm run build:shared && tsx scripts/validate-content.ts",
    "dev": "npm run dev --workspace frontend",
    "build": "npm run build:shared && npm run build --workspace frontend",
    "build:backend": "npm run build:shared && npm run build --workspace backend",
    "test": "npm run validate-content && npm run test --workspace shared --if-present && npm run test --workspace backend --if-present && npm run test --workspace frontend"
  }
}
```

- [ ] **Step 7: Install and typecheck**

Run: `npm install`
Then: `npm run build:shared && npm run typecheck --workspace backend`
Expected: install completes; typecheck exits 0 (no source files reference missing modules yet — only `keys.ts`, `domain.ts` exist and are self-contained).

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/src/types/domain.ts backend/src/keys.ts package.json package-lock.json
git commit -m "chore(backend): scaffold SAM Lambda workspace and domain types"
```

---

## Task 2: HMAC token module (sign + verify)

**Files:**
- Create: `backend/src/auth/tokens.ts`
- Test: `backend/src/auth/tokens.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/auth/tokens.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type PlayerTokenPayload } from "./tokens";

const SECRET = "test-secret";
const base: PlayerTokenPayload = {
  type: "player",
  campaignId: "winter-dead",
  houseId: "vargen",
  displayName: "Elira",
  exp: Date.now() + 60_000,
};

describe("tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken(base, SECRET);
    expect(verifyToken(token, SECRET)).toEqual(base);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signToken(base, SECRET);
    expect(verifyToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signToken(base, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, houseId: "ravens" }), "utf8").toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = { ...base, exp: Date.now() - 1 };
    expect(verifyToken(signToken(expired, SECRET), SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyToken("not-a-token", SECRET)).toBeNull();
    expect(verifyToken("a.b.c", SECRET)).toBeNull();
    expect(verifyToken("", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/auth/tokens.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/auth/tokens.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PlayerTokenPayload {
  type: "player";
  campaignId: string;
  houseId: string;
  displayName: string;
  exp: number;
}

export interface AdminTokenPayload {
  type: "admin";
  campaignId: string;
  exp: number;
}

export type TokenPayload = PlayerTokenPayload | AdminTokenPayload;

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signToken(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: string, secret: string, now: number = Date.now()): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, providedSig] = parts;
  if (!body || !providedSig) return null;

  const expectedSig = sign(body, secret);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < now) return null;
  if (payload.type !== "player" && payload.type !== "admin") return null;
  return payload;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/auth/tokens.test.ts --root backend`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/tokens.ts backend/src/auth/tokens.test.ts
git commit -m "feat(backend): add HMAC token sign/verify"
```

---

## Task 3: Player-code generation + hashing

**Files:**
- Create: `backend/src/auth/codes.ts`
- Test: `backend/src/auth/codes.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/auth/codes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { generatePlayerCode, hashCode } from "./codes";

describe("codes", () => {
  it("generates a code prefixed by the house id with >=4 random chars", () => {
    const code = generatePlayerCode("vargen");
    expect(code).toMatch(/^vargen-[A-Z0-9]{4}$/);
  });

  it("generates different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generatePlayerCode("vargen")));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("hashes deterministically to 64 hex chars", () => {
    const h1 = hashCode("vargen-4K7P");
    const h2 = hashCode("vargen-4K7P");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different codes", () => {
    expect(hashCode("vargen-4K7P")).not.toBe(hashCode("vargen-4K7Q"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/auth/codes.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/auth/codes.ts`**

```ts
import { createHash, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePlayerCode(houseId: string, length = 4): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${houseId}-${suffix}`;
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/auth/codes.test.ts --root backend`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/codes.ts backend/src/auth/codes.test.ts
git commit -m "feat(backend): add player-code generation and hashing"
```

---

## Task 4: DynamoDB document client factory + config loader

**Files:**
- Create: `backend/src/db/dynamo.ts`
- Create: `backend/src/config.ts`
- Test: `backend/src/config.test.ts`

- [ ] **Step 1: Create `backend/src/db/dynamo.ts`**

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function makeDocClient(region?: string): DynamoDBDocumentClient {
  const base = new DynamoDBClient(region ? { region } : {});
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
```

- [ ] **Step 2: Write the failing test `backend/src/config.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const env = {
  TABLE_NAME: "ravenloft-game",
  CAMPAIGN_ID: "winter-dead",
  ADMIN_CODE_HASH: "abc",
  TOKEN_SIGNING_SECRET: "secret",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

describe("loadConfig", () => {
  it("reads config from the environment", () => {
    const config = loadConfig(env);
    expect(config.tableName).toBe("ravenloft-game");
    expect(config.campaignId).toBe("winter-dead");
    expect(config.allowedOrigin).toBe("http://localhost:5173");
    expect(config.tokenTtlSeconds).toBeGreaterThan(0);
  });

  it("throws when a required variable is missing", () => {
    expect(() => loadConfig({ ...env, TABLE_NAME: undefined })).toThrow(/TABLE_NAME/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/config.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `backend/src/config.ts`**

```ts
import type { Config } from "./types/domain";

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  return {
    tableName: required(env, "TABLE_NAME"),
    campaignId: required(env, "CAMPAIGN_ID"),
    adminCodeHash: required(env, "ADMIN_CODE_HASH"),
    tokenSigningSecret: required(env, "TOKEN_SIGNING_SECRET"),
    allowedOrigin: required(env, "ALLOWED_ORIGIN"),
    tokenTtlSeconds: Number(env.TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7),
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/config.test.ts --root backend`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/dynamo.ts backend/src/config.ts backend/src/config.test.ts
git commit -m "feat(backend): add DynamoDB client factory and config loader"
```

---

## Task 5: DB access — players (atomic claim, lookup, house claims)

**Files:**
- Create: `backend/src/db/players.ts`
- Test: `backend/src/db/players.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/db/players.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { claimHouse, getPlayerByCodeHash, listHouseClaims } from "./players";
import { HttpError } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("claimHouse", () => {
  it("writes the house-claim and player-profile items atomically", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await claimHouse(doc, TABLE, CAMPAIGN, {
      houseId: "vargen",
      displayName: "Elira",
      codeHash: "hash123",
      playerToken: "tok",
    });
    const calls = ddb.commandCalls(TransactWriteCommand);
    expect(calls).toHaveLength(1);
    const items = calls[0].args[0].input.TransactItems!;
    expect(items).toHaveLength(2);
    expect(items[0].Put!.ConditionExpression).toMatch(/attribute_not_exists/);
  });

  it("throws HttpError 409 when the transaction is cancelled by the condition", async () => {
    const err = Object.assign(new Error("cancelled"), { name: "TransactionCanceledException" });
    ddb.on(TransactWriteCommand).rejects(err);
    await expect(
      claimHouse(doc, TABLE, CAMPAIGN, { houseId: "vargen", displayName: "X", codeHash: "h", playerToken: "t" }),
    ).rejects.toMatchObject({ status: 409, code: "HOUSE_TAKEN" });
  });
});

describe("getPlayerByCodeHash", () => {
  it("returns the profile when present", async () => {
    ddb.on(GetCommand).resolves({ Item: { houseId: "vargen", displayName: "Elira", codeHash: "h" } });
    const profile = await getPlayerByCodeHash(doc, TABLE, "h");
    expect(profile).toMatchObject({ houseId: "vargen", displayName: "Elira" });
  });

  it("returns null when absent", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await getPlayerByCodeHash(doc, TABLE, "missing")).toBeNull();
  });
});

describe("listHouseClaims", () => {
  it("returns a map of claimed houses", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        { SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" },
        { SK: "HOUSE#ravens", houseId: "ravens", displayName: "Cael" },
      ],
    });
    const claims = await listHouseClaims(doc, TABLE, CAMPAIGN);
    expect(claims.get("vargen")?.displayName).toBe("Elira");
    expect(claims.get("ravens")?.displayName).toBe("Cael");
    expect(claims.has("valerius")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/db/players.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/db/players.ts`**

```ts
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { campaignPk, houseSk, playerPk } from "../keys";
import { HttpError } from "../types/domain";

export interface PlayerProfile {
  houseId: string;
  displayName: string;
  codeHash: string;
}

export interface HouseClaim {
  houseId: string;
  displayName: string;
}

export interface ClaimInput {
  houseId: string;
  displayName: string;
  codeHash: string;
  playerToken: string;
}

export async function claimHouse(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  input: ClaimInput,
): Promise<void> {
  const pk = campaignPk(campaignId);
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: pk,
                SK: houseSk(input.houseId),
                houseId: input.houseId,
                displayName: input.displayName,
                codeHash: input.codeHash,
                claimedAt: new Date().toISOString(),
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: playerPk(input.codeHash),
                SK: "PROFILE",
                houseId: input.houseId,
                displayName: input.displayName,
                codeHash: input.codeHash,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
        ],
      }),
    );
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
      throw new HttpError(409, "HOUSE_TAKEN", "Esta Casa já foi escolhida.");
    }
    throw e;
  }
}

export async function getPlayerByCodeHash(
  doc: DynamoDBDocumentClient,
  tableName: string,
  codeHash: string,
): Promise<PlayerProfile | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: playerPk(codeHash), SK: "PROFILE" } }),
  );
  if (!res.Item) return null;
  return {
    houseId: res.Item.houseId as string,
    displayName: res.Item.displayName as string,
    codeHash: res.Item.codeHash as string,
  };
}

export async function listHouseClaims(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
): Promise<Map<string, HouseClaim>> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "HOUSE#" },
    }),
  );
  const map = new Map<string, HouseClaim>();
  for (const item of res.Items ?? []) {
    map.set(item.houseId as string, {
      houseId: item.houseId as string,
      displayName: item.displayName as string,
    });
  }
  return map;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/db/players.test.ts --root backend`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/players.ts backend/src/db/players.test.ts
git commit -m "feat(backend): add player DB access with atomic claim"
```

---

## Task 6: DB access — turn status + choices

**Files:**
- Create: `backend/src/db/turns.ts`
- Create: `backend/src/db/choices.ts`
- Test: `backend/src/db/turns.test.ts`
- Test: `backend/src/db/choices.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/db/turns.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getTurnStatus, setTurnStatus } from "./turns";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("turn status", () => {
  it("defaults to OPEN when no status item exists", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await getTurnStatus(doc, TABLE, CAMPAIGN, 1)).toBe("OPEN");
  });

  it("returns the stored status", async () => {
    ddb.on(GetCommand).resolves({ Item: { turnStatus: "LOCKED" } });
    expect(await getTurnStatus(doc, TABLE, CAMPAIGN, 1)).toBe("LOCKED");
  });

  it("writes a status keyed per active turn", async () => {
    ddb.on(PutCommand).resolves({});
    await setTurnStatus(doc, TABLE, CAMPAIGN, 1, "LOCKED");
    const input = ddb.commandCalls(PutCommand)[0].args[0].input;
    expect(input.Item!.PK).toBe("CAMPAIGN#WINTER_DEAD#TURN#001");
    expect(input.Item!.SK).toBe("META");
    expect(input.Item!.turnStatus).toBe("LOCKED");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/db/turns.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/db/turns.ts`**

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { turnPk } from "../keys";

export type TurnStatus = "OPEN" | "LOCKED";

export async function getTurnStatus(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
): Promise<TurnStatus> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: turnPk(campaignId, turnId), SK: "META" } }),
  );
  return (res.Item?.turnStatus as TurnStatus) ?? "OPEN";
}

export async function setTurnStatus(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  status: TurnStatus,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: turnPk(campaignId, turnId), SK: "META", turnStatus: status },
    }),
  );
}
```

- [ ] **Step 4: Write the failing test `backend/src/db/choices.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { putChoice, getChoice, listChoices } from "./choices";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

beforeEach(() => ddb.reset());

describe("choices", () => {
  it("puts a choice keyed by turn partition and house", async () => {
    ddb.on(PutCommand).resolves({});
    await putChoice(doc, TABLE, CAMPAIGN, 1, "vargen", "vargen-defend-bridge", "2026-07-18T00:00:00.000Z");
    const item = ddb.commandCalls(PutCommand)[0].args[0].input.Item!;
    expect(item.PK).toBe("CAMPAIGN#WINTER_DEAD#TURN#001");
    expect(item.SK).toBe("HOUSE#vargen");
    expect(item.cardId).toBe("vargen-defend-bridge");
    expect(item.chosenAt).toBe("2026-07-18T00:00:00.000Z");
  });

  it("gets a single house choice or null", async () => {
    ddb.on(GetCommand).resolves({ Item: { cardId: "vargen-defend-bridge", chosenAt: "t" } });
    expect(await getChoice(doc, TABLE, CAMPAIGN, 1, "vargen")).toMatchObject({ cardId: "vargen-defend-bridge" });
    ddb.on(GetCommand).resolves({});
    expect(await getChoice(doc, TABLE, CAMPAIGN, 1, "ravens")).toBeNull();
  });

  it("lists all choices for a turn as a map", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [{ houseId: "vargen", cardId: "vargen-defend-bridge", chosenAt: "t" }],
    });
    const map = await listChoices(doc, TABLE, CAMPAIGN, 1);
    expect(map.get("vargen")?.cardId).toBe("vargen-defend-bridge");
  });
});
```

- [ ] **Step 5: Create `backend/src/db/choices.ts`**

```ts
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { turnPk, houseSk } from "../keys";

export interface StoredChoice {
  cardId: string;
  chosenAt: string;
}

export async function putChoice(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  houseId: string,
  cardId: string,
  chosenAt: string,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: turnPk(campaignId, turnId),
        SK: houseSk(houseId),
        houseId,
        cardId,
        chosenAt,
      },
    }),
  );
}

export async function getChoice(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  houseId: string,
): Promise<StoredChoice | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: turnPk(campaignId, turnId), SK: houseSk(houseId) },
    }),
  );
  if (!res.Item) return null;
  return { cardId: res.Item.cardId as string, chosenAt: res.Item.chosenAt as string };
}

export async function listChoices(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
): Promise<Map<string, StoredChoice>> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": turnPk(campaignId, turnId), ":sk": "HOUSE#" },
    }),
  );
  const map = new Map<string, StoredChoice>();
  for (const item of res.Items ?? []) {
    map.set(item.houseId as string, {
      cardId: item.cardId as string,
      chosenAt: item.chosenAt as string,
    });
  }
  return map;
}
```

- [ ] **Step 6: Run both test files to verify they pass**

Run: `npx vitest run src/db/turns.test.ts src/db/choices.test.ts --root backend`
Expected: PASS (turns 3 tests, choices 3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/turns.ts backend/src/db/turns.test.ts backend/src/db/choices.ts backend/src/db/choices.test.ts
git commit -m "feat(backend): add turn-status and choice DB access"
```

---

## Task 7: Request-body validation schemas

**Files:**
- Create: `backend/src/validation/schemas.ts`
- Test: `backend/src/validation/schemas.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/validation/schemas.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseClaimBody, parseLoginBody, parseChoiceBody, parseAdminLoginBody } from "./schemas";
import { HttpError } from "../types/domain";

describe("validation", () => {
  it("parses a valid claim body", () => {
    expect(parseClaimBody({ houseId: "vargen", displayName: "Elira" })).toEqual({
      houseId: "vargen",
      displayName: "Elira",
    });
  });

  it("rejects an unknown houseId", () => {
    expect(() => parseClaimBody({ houseId: "nope", displayName: "X" })).toThrow(HttpError);
  });

  it("rejects a missing displayName", () => {
    expect(() => parseClaimBody({ houseId: "vargen" })).toThrow(/displayName/);
  });

  it("parses login and choice and admin bodies", () => {
    expect(parseLoginBody({ playerCode: "vargen-4K7P" })).toEqual({ playerCode: "vargen-4K7P" });
    expect(parseChoiceBody({ cardId: "vargen-defend-bridge" })).toEqual({ cardId: "vargen-defend-bridge" });
    expect(parseAdminLoginBody({ adminCode: "secret" })).toEqual({ adminCode: "secret" });
  });

  it("rejects non-object bodies", () => {
    expect(() => parseLoginBody(null)).toThrow(HttpError);
    expect(() => parseChoiceBody("x")).toThrow(HttpError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/validation/schemas.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/validation/schemas.ts`**

```ts
import { HOUSE_IDS, type HouseId } from "@ravenloft/content";
import { HttpError } from "../types/domain";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_BODY", "Corpo da requisição inválido.");
  }
  return body as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "INVALID_BODY", `Campo obrigatório ausente ou inválido: ${key}`);
  }
  return value;
}

function requireHouseId(obj: Record<string, unknown>, key: string): HouseId {
  const value = requireString(obj, key);
  if (!(HOUSE_IDS as string[]).includes(value)) {
    throw new HttpError(400, "INVALID_BODY", `Casa desconhecida: ${key}`);
  }
  return value as HouseId;
}

export function parseClaimBody(body: unknown): { houseId: HouseId; displayName: string } {
  const obj = asObject(body);
  return { houseId: requireHouseId(obj, "houseId"), displayName: requireString(obj, "displayName") };
}

export function parseLoginBody(body: unknown): { playerCode: string } {
  return { playerCode: requireString(asObject(body), "playerCode") };
}

export function parseChoiceBody(body: unknown): { cardId: string } {
  return { cardId: requireString(asObject(body), "cardId") };
}

export function parseAdminLoginBody(body: unknown): { adminCode: string } {
  return { adminCode: requireString(asObject(body), "adminCode") };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/validation/schemas.test.ts --root backend`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/validation/schemas.test.ts
git commit -m "feat(backend): add request-body validation schemas"
```

---

## Task 8: Public route handlers (campaign, houses, claim, login)

**Files:**
- Create: `backend/src/routes/publicRoutes.ts`
- Test: `backend/src/routes/publicRoutes.test.ts`

Handlers receive `Deps = { doc, config }` and a `HandlerRequest`, return `HandlerResponse`. They build responses from `@ravenloft/content` + DynamoDB state, matching `frontend/src/types/api.ts`.

- [ ] **Step 1: Write the failing test `backend/src/routes/publicRoutes.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient, QueryCommand, GetCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { getCampaign, getHouses, claimHouse, login } from "./publicRoutes";
import { verifyToken } from "../auth/tokens";
import { hashCode } from "../auth/codes";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  adminCodeHash: "x",
  tokenSigningSecret: "secret",
  allowedOrigin: "*",
  tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const req = (over = {}) => ({ method: "GET", path: "/", headers: {}, body: undefined, pathParams: {}, ...over });

beforeEach(() => ddb.reset());

describe("getCampaign", () => {
  it("returns campaign summary with contentVersion and default OPEN status", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await getCampaign(deps, req());
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.title).toMatch(/Inverno dos Mortos/);
    expect(body.contentVersion).toBeTruthy();
    expect(body.turnStatus).toBe("OPEN");
    expect(body.activeTurnId).toBe(1);
  });
});

describe("getHouses", () => {
  it("marks claimed houses unavailable and never leaks private intros", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" }] });
    const res = await getHouses(deps, req());
    const body = res.body as any[];
    expect(body).toHaveLength(6);
    expect(body.find((h) => h.id === "vargen").available).toBe(false);
    expect(body.find((h) => h.id === "ravens").available).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/privateIntroduction/);
  });
});

describe("claimHouse", () => {
  it("claims a free house and returns a code + a valid player token", async () => {
    ddb.on(TransactWriteCommand).resolves({});
    const res = await claimHouse(deps, req({ method: "POST", body: { houseId: "vargen", displayName: "Elira" } }));
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.playerCode).toMatch(/^vargen-[A-Z0-9]{4}$/);
    expect(body.houseId).toBe("vargen");
    const payload = verifyToken(body.playerToken, config.tokenSigningSecret) as any;
    expect(payload.type).toBe("player");
    expect(payload.houseId).toBe("vargen");
  });

  it("rejects an invalid body with 400", async () => {
    await expect(claimHouse(deps, req({ method: "POST", body: { houseId: "nope" } }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("login", () => {
  it("returns a token for a valid code", async () => {
    const code = "vargen-4K7P";
    ddb.on(GetCommand).resolves({ Item: { houseId: "vargen", displayName: "Elira", codeHash: hashCode(code) } });
    const res = await login(deps, req({ method: "POST", body: { playerCode: code } }));
    expect(res.status).toBe(200);
    expect((res.body as any).houseId).toBe("vargen");
  });

  it("rejects an unknown code with INVALID_CODE", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(login(deps, req({ method: "POST", body: { playerCode: "nope-0000" } }))).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CODE",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/routes/publicRoutes.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/routes/publicRoutes.ts`**

```ts
import { campaign, houses, turn001, HOUSE_IDS, CONTENT_VERSION } from "@ravenloft/content";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config, HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import { getTurnStatus } from "../db/turns";
import { listHouseClaims, claimHouse as dbClaimHouse, getPlayerByCodeHash } from "../db/players";
import { parseClaimBody, parseLoginBody } from "../validation/schemas";
import { generatePlayerCode, hashCode } from "../auth/codes";
import { signToken, type PlayerTokenPayload } from "../auth/tokens";

export interface Deps {
  doc: DynamoDBDocumentClient;
  config: Config;
}

function playerToken(config: Config, houseId: string, displayName: string): string {
  const payload: PlayerTokenPayload = {
    type: "player",
    campaignId: config.campaignId,
    houseId,
    displayName,
    exp: Date.now() + config.tokenTtlSeconds * 1000,
  };
  return signToken(payload, config.tokenSigningSecret);
}

export async function getCampaign(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const turnStatus = await getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, campaign.activeTurnId);
  return {
    status: 200,
    body: {
      id: campaign.id,
      title: campaign.title,
      introduction: campaign.introduction,
      publicState: turn001.stateBefore,
      activeTurnId: campaign.activeTurnId,
      turnStatus,
      contentVersion: CONTENT_VERSION,
    },
  };
}

export async function getHouses(deps: Deps, _req: HandlerRequest): Promise<HandlerResponse> {
  const claims = await listHouseClaims(deps.doc, deps.config.tableName, deps.config.campaignId);
  return {
    status: 200,
    body: HOUSE_IDS.map((id) => {
      const h = houses[id];
      return {
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        motto: h.motto,
        strength: h.strength,
        available: !claims.has(id),
      };
    }),
  };
}

export async function claimHouse(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { houseId, displayName } = parseClaimBody(req.body);
  const playerCode = generatePlayerCode(houseId);
  const codeHash = hashCode(playerCode);
  await dbClaimHouse(deps.doc, deps.config.tableName, deps.config.campaignId, {
    houseId,
    displayName,
    codeHash,
    playerToken: "",
  });
  return {
    status: 201,
    body: { playerCode, playerToken: playerToken(deps.config, houseId, displayName), houseId, displayName },
  };
}

export async function login(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { playerCode } = parseLoginBody(req.body);
  const profile = await getPlayerByCodeHash(deps.doc, deps.config.tableName, hashCode(playerCode));
  if (!profile) throw new HttpError(401, "INVALID_CODE", "Código inválido.");
  return {
    status: 200,
    body: {
      playerToken: playerToken(deps.config, profile.houseId, profile.displayName),
      houseId: profile.houseId,
      displayName: profile.displayName,
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/routes/publicRoutes.test.ts --root backend`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/publicRoutes.ts backend/src/routes/publicRoutes.test.ts
git commit -m "feat(backend): add public route handlers"
```

---

## Task 9: Player auth + player route handlers (me, game, submitChoice)

**Files:**
- Create: `backend/src/auth/playerAuth.ts`
- Create: `backend/src/routes/playerRoutes.ts`
- Test: `backend/src/routes/playerRoutes.test.ts`

- [ ] **Step 1: Create `backend/src/auth/playerAuth.ts`**

```ts
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import { verifyToken, type PlayerTokenPayload } from "./tokens";

export function requirePlayer(config: Config, req: HandlerRequest): PlayerTokenPayload {
  const header = req.headers["authorization"] ?? req.headers["Authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = token ? verifyToken(token, config.tokenSigningSecret) : null;
  if (!payload || payload.type !== "player" || payload.campaignId !== config.campaignId) {
    throw new HttpError(401, "SESSION_EXPIRED", "Sessão expirada.");
  }
  return payload;
}
```

- [ ] **Step 2: Write the failing test `backend/src/routes/playerRoutes.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getMe, getGame, submitChoice } from "./playerRoutes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: "x",
  tokenSigningSecret: "secret", allowedOrigin: "*", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const token = (houseId: string) =>
  signToken({ type: "player", campaignId: "winter-dead", houseId, displayName: "Elira", exp: Date.now() + 60000 }, "secret");
const authReq = (houseId: string, over = {}) => ({
  method: "GET", path: "/", headers: { authorization: `Bearer ${token(houseId)}` },
  body: undefined, pathParams: {}, ...over,
});

beforeEach(() => ddb.reset());

describe("getGame", () => {
  it("returns only the caller's own house private content and 3 cards", async () => {
    ddb.on(GetCommand).resolves({}); // turn status + no choice
    const res = await getGame(deps, authReq("vargen"));
    const body = res.body as any;
    expect(body.houseId).toBe("vargen");
    expect(body.cards).toHaveLength(3);
    expect(body.privateInformation.length).toBeGreaterThan(0);
    // must not contain another house's private text
    expect(body.cards.every((c: any) => c.id.startsWith("vargen-"))).toBe(true);
  });

  it("rejects a request without a valid token", async () => {
    await expect(getGame(deps, { method: "GET", path: "/", headers: {}, body: undefined, pathParams: {} }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("submitChoice", () => {
  it("saves a valid card for the caller's house while open", async () => {
    ddb.on(GetCommand).resolves({}); // status OPEN
    ddb.on(PutCommand).resolves({});
    const res = await submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "vargen-defend-bridge" },
    }));
    expect(res.status).toBe(200);
    expect((res.body as any).cardId).toBe("vargen-defend-bridge");
  });

  it("rejects a card that does not belong to the house", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "auremont-send-caravans" },
    }))).rejects.toMatchObject({ status: 400, code: "INVALID_CARD" });
  });

  it("rejects a choice for a non-active turn (version conflict)", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "2" }, body: { cardId: "vargen-defend-bridge" },
    }))).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("blocks a choice when the turn is locked", async () => {
    ddb.on(GetCommand).resolves({ Item: { turnStatus: "LOCKED" } });
    await expect(submitChoice(deps, authReq("vargen", {
      method: "PUT", pathParams: { turnId: "1" }, body: { cardId: "vargen-defend-bridge" },
    }))).rejects.toMatchObject({ status: 423, code: "TURN_LOCKED" });
  });
});

describe("getMe", () => {
  it("returns the house from the token", async () => {
    const res = await getMe(deps, authReq("ravens"));
    expect((res.body as any).houseId).toBe("ravens");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/routes/playerRoutes.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `backend/src/routes/playerRoutes.ts`**

```ts
import { houses, turn001, type HouseId, type TurnCard } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getTurnStatus } from "../db/turns";
import { getChoice, putChoice } from "../db/choices";

function toCardView(card: TurnCard) {
  return {
    id: card.id,
    title: card.title,
    categories: card.categories,
    description: card.description,
    contribution: card.contribution,
    risk: card.risk,
    cost: card.cost,
  };
}

export async function getMe(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const house = houses[player.houseId as HouseId];
  return { status: 200, body: { houseId: house.id, houseName: house.name, displayName: player.displayName } };
}

export async function getGame(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId as HouseId;
  const house = houses[houseId];
  const content = turn001.houseContent[houseId];
  const [turnStatus, choice] = await Promise.all([
    getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id),
    getChoice(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, houseId),
  ]);
  const cards = content.cardIds.map((id) => toCardView(turn001.cards.find((c) => c.id === id)!));
  return {
    status: 200,
    body: {
      houseId: house.id,
      houseName: house.name,
      houseSubtitle: house.subtitle,
      privateIntroduction: house.privateIntroduction,
      displayName: player.displayName,
      kingdomState: turn001.stateBefore,
      turnId: turn001.id,
      turnTitle: turn001.title,
      publicEvent: turn001.publicEvent,
      privateInformation: content.privateInformation,
      cards,
      currentChoice: choice ? { cardId: choice.cardId, chosenAt: choice.chosenAt } : undefined,
      turnStatus,
      previousResult: undefined,
    },
  };
}

export async function submitChoice(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const houseId = player.houseId as HouseId;
  const turnId = Number(req.pathParams.turnId);

  if (turnId !== turn001.id) {
    throw new HttpError(409, "VERSION_CONFLICT", "Turno desatualizado.");
  }
  const body = req.body;
  const cardId = typeof body === "object" && body !== null ? (body as { cardId?: unknown }).cardId : undefined;
  if (typeof cardId !== "string") {
    throw new HttpError(400, "INVALID_BODY", "cardId obrigatório.");
  }

  const status = await getTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turnId);
  if (status === "LOCKED") {
    throw new HttpError(423, "TURN_LOCKED", "O Conselho está resolvendo o turno.");
  }

  const hand = turn001.houseContent[houseId].cardIds as readonly string[];
  if (!hand.includes(cardId)) {
    throw new HttpError(400, "INVALID_CARD", "Esta carta não pertence à sua Casa.");
  }

  const chosenAt = new Date().toISOString();
  await putChoice(deps.doc, deps.config.tableName, deps.config.campaignId, turnId, houseId, cardId, chosenAt);
  return { status: 200, body: { cardId, chosenAt } };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/routes/playerRoutes.test.ts --root backend`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/playerAuth.ts backend/src/routes/playerRoutes.ts backend/src/routes/playerRoutes.test.ts
git commit -m "feat(backend): add player auth and player route handlers"
```

---

## Task 10: Admin auth + admin route handlers (login, dashboard, lock, unlock)

**Files:**
- Create: `backend/src/auth/adminAuth.ts`
- Create: `backend/src/routes/adminRoutes.ts`
- Test: `backend/src/routes/adminRoutes.test.ts`

- [ ] **Step 1: Create `backend/src/auth/adminAuth.ts`**

```ts
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import { verifyToken } from "./tokens";

export function requireAdmin(config: Config, req: HandlerRequest): void {
  const header = req.headers["authorization"] ?? req.headers["Authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = token ? verifyToken(token, config.tokenSigningSecret) : null;
  if (!payload || payload.type !== "admin" || payload.campaignId !== config.campaignId) {
    throw new HttpError(401, "SESSION_EXPIRED", "Sessão de admin expirada.");
  }
}
```

- [ ] **Step 2: Write the failing test `backend/src/routes/adminRoutes.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { adminLogin, getDashboard, lockTurn, unlockTurn } from "./adminRoutes";
import { hashCode } from "../auth/codes";
import { signToken } from "../auth/tokens";
import type { Config } from "../types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const ADMIN_CODE = "admin-secret";
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: hashCode(ADMIN_CODE),
  tokenSigningSecret: "secret", allowedOrigin: "*", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const adminToken = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60000 }, "secret");
const authReq = (over = {}) => ({
  method: "GET", path: "/", headers: { authorization: `Bearer ${adminToken}` },
  body: undefined, pathParams: {}, ...over,
});

beforeEach(() => ddb.reset());

describe("adminLogin", () => {
  it("returns a token for the correct code", async () => {
    const res = await adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: ADMIN_CODE } });
    expect(res.status).toBe(200);
    expect((res.body as any).adminToken).toBeTruthy();
  });

  it("rejects a wrong code", async () => {
    await expect(adminLogin(deps, { method: "POST", path: "/", headers: {}, pathParams: {}, body: { adminCode: "wrong" } }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("getDashboard", () => {
  it("returns all six rows reflecting claims and choices", async () => {
    ddb.on(QueryCommand).callsFake((input) => {
      if (String(input.ExpressionAttributeValues[":pk"]).includes("TURN")) {
        return { Items: [{ houseId: "vargen", cardId: "vargen-defend-bridge", chosenAt: "t" }] };
      }
      return { Items: [{ SK: "HOUSE#vargen", houseId: "vargen", displayName: "Elira" }] };
    });
    ddb.on(GetCommand).resolves({}); // turn status OPEN
    const res = await getDashboard(deps, authReq());
    const body = res.body as any;
    expect(body.rows).toHaveLength(6);
    const vargen = body.rows.find((r: any) => r.houseId === "vargen");
    expect(vargen.claimed).toBe(true);
    expect(vargen.cardId).toBe("vargen-defend-bridge");
    expect(body.summaryText).toContain("Defender a Ponte");
  });

  it("rejects a request without an admin token", async () => {
    await expect(getDashboard(deps, { method: "GET", path: "/", headers: {}, pathParams: {}, body: undefined }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe("lock/unlock", () => {
  it("locks and unlocks the active turn", async () => {
    ddb.on(PutCommand).resolves({});
    expect((await lockTurn(deps, authReq({ method: "POST" }))).status).toBe(204);
    expect((await unlockTurn(deps, authReq({ method: "POST" }))).status).toBe(204);
    const puts = ddb.commandCalls(PutCommand);
    expect(puts[0].args[0].input.Item.turnStatus).toBe("LOCKED");
    expect(puts[1].args[0].input.Item.turnStatus).toBe("OPEN");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/routes/adminRoutes.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `backend/src/routes/adminRoutes.ts`**

```ts
import { houses, turn001, campaign, HOUSE_IDS, type HouseId } from "@ravenloft/content";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requireAdmin } from "../auth/adminAuth";
import { parseAdminLoginBody } from "../validation/schemas";
import { hashCode } from "../auth/codes";
import { signToken, type AdminTokenPayload } from "../auth/tokens";
import { getTurnStatus, setTurnStatus } from "../db/turns";
import { listHouseClaims } from "../db/players";
import { listChoices } from "../db/choices";

export async function adminLogin(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const { adminCode } = parseAdminLoginBody(req.body);
  if (hashCode(adminCode) !== deps.config.adminCodeHash) {
    throw new HttpError(401, "INVALID_CODE", "Código de admin inválido.");
  }
  const payload: AdminTokenPayload = {
    type: "admin",
    campaignId: deps.config.campaignId,
    exp: Date.now() + deps.config.tokenTtlSeconds * 1000,
  };
  return { status: 200, body: { adminToken: signToken(payload, deps.config.tokenSigningSecret) } };
}

export async function getDashboard(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const [claims, choices, turnStatus] = await Promise.all([
    listHouseClaims(deps.doc, tableName, campaignId),
    listChoices(deps.doc, tableName, campaignId, turn001.id),
    getTurnStatus(deps.doc, tableName, campaignId, turn001.id),
  ]);

  const rows = HOUSE_IDS.map((id: HouseId) => {
    const h = houses[id];
    const claim = claims.get(id);
    const choice = choices.get(id);
    const card = choice ? turn001.cards.find((c) => c.id === choice.cardId) : undefined;
    return {
      houseId: id,
      houseName: h.name,
      claimed: !!claim,
      displayName: claim?.displayName,
      cardId: choice?.cardId,
      cardTitle: card?.title,
      categories: card?.categories,
      chosenAt: choice?.chosenAt,
    };
  });

  const summaryText = rows.map((r) => `${r.houseName}: ${r.cardTitle ?? "(sem escolha)"}`).join("\n");

  return {
    status: 200,
    body: {
      activeTurnId: campaign.activeTurnId,
      turnTitle: turn001.title,
      turnStatus,
      kingdomState: turn001.stateBefore,
      rows,
      summaryText,
    },
  };
}

export async function lockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, "LOCKED");
  return { status: 204, body: undefined };
}

export async function unlockTurn(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  await setTurnStatus(deps.doc, deps.config.tableName, deps.config.campaignId, turn001.id, "OPEN");
  return { status: 204, body: undefined };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/routes/adminRoutes.test.ts --root backend`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/adminAuth.ts backend/src/routes/adminRoutes.ts backend/src/routes/adminRoutes.test.ts
git commit -m "feat(backend): add admin auth and admin route handlers"
```

---

## Task 11: Router + Lambda handler (dispatch, CORS, error mapping)

**Files:**
- Create: `backend/src/router.ts`
- Create: `backend/src/handler.ts`
- Test: `backend/src/router.test.ts`

- [ ] **Step 1: Write the failing test `backend/src/router.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { route } from "./router";
import type { Config } from "./types/domain";

const ddb = mockClient(DynamoDBDocumentClient);
const doc = ddb as unknown as DynamoDBDocumentClient;
const config: Config = {
  tableName: "ravenloft-game", campaignId: "winter-dead", adminCodeHash: "x",
  tokenSigningSecret: "secret", allowedOrigin: "http://localhost:5173", tokenTtlSeconds: 3600,
};
const deps = { doc, config };
const req = (method: string, path: string, over = {}) => ({ method, path, headers: {}, body: undefined, pathParams: {}, ...over });

beforeEach(() => ddb.reset());

describe("route", () => {
  it("dispatches GET /api/campaign", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await route(deps, req("GET", "/api/campaign"));
    expect(res.status).toBe(200);
    expect((res.body as any).contentVersion).toBeTruthy();
  });

  it("dispatches PUT /api/turns/:turnId/choice with a path param", async () => {
    ddb.on(GetCommand).resolves({});
    const res = await route(deps, req("PUT", "/api/turns/2/choice", {
      headers: {}, body: { cardId: "x" },
    }));
    // no auth header -> 401 from requirePlayer (proves routing reached the handler)
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await route(deps, req("GET", "/api/nope"));
    expect(res.status).toBe(404);
  });

  it("maps HttpError to its status without leaking internals", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    const res = await route(deps, req("POST", "/api/claim-house", { body: { houseId: "nope" } }));
    expect(res.status).toBe(400);
    expect((res.body as any).code).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/stack|DynamoDB/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/router.test.ts --root backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/router.ts`**

```ts
import type { HandlerRequest, HandlerResponse } from "./types/domain";
import { HttpError } from "./types/domain";
import { getCampaign, getHouses, claimHouse, login, type Deps } from "./routes/publicRoutes";
import { getMe, getGame, submitChoice } from "./routes/playerRoutes";
import { adminLogin, getDashboard, lockTurn, unlockTurn } from "./routes/adminRoutes";

type Handler = (deps: Deps, req: HandlerRequest) => Promise<HandlerResponse>;

interface Route {
  method: string;
  pattern: RegExp;
  params: string[];
  handler: Handler;
}

function r(method: string, path: string, handler: Handler): Route {
  const params: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:[^/]+/g, (m) => {
        params.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$",
  );
  return { method, pattern, params, handler };
}

const routes: Route[] = [
  r("GET", "/api/campaign", getCampaign),
  r("GET", "/api/houses", getHouses),
  r("POST", "/api/claim-house", claimHouse),
  r("POST", "/api/player/login", login),
  r("GET", "/api/player/me", getMe),
  r("GET", "/api/player/game", getGame),
  r("PUT", "/api/turns/:turnId/choice", submitChoice),
  r("POST", "/api/admin/login", adminLogin),
  r("GET", "/api/admin/dashboard", getDashboard),
  r("POST", "/api/admin/turn/lock", lockTurn),
  r("POST", "/api/admin/turn/unlock", unlockTurn),
];

export async function route(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  try {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(req.path);
      if (!match) continue;
      const pathParams: Record<string, string> = {};
      route.params.forEach((name, i) => (pathParams[name] = match[i + 1]));
      return await route.handler(deps, { ...req, pathParams });
    }
    return { status: 404, body: { code: "NOT_FOUND", message: "Rota não encontrada." } };
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, body: { code: e.code, message: e.message } };
    }
    console.error("Unhandled error", (e as Error)?.name);
    return { status: 500, body: { code: "INTERNAL", message: "Erro interno." } };
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/router.test.ts --root backend`
Expected: PASS (4 tests).

- [ ] **Step 5: Create `backend/src/handler.ts` (Lambda entry point)**

```ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { loadConfig } from "./config";
import { makeDocClient } from "./db/dynamo";
import { route } from "./router";
import type { HandlerRequest } from "./types/domain";

const config = loadConfig();
const doc = makeDocClient(process.env.AWS_REGION);
const deps = { doc, config };

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  let body: unknown;
  if (event.body) {
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body);
    } catch {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ code: "INVALID_BODY", message: "JSON inválido." }) };
    }
  }

  const req: HandlerRequest = {
    method,
    path: event.rawPath,
    headers: event.headers ?? {},
    body,
    pathParams: {},
  };

  const res = await route(deps, req);
  return {
    statusCode: res.status,
    headers: corsHeaders(),
    body: res.body === undefined ? "" : JSON.stringify(res.body),
  };
}
```

- [ ] **Step 6: Typecheck the whole backend**

Run: `npm run build:shared && npm run typecheck --workspace backend`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add backend/src/router.ts backend/src/router.test.ts backend/src/handler.ts
git commit -m "feat(backend): add router and Lambda handler entry point"
```

---

## Task 12: SAM template + esbuild bundle + seed script

**Files:**
- Create: `backend/template.yaml`
- Create: `backend/scripts/seed-campaign.ts`
- Modify: root `package.json` (add `seed` + `deploy:backend` scripts)

- [ ] **Step 1: Create `backend/template.yaml`**

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: Ravenloft O Inverno dos Mortos - backend

Parameters:
  AdminCodeHash:
    Type: String
    NoEcho: true
  TokenSigningSecret:
    Type: String
    NoEcho: true
  AllowedOrigin:
    Type: String
    Default: "http://localhost:5173"

Globals:
  Function:
    Timeout: 10
    MemorySize: 256
    Runtime: nodejs20.x

Resources:
  GameTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ravenloft-game
      BillingMode: PAY_PER_REQUEST
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE

  ApiFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: node20
        Format: esm
        OutExtension:
          - .js=.mjs
        EntryPoints:
          - src/handler.ts
    Properties:
      Handler: handler.handler
      CodeUri: .
      Environment:
        Variables:
          TABLE_NAME: !Ref GameTable
          CAMPAIGN_ID: winter-dead
          ADMIN_CODE_HASH: !Ref AdminCodeHash
          TOKEN_SIGNING_SECRET: !Ref TokenSigningSecret
          ALLOWED_ORIGIN: !Ref AllowedOrigin
      Policies:
        - Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
                - dynamodb:Query
                - dynamodb:TransactWriteItems
              Resource:
                - !GetAtt GameTable.Arn
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /{proxy+}
            Method: ANY

  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - !Ref AllowedOrigin
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowHeaders:
          - Content-Type
          - Authorization

Outputs:
  ApiBaseUrl:
    Description: Base URL of the HTTP API
    Value: !Sub "https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com"
  TableName:
    Value: !Ref GameTable
```

- [ ] **Step 2: Create `backend/scripts/seed-campaign.ts`**

This writes the campaign META item and initial turn status so the table is ready. It is idempotent (PutItem overwrites).

```ts
import { campaign } from "@ravenloft/content";
import { makeDocClient } from "../src/db/dynamo";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, turnPk } from "../src/keys";

async function main() {
  const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
  const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
  const doc = makeDocClient(process.env.AWS_REGION ?? "us-east-1");

  await doc.send(new PutCommand({
    TableName: tableName,
    Item: { PK: campaignPk(campaignId), SK: "META", campaignId, activeTurnId: campaign.activeTurnId },
  }));
  await doc.send(new PutCommand({
    TableName: tableName,
    Item: { PK: turnPk(campaignId, campaign.activeTurnId), SK: "META", turnStatus: "OPEN" },
  }));
  console.log(`Seeded campaign ${campaignId} into ${tableName}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add root scripts**

Add to root `package.json` scripts (keep existing):

```json
{
  "seed": "tsx backend/scripts/seed-campaign.ts",
  "deploy:backend": "cd backend && sam build && sam deploy"
}
```

- [ ] **Step 4: Verify the SAM build bundles the Lambda**

Run: `cd backend && sam build`
Expected: `Build Succeeded`. If `sam build` requires Docker and none is present, run instead `npm run build --workspace backend` and confirm `backend/dist/handler.mjs` is produced (the esbuild command in `package.json`); note in the task report which path was used.

- [ ] **Step 5: Commit**

```bash
git add backend/template.yaml backend/scripts/seed-campaign.ts package.json
git commit -m "feat(backend): add SAM template, seed script, and deploy scripts"
```

---

## Task 13: Full backend test + typecheck gate

**Files:** none (verification task).

- [ ] **Step 1: Run the full backend suite**

Run: `npm run build:shared && npm run test --workspace backend`
Expected: all suites green (tokens 5, codes 4, config 2, players 5, turns 3, choices 3, schemas 5, publicRoutes 6, playerRoutes 7, adminRoutes 6, router 4).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace backend`
Expected: exits 0.

- [ ] **Step 3: Run the repo-wide test gate**

Run: `npm test`
Expected: content validation passes; shared, backend, and frontend suites all green.

- [ ] **Step 4: Commit (if any incidental fixes were needed)**

```bash
git add -A
git commit -m "test(backend): verify full backend suite and repo test gate"
```

---

## Definition of done (Phase 2)

- All backend unit suites pass (`npm run test --workspace backend`).
- `npm test` (repo-wide) passes: content validation + shared + backend + frontend.
- `backend/src/handler.ts` builds via esbuild to a single `.mjs` (or `sam build` succeeds).
- Security rules from design §8 are enforced in code and covered by tests: atomic claim (409), own-house-only game content, card-ownership check, version guard, lock guard, admin-token requirement on admin routes, no secret/stack leakage in error bodies.
- Response shapes match `frontend/src/types/api.ts` so the Phase-3 HTTP client is a drop-in for `MockApiClient`.

## Handoff to Phase 3

Phase 3 adds `frontend/src/api/httpClient.ts` implementing the same `ApiClient` interface by calling these routes, switches `frontend/src/api/index.ts` to use it (driven by `VITE_API_BASE_URL`), and adds admin token handling on the client. No backend changes required.
