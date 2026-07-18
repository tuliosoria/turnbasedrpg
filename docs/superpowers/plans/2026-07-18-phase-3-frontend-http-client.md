# Phase 3: Frontend HTTP Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory `MockApiClient` with a real `HttpApiClient` that calls the Phase-2 backend routes, selected at runtime by the `VITE_API_BASE_URL` env var (falling back to the mock when unset), with zero changes to any React component.

**Architecture:** `HttpApiClient` implements the exact same `ApiClient` interface as `MockApiClient`. It uses `fetch`, sends the player/admin token as a `Bearer` Authorization header, serialises JSON bodies, maps backend error bodies (`{code, message}`) to `ApiError`, treats `204` as `void`, and converts connection failures to `ApiError("NETWORK", ...)`. `frontend/src/api/index.ts` picks the implementation based on `import.meta.env.VITE_API_BASE_URL`.

**Tech Stack:** TypeScript, Vite (`import.meta.env`), Vitest + jsdom, global `fetch` (mocked in tests with `vi.fn`).

---

## Route contract (from Phase 2 backend)

| ApiClient method | HTTP | Path | Auth | Request body | Success |
|---|---|---|---|---|---|
| getCampaign | GET | /api/campaign | — | — | 200 CampaignSummary |
| getHouses | GET | /api/houses | — | — | 200 HouseSummary[] |
| claimHouse | POST | /api/claim-house | — | {houseId, displayName} | 201 ClaimResult |
| login | POST | /api/player/login | — | {playerCode} | 200 LoginResult |
| getGame | GET | /api/player/game | Bearer player | — | 200 PlayerGameView |
| submitChoice | PUT | /api/turns/:turnId/choice | Bearer player | {cardId} | 200 CurrentChoice |
| adminLogin | POST | /api/admin/login | — | {adminCode} | 200 {adminToken} |
| getAdminDashboard | GET | /api/admin/dashboard | Bearer admin | — | 200 AdminDashboard |
| lockTurn | POST | /api/admin/turn/lock | Bearer admin | — | 204 |
| unlockTurn | POST | /api/admin/turn/unlock | Bearer admin | — | 204 |

Error responses are `{code, message}` with HTTP status; `code` values include HOUSE_TAKEN, INVALID_CODE, TURN_LOCKED, INVALID_CARD, SESSION_EXPIRED, VERSION_CONFLICT (plus server-only INVALID_BODY/INTERNAL/NOT_FOUND). Base URL is the API root (no `/api` suffix); the client prepends the table paths.

---

## Task 1: Vite env typing

**Files:**
- Create: `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Create the env typing file**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/vite-env.d.ts
git commit -m "feat(frontend): add vite env typing for VITE_API_BASE_URL"
```

---

## Task 2: HttpApiClient (TDD)

**Files:**
- Create: `frontend/src/api/httpClient.ts`
- Test: `frontend/src/api/httpClient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpApiClient } from "./httpClient";
import { ApiError } from "../types/api";

const BASE = "https://api.example.com";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("HttpApiClient", () => {
  it("GETs the campaign and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "winter-dead", title: "T" }));
    const client = new HttpApiClient(BASE);
    const result = await client.getCampaign();
    expect(result).toMatchObject({ id: "winter-dead" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/campaign");
    expect(init.method).toBe("GET");
  });

  it("strips a trailing slash from the base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await new HttpApiClient("https://api.example.com/").getHouses();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/houses");
  });

  it("POSTs claim-house with a JSON body and content-type header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { playerCode: "vargen-4K7P" }));
    await new HttpApiClient(BASE).claimHouse("vargen", "Elira");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/claim-house");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ houseId: "vargen", displayName: "Elira" });
  });

  it("sends the player token as a Bearer header on getGame", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { houseId: "vargen" }));
    await new HttpApiClient(BASE).getGame("tok-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/player/game");
    expect(init.headers["Authorization"]).toBe("Bearer tok-123");
  });

  it("PUTs a choice to the turn path with a Bearer token and cardId body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { cardId: "vargen-defend-bridge", chosenAt: "t" }));
    const res = await new HttpApiClient(BASE).submitChoice("tok", 1, "vargen-defend-bridge");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/turns/1/choice");
    expect(init.method).toBe("PUT");
    expect(init.headers["Authorization"]).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ cardId: "vargen-defend-bridge" });
    expect(res).toEqual({ cardId: "vargen-defend-bridge", chosenAt: "t" });
  });

  it("returns undefined (void) for a 204 lockTurn", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await new HttpApiClient(BASE).lockTurn("admin-tok");
    expect(res).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer admin-tok");
  });

  it("maps an error body to ApiError with its code and message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: "HOUSE_TAKEN", message: "Casa tomada." }));
    await expect(new HttpApiClient(BASE).claimHouse("vargen", "Elira")).rejects.toMatchObject({
      name: "ApiError",
      code: "HOUSE_TAKEN",
      message: "Casa tomada.",
    });
  });

  it("throws ApiError NETWORK when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await new HttpApiClient(BASE).getCampaign().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts`
Expected: FAIL — cannot find module `./httpClient`.

- [ ] **Step 3: Implement `frontend/src/api/httpClient.ts`**

```ts
import type { ApiClient } from "./client";
import {
  ApiError,
  type ApiErrorCode,
  type CampaignSummary,
  type HouseSummary,
  type ClaimResult,
  type LoginResult,
  type PlayerGameView,
  type CurrentChoice,
  type AdminDashboard,
} from "../types/api";
import type { HouseId } from "@ravenloft/content";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export class HttpApiClient implements ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError("NETWORK", "Não foi possível conectar ao servidor.");
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }

    if (!res.ok) {
      const err = data as { code?: string; message?: string } | undefined;
      const code = (err?.code ?? "NETWORK") as ApiErrorCode;
      throw new ApiError(code, err?.message ?? "Erro inesperado.");
    }
    return data as T;
  }

  getCampaign(): Promise<CampaignSummary> {
    return this.request<CampaignSummary>("/api/campaign");
  }

  getHouses(): Promise<HouseSummary[]> {
    return this.request<HouseSummary[]>("/api/houses");
  }

  claimHouse(houseId: HouseId, displayName: string): Promise<ClaimResult> {
    return this.request<ClaimResult>("/api/claim-house", {
      method: "POST",
      body: { houseId, displayName },
    });
  }

  login(playerCode: string): Promise<LoginResult> {
    return this.request<LoginResult>("/api/player/login", {
      method: "POST",
      body: { playerCode },
    });
  }

  getGame(playerToken: string): Promise<PlayerGameView> {
    return this.request<PlayerGameView>("/api/player/game", { token: playerToken });
  }

  submitChoice(playerToken: string, turnId: number, cardId: string): Promise<CurrentChoice> {
    return this.request<CurrentChoice>(`/api/turns/${turnId}/choice`, {
      method: "PUT",
      body: { cardId },
      token: playerToken,
    });
  }

  adminLogin(adminCode: string): Promise<{ adminToken: string }> {
    return this.request<{ adminToken: string }>("/api/admin/login", {
      method: "POST",
      body: { adminCode },
    });
  }

  getAdminDashboard(adminToken: string): Promise<AdminDashboard> {
    return this.request<AdminDashboard>("/api/admin/dashboard", { token: adminToken });
  }

  async lockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/lock", { method: "POST", token: adminToken });
  }

  async unlockTurn(adminToken: string): Promise<void> {
    await this.request<void>("/api/admin/turn/unlock", { method: "POST", token: adminToken });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/httpClient.ts frontend/src/api/httpClient.test.ts
git commit -m "feat(frontend): add HttpApiClient implementing the ApiClient interface"
```

---

## Task 3: Runtime client selection (TDD)

**Files:**
- Modify: `frontend/src/api/index.ts`
- Test: `frontend/src/api/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("apiClient selection", () => {
  it("uses the mock client when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const { apiClient } = await import("./index");
    expect(apiClient.constructor.name).toBe("MockApiClient");
  });

  it("uses the HTTP client when VITE_API_BASE_URL is set", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiClient } = await import("./index");
    expect(apiClient.constructor.name).toBe("HttpApiClient");
  });
});
```

> Note: `constructor.name` is used instead of `instanceof` because `vi.resetModules()` creates a fresh class identity for the dynamically imported module, which would break an `instanceof` check against a statically imported class.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/api/index.test.ts`
Expected: FAIL — the current `index.ts` always returns a `MockApiClient`, so the second test fails.

- [ ] **Step 3: Update `frontend/src/api/index.ts`**

```ts
import { MockApiClient } from "./mockClient";
import { HttpApiClient } from "./httpClient";
import type { ApiClient } from "./client";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export const apiClient: ApiClient =
  baseUrl && baseUrl.length > 0 ? new HttpApiClient(baseUrl) : new MockApiClient();
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/api/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/index.ts frontend/src/api/index.test.ts
git commit -m "feat(frontend): select HTTP or mock client via VITE_API_BASE_URL"
```

---

## Task 4: Env documentation + full gate

**Files:**
- Create: `frontend/.env.example`

- [ ] **Step 1: Create `frontend/.env.example`**

```
# Base URL of the deployed backend HTTP API (no trailing /api).
# Leave unset to use the in-browser MockApiClient for local UI development.
VITE_API_BASE_URL=
```

- [ ] **Step 2: Build the frontend**

Run: `npm run build`
Expected: `tsc -b` clean + Vite build succeeds.

- [ ] **Step 3: Run the repo-wide test gate**

Run: `npm test`
Expected: content validation + shared + backend + frontend suites all green (frontend now 36: prior 25 + httpClient 9 + index 2).

- [ ] **Step 4: Commit**

```bash
git add frontend/.env.example
git commit -m "docs(frontend): document VITE_API_BASE_URL and env example"
```

---

## Definition of done (Phase 3)

- `HttpApiClient` implements `ApiClient` and is a drop-in replacement for `MockApiClient` (no component changes).
- Token is sent as `Bearer`; JSON bodies serialised; `204` → `void`; error bodies → `ApiError`; connection failure → `ApiError("NETWORK")`.
- `frontend/src/api/index.ts` selects the client by `VITE_API_BASE_URL`, defaulting to the mock.
- `npm run build` and `npm test` both pass.

## Handoff to Phase 4

Phase 4 deploys the backend (SAM) to AWS, seeds the table, and builds/serves the frontend with `VITE_API_BASE_URL` pointing at the deployed API base URL.
