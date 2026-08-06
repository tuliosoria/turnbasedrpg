# House Projects (Projetos da Casa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add continuous, multi-turn House Projects (predefined card library, AI custom-card generator, GM approval, inter-House Favors, a new Stability resource, and turn-based auto-processing) to the Valdren turn-based political RPG.

**Architecture:** Pure rules engine + single-table DynamoDB persistence on the backend; projects auto-advance inside the existing `applyResolution` turn hook (idempotent via `lastProcessedTurnId`); an AI generator produces balanced cards from public canon; a 3-implementation API layer (interface/HTTP/mock) feeds new MUI player and GM panels.

**Tech Stack:** TypeScript monorepo (npm workspaces): `shared` (`@ravenloft/content`), `backend` (AWS SAM/Lambda + DynamoDB Document client), `frontend` (React + MUI + Vite). Tests: vitest (+ Testing Library on frontend).

**Source of truth:** `docs/superpowers/specs/2026-08-05-house-projects-design.md` (committed). Appendix A of that spec is the mechanical encoding of all 64 cards; Task 3 transcribes it.

**Conventions to follow (verified in codebase):**
- Shared import name is `@ravenloft/content`; source files use `.js` extensions in imports; new files must be added to `shared/src/index.ts` exports.
- DynamoDB single table `ravenloft-game`, campaign `winter-dead`; items share `PK = campaignPk(id)` and differ by `SK`; use `QueryCommand` with `begins_with`, never Scan.
- Router registers fixed paths only (no `:param` REST paths); IDs travel in the request body.
- Validation uses hand-written parsers in `backend/src/validation/schemas.ts` throwing `HttpError(400,"INVALID_BODY",...)`.
- AI uses `generateJson(chat, system, user, parse, attempts)`; parsers throw `HttpError(502,"AI_PARSE",...)` on bad JSON to trigger retry.
- Frontend API has three implementations kept in sync: `ApiClient` interface (`client.ts`), `HttpApiClient` (`httpClient.ts`), `MockApiClient` (`mockClient.ts`).
- All user-facing strings are Portuguese.
- Run the full shared build (`npm run build --workspace shared`) before running the test suites.

---

## File Structure

**Shared (`shared/src/`)**
- `types.ts` (modify) — add Stability constants, `House.stability`, `houseStability()`.
- `projects.ts` (create) — all project/favor types.
- `projectTemplates.ts` (create) — `DEFAULT_PROJECT_TEMPLATES` (64 cards from Appendix A).
- `index.ts` (modify) — re-export the two new files.

**Backend (`backend/src/`)**
- `keys.ts` (modify) — project/favor SK helpers.
- `db/projects.ts` (create) — project + favor persistence.
- `db/houses.ts` (modify) — persist/read `stability` + `assets`.
- `projects/engine.ts` (create) — pure rules engine.
- `ai/projectPrompts.ts` (create) — prompt builder + `parseProjectCardProposal`.
- `validation/schemas.ts` (modify) — body parsers.
- `routes/projectRoutes.ts` (create) — player handlers.
- `routes/adminRoutes.ts` (modify) — GM handlers + turn-processing hook in `applyResolution`.
- `router.ts` (modify) — register routes.

**Frontend (`frontend/src/`)**
- `types/api.ts` (modify) — re-export project types + input shapes.
- `api/client.ts` (modify) — `ApiClient` methods.
- `api/httpClient.ts` (modify) — `HttpApiClient` methods.
- `api/mockClient.ts` (modify) — `MockApiClient` methods (mirror server rules).
- `components/HouseProjectsPanel.tsx` (create) — player UI.
- `components/admin/AdminProjectsTab.tsx` (create) — GM UI.
- `pages/GamePage.tsx` (modify) — render panel.
- `pages/AdminPage.tsx` (modify) — add `projetos` tab.

---

## Task 1: Stability resource in shared types

**Files:**
- Modify: `shared/src/types.ts`
- Test: `shared/src/types.stability.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// shared/src/types.stability.test.ts
import { describe, it, expect } from "vitest";
import { STABILITY_DEFAULT, STABILITY_MIN, STABILITY_MAX, houseStability } from "./types.js";
import type { House } from "./types.js";

const base: House = {
  houseId: "h1", name: "Casa", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "",
  specialty: "", weakness: "", attributes: { riqueza: 2, recursos: 2, soldados: 3, controle: 3 },
  createdAt: "2026-01-01T00:00:00Z",
};

describe("stability", () => {
  it("exposes constants", () => {
    expect(STABILITY_DEFAULT).toBe(3);
    expect(STABILITY_MIN).toBe(0);
    expect(STABILITY_MAX).toBe(5);
  });
  it("defaults when field is absent", () => {
    expect(houseStability(base)).toBe(3);
  });
  it("returns stored value when present", () => {
    expect(houseStability({ ...base, stability: 5 })).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace shared -- types.stability`
Expected: FAIL — `STABILITY_DEFAULT`/`houseStability` not exported.

- [ ] **Step 3: Write minimal implementation**

In `shared/src/types.ts`, add after `export const ATTR_MIN = 0;`:

```ts
export const STABILITY_DEFAULT = 3;
export const STABILITY_MIN = 0;
export const STABILITY_MAX = 5;
```

Add `stability?: number;` and `assets?: string[];` to the `House` interface (after `imageUrls?: string[];`):

```ts
  imageUrls?: string[];
  stability?: number;
  assets?: string[];
```

Add the helper at the end of the file:

```ts
export function houseStability(house: House): number {
  return house.stability ?? STABILITY_DEFAULT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace shared -- types.stability`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/types.ts shared/src/types.stability.test.ts
git commit -m "feat(shared): add Stability resource and houseStability helper"
```

---

## Task 2: Project & Favor types

**Files:**
- Create: `shared/src/projects.ts`
- Modify: `shared/src/index.ts`
- Test: `shared/src/projects.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// shared/src/projects.test.ts
import { describe, it, expect } from "vitest";
import { PROJECT_CATEGORIES, PROJECT_STATUSES, isProjectCategory } from "./projects.js";

describe("project enums", () => {
  it("lists 8 categories", () => {
    expect(PROJECT_CATEGORIES).toHaveLength(8);
    expect(PROJECT_CATEGORIES).toContain("MILITARY");
    expect(PROJECT_CATEGORIES).toContain("MAGIC");
  });
  it("includes lifecycle statuses", () => {
    expect(PROJECT_STATUSES).toContain("ACTIVE");
    expect(PROJECT_STATUSES).toContain("PENDING_GM");
    expect(PROJECT_STATUSES).toContain("COMPLETED");
  });
  it("validates category strings", () => {
    expect(isProjectCategory("MILITARY")).toBe(true);
    expect(isProjectCategory("BANANA")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace shared -- projects.test`
Expected: FAIL — module `./projects.js` not found.

- [ ] **Step 3: Write minimal implementation**

Create `shared/src/projects.ts` with the full data model from the spec, plus runtime enum arrays and a guard:

```ts
import type { AttributeKey } from "./types.js";

export const PROJECT_CATEGORIES = [
  "MILITARY", "INFRASTRUCTURE", "ECONOMY", "DIPLOMACY",
  "INTELLIGENCE", "SOCIETY", "MAGIC", "EXPLORATION",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export function isProjectCategory(v: string): v is ProjectCategory {
  return (PROJECT_CATEGORIES as readonly string[]).includes(v);
}

export const PROJECT_STATUSES = [
  "DRAFT", "PENDING_AI", "PENDING_PLAYER", "PENDING_TARGET",
  "PENDING_GM", "APPROVED", "ACTIVE", "PAUSED",
  "COMPLETED", "CANCELLED", "REJECTED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_COST_TYPES = [
  "WEALTH", "RESOURCES", "SOLDIERS_COMMITTED", "CONTROL_COMMITTED",
  "STABILITY", "FAVOR", "CUSTOM",
] as const;
export type ProjectCostType = (typeof PROJECT_COST_TYPES)[number];

export type CostTiming = "ON_START" | "PER_TURN" | "ON_COMPLETION";

export interface ProjectCost {
  type: ProjectCostType;
  amount: number;
  timing: CostTiming;
  note?: string;
}

export type StabilityKey = "stability";
export type EffectAttribute = AttributeKey | StabilityKey;

export interface AttributeChange {
  attribute: EffectAttribute;
  amount: number;
  permanent: boolean;
  durationTurns?: number | null;
}

export interface FavorEffect {
  targetHouseId: string;
  amount: number;
  requiresAcceptance: boolean;
}

export interface CompletionEffects {
  attributeChanges: AttributeChange[];
  favors: FavorEffect[];
  assets: string[];
  qualitativeEffects: string[];
  unlocks: string[];
}

export interface ProjectCard {
  id: string;
  campaignId: string;
  houseId: string;
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  status: ProjectStatus;
  durationTurns: number;
  turnsCompleted: number;
  lastProcessedTurnId: number | null;
  costs: ProjectCost[];
  requirements: string[];
  completionEffects: CompletionEffects;
  risks: string[];
  complications: string[];
  targetHouseId: string | null;
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
  playerOriginalRequest: string | null;
  gmNotes: string | null;
  templateId: string | null;
  createdBy: "PLAYER" | "AI" | "GM";
  createdAtTurn: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  description: string;
  completionEffects: CompletionEffects;
  risks: string[];
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
}

export interface Favor {
  id: string;
  campaignId: string;
  fromHouseId: string;
  toHouseId: string;
  amount: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomProjectInput {
  request: string;
  targetHouseId?: string | null;
  desiredOutcome?: string;
  maxSpend?: number;
  riskLevel?: "low" | "medium" | "high";
}

export function emptyCompletionEffects(): CompletionEffects {
  return { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] };
}
```

- [ ] **Step 4: Export from index and run test**

Add to `shared/src/index.ts` (after `export * from "./types.js";`):

```ts
export * from "./projects.js";
```

Run: `npm run test --workspace shared -- projects.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/projects.ts shared/src/index.ts shared/src/projects.test.ts
git commit -m "feat(shared): add project and favor domain types"
```

---

## Task 3: Predefined project templates library

Transcribe **all 64 cards from Appendix A** of the spec into
`DEFAULT_PROJECT_TEMPLATES`. Rules for encoding (from the spec):
- `id` = kebab-case of the Portuguese title (e.g. `recrutar-companhias-errantes`).
- Costs: each `type:amount` becomes `{ type, amount, timing: "ON_START" }`
  unless the card notes another timing.
- Permanent attribute gains (cards 1, 15, 18, 19, 49) → one `attributeChanges`
  entry with `permanent: true`. Card 1 grants `soldados +1`; 15 `recursos +1`;
  18 `riqueza +1`; 19 `riqueza +1`; 49 `stability +1`.
- All narrative/OR-choice/asset outcomes → `qualitativeEffects` strings; assets
  also listed in `completionEffects.assets`.
- `requiresTargetApproval`/`requiresGmApproval` per the Appendix flags.
- `risks` from the "risk:" notes; `requirements` from the "req:" notes.

**Files:**
- Create: `shared/src/projectTemplates.ts`
- Modify: `shared/src/index.ts`
- Test: `shared/src/projectTemplates.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// shared/src/projectTemplates.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES, getTemplate } from "./projectTemplates.js";
import { isProjectCategory } from "./projects.js";

describe("DEFAULT_PROJECT_TEMPLATES", () => {
  it("has all 64 cards", () => {
    expect(DEFAULT_PROJECT_TEMPLATES).toHaveLength(64);
  });
  it("every template is structurally valid", () => {
    for (const t of DEFAULT_PROJECT_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(isProjectCategory(t.category)).toBe(true);
      expect(t.durationTurns).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(t.costs)).toBe(true);
      expect(t.completionEffects).toBeDefined();
    }
  });
  it("ids are unique", () => {
    const ids = DEFAULT_PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("encodes a permanent attribute card (Abrir uma Nova Mina → recursos +1)", () => {
    const mina = getTemplate("abrir-uma-nova-mina");
    expect(mina?.completionEffects.attributeChanges).toEqual([
      { attribute: "recursos", amount: 1, permanent: true },
    ]);
  });
  it("marks a diplomacy card as requiring target approval", () => {
    const presente = getTemplate("enviar-um-presente-cerimonial");
    expect(presente?.requiresTargetApproval).toBe(true);
  });
  it("marks Contratar a Ordem dos Três as requiring GM approval", () => {
    expect(getTemplate("contratar-a-ordem-dos-tres")?.requiresGmApproval).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace shared -- projectTemplates`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `shared/src/projectTemplates.ts`. Below are four **fully-worked examples**
covering every pattern; transcribe the remaining 60 cards from Appendix A the
same way (permanent-attr, qualitative-only+asset, target-approval,
gm-approval). Use `emptyCompletionEffects()` spread for brevity.

```ts
import type { ProjectTemplate } from "./projects.js";

const ce = (over: Partial<ProjectTemplate["completionEffects"]> = {}) => ({
  attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [], ...over,
});

export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  // 1 — permanent attribute + risk
  {
    id: "recrutar-companhias-errantes", title: "Recrutar Companhias Errantes", category: "MILITARY",
    durationTurns: 3,
    costs: [
      { type: "WEALTH", amount: 1, timing: "ON_START" },
      { type: "STABILITY", amount: 1, timing: "ON_START" },
    ],
    requirements: ["Acesso a um povo errante ou mercenário"],
    description: "Recruta guerreiros errantes para engrossar suas fileiras.",
    completionEffects: ce({ attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }] }),
    risks: ["Os novos guerreiros exigirão terras, pagamento ou direitos futuros."],
    requiresTargetApproval: false, requiresGmApproval: false,
  },
  // 2 — asset + qualitative only
  {
    id: "treinar-a-milicia-popular", title: "Treinar a Milícia Popular", category: "MILITARY",
    durationTurns: 2,
    costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }],
    requirements: [],
    description: "Treina o povo para defender o próprio território.",
    completionEffects: ce({
      assets: ["Milícia Local"],
      qualitativeEffects: ["Concede bônus defensivo dentro do próprio território. Não aumenta Soldados permanentemente."],
    }),
    risks: ["A retirada de trabalhadores pode prejudicar produção ou colheitas."],
    requiresTargetApproval: false, requiresGmApproval: false,
  },
  // 25 — diplomacy, requires target approval
  {
    id: "enviar-um-presente-cerimonial", title: "Enviar um Presente Cerimonial", category: "DIPLOMACY",
    durationTurns: 1,
    costs: [{ type: "WEALTH", amount: 1, timing: "ON_START" }],
    requirements: [],
    description: "Envia um presente cerimonial a outra Casa para gerar boa vontade.",
    completionEffects: ce({ qualitativeEffects: ["Gera boa vontade; se culturalmente relevante e aceito, pode gerar 1 Favor."] }),
    risks: [],
    requiresTargetApproval: true, requiresGmApproval: false,
  },
  // 59 — magic, requires GM approval
  {
    id: "contratar-a-ordem-dos-tres", title: "Contratar a Ordem dos Três", category: "MAGIC",
    durationTurns: 3,
    costs: [{ type: "WEALTH", amount: 2, timing: "ON_START" }],
    requirements: [],
    description: "Contrata a Ordem dos Três para realizar um ritual mágico específico.",
    completionEffects: ce({ qualitativeEffects: ["Ritual mágico específico. A Ordem pode recusar pedidos perigosos ou imprudentes."] }),
    risks: ["A Ordem pode recusar o pedido."],
    requiresTargetApproval: false, requiresGmApproval: true,
  },
  // ... transcribe cards 3-24, 26-58, 60-64 from Appendix A following the same shape.
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return DEFAULT_PROJECT_TEMPLATES.find((t) => t.id === id);
}
```

> **Transcription checklist (Appendix A → template):** MILITARY 1-12,
> INFRASTRUCTURE/ECONOMY 13-24, DIPLOMACY 25-36 (all `requiresTargetApproval:
> true`; 28 also `requiresGmApproval: true`), INTELLIGENCE 37-46, SOCIETY 47-56,
> EXPLORATION/MAGIC 57-64 (59 & 62 `requiresGmApproval: true`). Permanent
> attribute cards: 1 soldados, 15 recursos, 18 riqueza, 19 riqueza, 49 stability.
> All others: empty `attributeChanges`, effects as `qualitativeEffects` + assets.

- [ ] **Step 4: Export and run test**

Add to `shared/src/index.ts`:

```ts
export * from "./projectTemplates.js";
```

Run: `npm run test --workspace shared -- projectTemplates`
Expected: PASS (64 templates, all assertions green).

- [ ] **Step 5: Commit**

```bash
git add shared/src/projectTemplates.ts shared/src/index.ts shared/src/projectTemplates.test.ts
git commit -m "feat(shared): add predefined project template library (64 cards)"
```

---

## Task 4: DynamoDB key helpers

**Files:**
- Modify: `backend/src/keys.ts`
- Test: `backend/src/keys.projects.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/keys.projects.test.ts
import { describe, it, expect } from "vitest";
import { projectSk, projectHousePrefix, projectPrefix, favorSk, favorHousePrefix } from "./keys";

describe("project/favor keys", () => {
  it("builds project SK", () => {
    expect(projectSk("casa-abcd", "p1")).toBe("PROJECT#casa-abcd#p1");
  });
  it("builds project house prefix", () => {
    expect(projectHousePrefix("casa-abcd")).toBe("PROJECT#casa-abcd#");
  });
  it("builds project prefix", () => {
    expect(projectPrefix()).toBe("PROJECT#");
  });
  it("builds favor SK and prefix", () => {
    expect(favorSk("casa-abcd", "f1")).toBe("FAVOR#casa-abcd#f1");
    expect(favorHousePrefix("casa-abcd")).toBe("FAVOR#casa-abcd#");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- keys.projects`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `backend/src/keys.ts`:

```ts
export function projectSk(houseId: string, projectId: string): string {
  return `PROJECT#${houseId}#${projectId}`;
}

export function projectHousePrefix(houseId: string): string {
  return `PROJECT#${houseId}#`;
}

export function projectPrefix(): string {
  return "PROJECT#";
}

export function favorSk(toHouseId: string, favorId: string): string {
  return `FAVOR#${toHouseId}#${favorId}`;
}

export function favorHousePrefix(toHouseId: string): string {
  return `FAVOR#${toHouseId}#`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- keys.projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/keys.ts backend/src/keys.projects.test.ts
git commit -m "feat(backend): add project and favor key helpers"
```

---

## Task 5: Project & Favor persistence

Mirror `backend/src/db/turns.ts` (DynamoDBDocumentClient, Put/Get/Query,
`toX` mapper). Query with `begins_with`, never Scan.

**Files:**
- Create: `backend/src/db/projects.ts`
- Test: `backend/src/db/projects.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/db/projects.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { putProject, getProject, listHouseProjects, listCampaignProjects, putFavor, listFavorsForHouse } from "./projects";
import type { ProjectCard, Favor } from "@ravenloft/content";

const TABLE = "t";
const CAMP = "winter-dead";

function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1", campaignId: CAMP, houseId: "casa-a", title: "T", description: "d", publicDescription: "pd",
    category: "MILITARY", status: "ACTIVE", durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", completedAt: null,
    ...over,
  };
}

describe("db/projects", () => {
  let sent: any[];
  let doc: DynamoDBDocumentClient;
  beforeEach(() => {
    sent = [];
    doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return { Items: [], Item: undefined }; }) } as unknown as DynamoDBDocumentClient;
  });

  it("putProject writes item with correct PK/SK", async () => {
    await putProject(doc, TABLE, CAMP, project());
    const item = sent[0].input.Item;
    expect(item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(item.SK).toBe("PROJECT#casa-a#p1");
    expect(item.title).toBe("T");
  });

  it("getProject returns mapped card", async () => {
    (doc.send as any).mockResolvedValueOnce({ Item: { ...project(), PK: "x", SK: "y" } });
    const got = await getProject(doc, TABLE, CAMP, "casa-a", "p1");
    expect(got?.id).toBe("p1");
    expect(got?.category).toBe("MILITARY");
  });

  it("listHouseProjects queries the house prefix", async () => {
    await listHouseProjects(doc, TABLE, CAMP, "casa-a");
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("PROJECT#casa-a#");
  });

  it("listCampaignProjects queries the global prefix", async () => {
    await listCampaignProjects(doc, TABLE, CAMP);
    expect(sent[0].input.ExpressionAttributeValues[":sk"]).toBe("PROJECT#");
  });

  it("putFavor + listFavorsForHouse use FAVOR keys", async () => {
    const favor: Favor = { id: "f1", campaignId: CAMP, fromHouseId: "casa-b", toHouseId: "casa-a", amount: 1, status: "PENDING", reason: "r", createdAt: "", updatedAt: "" };
    await putFavor(doc, TABLE, CAMP, favor);
    expect(sent[0].input.Item.SK).toBe("FAVOR#casa-a#f1");
    await listFavorsForHouse(doc, TABLE, CAMP, "casa-a");
    expect(sent[1].input.ExpressionAttributeValues[":sk"]).toBe("FAVOR#casa-a#");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- db/projects`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `backend/src/db/projects.ts`:

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, projectSk, projectHousePrefix, projectPrefix, favorSk, favorHousePrefix } from "../keys";
import type { ProjectCard, Favor } from "@ravenloft/content";

export async function putProject(doc: DynamoDBDocumentClient, table: string, campaignId: string, p: ProjectCard): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: projectSk(p.houseId, p.id), ...p } }));
}

export async function getProject(doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string, projectId: string): Promise<ProjectCard | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: projectSk(houseId, projectId) } }));
  return res.Item ? toProject(res.Item) : null;
}

export async function listHouseProjects(doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string): Promise<ProjectCard[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": projectHousePrefix(houseId) } }));
  return (res.Items ?? []).map(toProject);
}

export async function listCampaignProjects(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<ProjectCard[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": projectPrefix() } }));
  return (res.Items ?? []).map(toProject);
}

export async function putFavor(doc: DynamoDBDocumentClient, table: string, campaignId: string, f: Favor): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: favorSk(f.toHouseId, f.id), ...f } }));
}

export async function listFavorsForHouse(doc: DynamoDBDocumentClient, table: string, campaignId: string, toHouseId: string): Promise<Favor[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": favorHousePrefix(toHouseId) } }));
  return (res.Items ?? []).map(toFavor);
}

function toProject(i: Record<string, unknown>): ProjectCard {
  const { PK, SK, ...rest } = i as any;
  return rest as ProjectCard;
}

function toFavor(i: Record<string, unknown>): Favor {
  const { PK, SK, ...rest } = i as any;
  return rest as Favor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- db/projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/projects.ts backend/src/db/projects.test.ts
git commit -m "feat(backend): add project and favor persistence"
```

---

## Task 6: Pure rules engine

**Files:**
- Create: `backend/src/projects/engine.ts`
- Test: `backend/src/projects/engine.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/projects/engine.test.ts
import { describe, it, expect } from "vitest";
import { projectSlotLimit, activeProjectCount, canAffordStart, applyStartCharges, applyCompletion, processProjectForTurn } from "./engine";
import type { House } from "@ravenloft/content";
import type { ProjectCard } from "@ravenloft/content";

function house(over: Partial<House> = {}): House {
  return {
    houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 2 }, createdAt: "", stability: 3, ...over,
  };
}

function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1", campaignId: "c", houseId: "casa-a", title: "T", description: "", publicDescription: "",
    category: "MILITARY", status: "ACTIVE", durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "", updatedAt: "", completedAt: null, ...over,
  };
}

describe("engine", () => {
  it("slot limit is 1 below controle 4, 2 at/above", () => {
    expect(projectSlotLimit(house({ attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 3 } }))).toBe(1);
    expect(projectSlotLimit(house({ attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 4 } }))).toBe(2);
  });

  it("counts ACTIVE and PAUSED as active", () => {
    expect(activeProjectCount([project(), project({ status: "PAUSED" }), project({ status: "COMPLETED" })])).toBe(2);
  });

  it("canAffordStart rejects when wealth insufficient", () => {
    const p = project({ costs: [{ type: "WEALTH", amount: 5, timing: "ON_START" }] });
    expect(canAffordStart(house(), p).ok).toBe(false);
  });

  it("applyStartCharges deducts wealth/resources/stability", () => {
    const p = project({ costs: [
      { type: "WEALTH", amount: 1, timing: "ON_START" },
      { type: "STABILITY", amount: 1, timing: "ON_START" },
    ] });
    const next = applyStartCharges(house(), p);
    expect(next.attributes.riqueza).toBe(2);
    expect(next.stability).toBe(2);
  });

  it("applyCompletion clamps permanent attribute at 5", () => {
    const p = project({ completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] } });
    const { house: h } = applyCompletion(house({ attributes: { riqueza: 3, recursos: 3, soldados: 5, controle: 2 } }), p);
    expect(h.attributes.soldados).toBe(5);
  });

  it("applyCompletion applies stability change and collects favors + assets", () => {
    const p = project({ completionEffects: { attributeChanges: [{ attribute: "stability", amount: 1, permanent: true }], favors: [{ targetHouseId: "casa-b", amount: 1, requiresAcceptance: true }], assets: ["Hospital"], qualitativeEffects: [], unlocks: [] } });
    const r = applyCompletion(house({ stability: 3 }), p);
    expect(r.house.stability).toBe(4);
    expect(r.favorsToCreate).toHaveLength(1);
    expect(r.assetsAdded).toContain("Hospital");
  });

  it("processProjectForTurn is idempotent for the same turnId", () => {
    const p = project({ durationTurns: 2 });
    const first = processProjectForTurn(p, 5);
    expect(first.project.turnsCompleted).toBe(1);
    const again = processProjectForTurn(first.project, 5);
    expect(again.project.turnsCompleted).toBe(1);
    expect(again.justCompleted).toBe(false);
  });

  it("processProjectForTurn completes at duration", () => {
    let p = project({ durationTurns: 2 });
    p = processProjectForTurn(p, 1).project;
    const done = processProjectForTurn(p, 2);
    expect(done.project.status).toBe("COMPLETED");
    expect(done.justCompleted).toBe(true);
    expect(done.project.completedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- projects/engine`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `backend/src/projects/engine.ts`:

```ts
import { ATTR_MIN, ATTR_MAX, STABILITY_MIN, STABILITY_MAX, houseStability } from "@ravenloft/content";
import type { House, Attributes, ProjectCard, ProjectCost, FavorEffect } from "@ravenloft/content";

export function projectSlotLimit(house: House): number {
  return house.attributes.controle >= 4 ? 2 : 1;
}

export function activeProjectCount(projects: ProjectCard[]): number {
  return projects.filter((p) => p.status === "ACTIVE" || p.status === "PAUSED").length;
}

function sumCost(costs: ProjectCost[], type: ProjectCost["type"], timing: ProjectCost["timing"]): number {
  return costs.filter((c) => c.type === type && c.timing === timing).reduce((n, c) => n + c.amount, 0);
}

export function canAffordStart(house: House, project: ProjectCard): { ok: boolean; reason?: string } {
  const wealth = sumCost(project.costs, "WEALTH", "ON_START");
  const resources = sumCost(project.costs, "RESOURCES", "ON_START");
  const stabilityCost = sumCost(project.costs, "STABILITY", "ON_START");
  const soldiers = sumCost(project.costs, "SOLDIERS_COMMITTED", "ON_START");
  const control = sumCost(project.costs, "CONTROL_COMMITTED", "ON_START");
  if (house.attributes.riqueza < wealth) return { ok: false, reason: "Riqueza insuficiente." };
  if (house.attributes.recursos < resources) return { ok: false, reason: "Recursos insuficientes." };
  if (houseStability(house) < stabilityCost) return { ok: false, reason: "Estabilidade insuficiente." };
  if (house.attributes.soldados < soldiers) return { ok: false, reason: "Soldados insuficientes." };
  if (house.attributes.controle < control) return { ok: false, reason: "Controle insuficiente." };
  return { ok: true };
}

export function applyStartCharges(house: House, project: ProjectCard): House {
  const attrs: Attributes = { ...house.attributes };
  attrs.riqueza -= sumCost(project.costs, "WEALTH", "ON_START");
  attrs.recursos -= sumCost(project.costs, "RESOURCES", "ON_START");
  const stability = clamp(houseStability(house) - sumCost(project.costs, "STABILITY", "ON_START"), STABILITY_MIN, STABILITY_MAX);
  return { ...house, attributes: attrs, stability };
}

export interface CompletionResult {
  house: House;
  favorsToCreate: FavorEffect[];
  assetsAdded: string[];
}

export function applyCompletion(house: House, project: ProjectCard): CompletionResult {
  const attrs: Attributes = { ...house.attributes };
  let stability = houseStability(house);
  for (const ch of project.completionEffects.attributeChanges) {
    if (!ch.permanent) continue;
    if (ch.attribute === "stability") {
      stability = clamp(stability + ch.amount, STABILITY_MIN, STABILITY_MAX);
    } else {
      attrs[ch.attribute] = clamp(attrs[ch.attribute] + ch.amount, ATTR_MIN, ATTR_MAX);
    }
  }
  const assetsAdded = project.completionEffects.assets;
  const assets = [...(house.assets ?? []), ...assetsAdded];
  return {
    house: { ...house, attributes: attrs, stability, assets },
    favorsToCreate: project.completionEffects.favors,
    assetsAdded,
  };
}

export interface ProcessResult {
  project: ProjectCard;
  justCompleted: boolean;
}

export function processProjectForTurn(project: ProjectCard, turnId: number): ProcessResult {
  if (project.lastProcessedTurnId === turnId) return { project, justCompleted: false };
  const turnsCompleted = project.turnsCompleted + 1;
  const completed = turnsCompleted >= project.durationTurns;
  const next: ProjectCard = {
    ...project,
    turnsCompleted,
    lastProcessedTurnId: turnId,
    status: completed ? "COMPLETED" : project.status,
    completedAt: completed ? new Date().toISOString() : project.completedAt,
    updatedAt: new Date().toISOString(),
  };
  return { project: next, justCompleted: completed };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- projects/engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/projects/engine.ts backend/src/projects/engine.test.ts
git commit -m "feat(backend): add pure project rules engine"
```

---

## Task 7: Persist stability & assets on House

**Files:**
- Modify: `backend/src/db/houses.ts`
- Test: `backend/src/db/houses.stability.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/db/houses.stability.test.ts
import { describe, it, expect, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { updateHouseStabilityAndAssets } from "./houses";

describe("updateHouseStabilityAndAssets", () => {
  it("writes stability and assets", async () => {
    const sent: any[] = [];
    const doc = { send: vi.fn(async (cmd: any) => { sent.push(cmd); return {}; }) } as unknown as DynamoDBDocumentClient;
    await updateHouseStabilityAndAssets(doc, "t", "winter-dead", "casa-a", 4, ["Hospital"]);
    const input = sent[0].input;
    expect(input.ExpressionAttributeValues[":s"]).toBe(4);
    expect(input.ExpressionAttributeValues[":assets"]).toEqual(["Hospital"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- houses.stability`
Expected: FAIL — function not exported.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/db/houses.ts`, add the mapping to `toHouse` (before the closing
`};` of the returned object):

```ts
    imageUrls: item.imageUrls as string[] | undefined,
    stability: item.stability as number | undefined,
    assets: item.assets as string[] | undefined,
```

(Replace the existing `imageUrls: ...` line with the three lines above.)

Add a new function after `updateHouseAttributes`:

```ts
export async function updateHouseStabilityAndAssets(
  doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string, stability: number, assets: string[],
): Promise<void> {
  await doc.send(new UpdateCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) },
    UpdateExpression: "SET stability = :s, assets = :assets",
    ExpressionAttributeValues: { ":s": stability, ":assets": assets } }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- houses.stability`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/houses.ts backend/src/db/houses.stability.test.ts
git commit -m "feat(backend): persist house stability and assets"
```

---

## Task 8: Turn-processing hook in applyResolution

Process ACTIVE projects after `saveTurnResult`, before `createNextTurnDraft`,
using `turn.turnId`. Extract the logic into a testable helper.

**Files:**
- Create: `backend/src/projects/processTurn.ts`
- Modify: `backend/src/routes/adminRoutes.ts` (`applyResolution`)
- Test: `backend/src/projects/processTurn.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/projects/processTurn.test.ts
import { describe, it, expect, vi } from "vitest";
import { processProjectsForTurn } from "./processTurn";
import type { ProjectCard, House } from "@ravenloft/content";

function house(over: Partial<House> = {}): House {
  return { houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 2 }, createdAt: "", stability: 3, ...over };
}
function project(over: Partial<ProjectCard> = {}): ProjectCard {
  return { id: "p1", campaignId: "c", houseId: "casa-a", title: "T", description: "", publicDescription: "",
    category: "MILITARY", status: "ACTIVE", durationTurns: 1, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: [], requirements: [], completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    risks: [], complications: [], targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: null,
    createdBy: "PLAYER", createdAtTurn: 1, createdAt: "", updatedAt: "", completedAt: null, ...over };
}

describe("processProjectsForTurn", () => {
  it("advances, completes, applies effects, and persists once", async () => {
    const projects = [project()];
    const houses: Record<string, House> = { "casa-a": house({ attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 } }) };
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async (id: string) => houses[id]),
      putProject: vi.fn(async () => {}),
      updateHouseAttributes: vi.fn(async () => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    expect(deps.putProject).toHaveBeenCalledTimes(1);
    const saved = deps.putProject.mock.calls[0][0];
    expect(saved.status).toBe("COMPLETED");
    expect(deps.updateHouseAttributes).toHaveBeenCalled();
    const attrs = deps.updateHouseAttributes.mock.calls[0][1];
    expect(attrs.soldados).toBe(3);
  });

  it("is idempotent — re-running same turnId writes nothing new", async () => {
    const projects = [project({ status: "ACTIVE", turnsCompleted: 1, lastProcessedTurnId: 4, durationTurns: 2 })];
    const deps = {
      listCampaignProjects: vi.fn(async () => projects),
      getHouse: vi.fn(async () => house()),
      putProject: vi.fn(async () => {}),
      updateHouseAttributes: vi.fn(async () => {}),
      updateHouseStabilityAndAssets: vi.fn(async () => {}),
      putFavor: vi.fn(async () => {}),
    };
    await processProjectsForTurn(deps as any, "winter-dead", 4);
    expect(deps.putProject).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- projects/processTurn`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `backend/src/projects/processTurn.ts`:

```ts
import { processProjectForTurn, applyCompletion } from "./engine";
import type { ProjectCard, House, Favor } from "@ravenloft/content";

export interface ProcessTurnDeps {
  listCampaignProjects: (campaignId: string) => Promise<ProjectCard[]>;
  getHouse: (houseId: string) => Promise<House | null>;
  putProject: (p: ProjectCard) => Promise<void>;
  updateHouseAttributes: (houseId: string, attributes: House["attributes"]) => Promise<void>;
  updateHouseStabilityAndAssets: (houseId: string, stability: number, assets: string[]) => Promise<void>;
  putFavor: (f: Favor) => Promise<void>;
}

export async function processProjectsForTurn(deps: ProcessTurnDeps, campaignId: string, turnId: number): Promise<void> {
  const projects = await deps.listCampaignProjects(campaignId);
  for (const project of projects) {
    if (project.status !== "ACTIVE") continue;
    if (project.lastProcessedTurnId === turnId) continue;
    const { project: advanced, justCompleted } = processProjectForTurn(project, turnId);
    if (justCompleted) {
      const house = await deps.getHouse(advanced.houseId);
      if (house) {
        const { house: nextHouse, favorsToCreate, assetsAdded } = applyCompletion(house, advanced);
        await deps.updateHouseAttributes(advanced.houseId, nextHouse.attributes);
        await deps.updateHouseStabilityAndAssets(advanced.houseId, nextHouse.stability ?? 3, nextHouse.assets ?? []);
        for (const fe of favorsToCreate) {
          const now = new Date().toISOString();
          const favor: Favor = {
            id: `${advanced.id}-favor-${fe.targetHouseId}`, campaignId, fromHouseId: advanced.houseId,
            toHouseId: fe.targetHouseId, amount: fe.amount, status: "PENDING",
            reason: `Projeto: ${advanced.title}`, createdAt: now, updatedAt: now,
          };
          await deps.putFavor(favor);
        }
        void assetsAdded;
      }
    }
    await deps.putProject(advanced);
  }
}
```

- [ ] **Step 4: Wire into `applyResolution`**

In `backend/src/routes/adminRoutes.ts`, add imports at the top:

```ts
import { listCampaignProjects, putProject, putFavor } from "../db/projects";
import { updateHouseStabilityAndAssets } from "../db/houses";
import { processProjectsForTurn } from "../projects/processTurn";
```

In `applyResolution`, insert between `saveTurnResult(...)` and
`createNextTurnDraft(...)`:

```ts
  await processProjectsForTurn(
    {
      listCampaignProjects: (c) => listCampaignProjects(deps.doc, tableName, c),
      getHouse: (h) => getHouse(deps.doc, tableName, campaignId, h),
      putProject: (p) => putProject(deps.doc, tableName, campaignId, p),
      updateHouseAttributes: (h, a) => updateHouseAttributes(deps.doc, tableName, campaignId, h, a),
      updateHouseStabilityAndAssets: (h, s, assets) => updateHouseStabilityAndAssets(deps.doc, tableName, campaignId, h, s, assets),
      putFavor: (f) => putFavor(deps.doc, tableName, campaignId, f),
    },
    campaignId,
    turn.turnId,
  );
```

(`getHouse`, `updateHouseAttributes` are already imported in adminRoutes.)

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test --workspace backend -- projects/processTurn`
Expected: PASS.
Run: `npm run test --workspace backend -- adminRoutes`
Expected: PASS (existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add backend/src/projects/processTurn.ts backend/src/projects/processTurn.test.ts backend/src/routes/adminRoutes.ts
git commit -m "feat(backend): process House projects during turn resolution"
```

---

## Task 9: AI custom-card generator

Builds a prompt from the house + public canon + player request, and parses/
validates the AI JSON into a partial `ProjectCard` shape. Enforces GM-approval
triggers server-side after parsing.

**Files:**
- Create: `backend/src/ai/projectPrompts.ts`
- Test: `backend/src/ai/projectPrompts.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/ai/projectPrompts.test.ts
import { describe, it, expect } from "vitest";
import { buildProjectCardPrompt, parseProjectCardProposal, enforceGmTriggers } from "./projectPrompts";
import { HttpError } from "../types/domain";
import type { House } from "@ravenloft/content";

const house: House = {
  houseId: "casa-a", name: "Casa A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "Lorde", heirName: "", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
  attributes: { riqueza: 3, recursos: 2, soldados: 3, controle: 3 }, createdAt: "", stability: 3,
};

const validJson = JSON.stringify({
  title: "Muralha da Capital", description: "Constrói uma muralha.", publicDescription: "Obras na capital.",
  category: "INFRASTRUCTURE", durationTurns: 4,
  costs: [{ type: "RESOURCES", amount: 2, timing: "ON_START" }],
  requirements: [], risks: ["Custo elevado"], complications: [],
  completionEffects: { attributeChanges: [], favors: [], assets: ["Muralha"], qualitativeEffects: ["+1 defesa"], unlocks: [] },
  targetHouseId: null, requiresTargetApproval: false, requiresGmApproval: false,
  aiBalanceStatus: "BALANCED", aiBalanceExplanation: "Custo coerente com 4 turnos.",
});

describe("projectPrompts", () => {
  it("builds a prompt with system + user containing the request", () => {
    const { system, user } = buildProjectCardPrompt(house, "Canon público", { request: "Quero uma muralha" });
    expect(system).toContain("Valdren");
    expect(user).toContain("Quero uma muralha");
    expect(user).toContain("Casa A");
  });

  it("parses valid AI JSON", () => {
    const p = parseProjectCardProposal(validJson);
    expect(p.title).toBe("Muralha da Capital");
    expect(p.category).toBe("INFRASTRUCTURE");
    expect(p.durationTurns).toBe(4);
  });

  it("throws AI_PARSE on invalid JSON", () => {
    expect(() => parseProjectCardProposal("not json")).toThrow(HttpError);
  });

  it("throws AI_PARSE on bad category", () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), category: "BANANA" });
    expect(() => parseProjectCardProposal(bad)).toThrow(HttpError);
  });

  it("enforceGmTriggers forces GM approval for >1 permanent attribute gain", () => {
    const p = parseProjectCardProposal(JSON.stringify({
      ...JSON.parse(validJson),
      completionEffects: { attributeChanges: [{ attribute: "soldados", amount: 2, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    }));
    expect(enforceGmTriggers(p).requiresGmApproval).toBe(true);
  });

  it("enforceGmTriggers forces GM approval for duration > 6", () => {
    const p = parseProjectCardProposal(JSON.stringify({ ...JSON.parse(validJson), durationTurns: 7 }));
    expect(enforceGmTriggers(p).requiresGmApproval).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- ai/projectPrompts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `backend/src/ai/projectPrompts.ts`:

```ts
import { isProjectCategory, PROJECT_COST_TYPES } from "@ravenloft/content";
import type { House, ProjectCategory, ProjectCost, CompletionEffects, AttributeChange, CustomProjectInput } from "@ravenloft/content";
import { HttpError } from "../types/domain";

export interface ProjectProposal {
  title: string;
  description: string;
  publicDescription: string;
  category: ProjectCategory;
  durationTurns: number;
  costs: ProjectCost[];
  requirements: string[];
  risks: string[];
  complications: string[];
  completionEffects: CompletionEffects;
  targetHouseId: string | null;
  requiresTargetApproval: boolean;
  requiresGmApproval: boolean;
  aiBalanceStatus: "BALANCED" | "STRONG" | "WEAK" | "NEEDS_GM_REVIEW" | null;
  aiBalanceExplanation: string | null;
}

const SYSTEM = `Você é o Árbitro de Projetos de Valdren, uma campanha política de fantasia sombria ("O Inverno dos Mortos").
Sua função é transformar o pedido livre de um jogador em uma "carta de projeto" equilibrada, usando SOMENTE o cânone público fornecido (nunca invente segredos do mestre).
Regras de balanceamento:
- 1 turno: efeito pequeno/temporário, custo 0-1.
- 2 turnos: um Favor, vantagem temporária ou ativo pequeno, custo ~1.
- 3 turnos: unidade/rota/rede/acordo, custo 1-2.
- 4 turnos: ativo permanente ou +1 atributo, custo 2-3.
- 5 turnos: +1 permanente em atributo ou transformação, custo 3-4.
- 6+ turnos: projeto épico, altos custos e aprovação do mestre.
- Nenhuma carta comum concede mais de +1 permanente num atributo, e um aumento de atributo exige >= 4 turnos.
- Cartas que envolvem outra Casa controlada por jogador exigem requiresTargetApproval e NUNCA garantem a cooperação dela.
- Cartas com assassinato de líder, mudança de fronteiras, controle de outra Casa, artefatos importantes, magia extraordinária ou segredos da campanha exigem requiresGmApproval.
Responda SOMENTE com JSON no formato pedido.`;

export function buildProjectCardPrompt(house: House, publicCanon: string, input: CustomProjectInput): { system: string; user: string } {
  const attrs = house.attributes;
  const user = [
    `Casa: ${house.name} (líder ${house.leaderName}, castelo ${house.castleName}).`,
    `Atributos — Riqueza ${attrs.riqueza}, Recursos ${attrs.recursos}, Soldados ${attrs.soldados}, Controle ${attrs.controle}, Estabilidade ${house.stability ?? 3}.`,
    `Pedido do jogador: ${input.request}`,
    input.targetHouseId ? `Casa/região alvo: ${input.targetHouseId}` : "",
    input.desiredOutcome ? `Resultado desejado: ${input.desiredOutcome}` : "",
    typeof input.maxSpend === "number" ? `Gasto máximo aceitável: ${input.maxSpend}` : "",
    input.riskLevel ? `Nível de risco desejado: ${input.riskLevel}` : "",
    "",
    "Cânone público de Valdren:",
    publicCanon || "(nenhum)",
    "",
    'Responda com JSON: { "title", "description", "publicDescription", "category", "durationTurns", "costs":[{"type","amount","timing"}], "requirements":[], "risks":[], "complications":[], "completionEffects":{"attributeChanges":[{"attribute","amount","permanent"}],"favors":[{"targetHouseId","amount","requiresAcceptance"}],"assets":[],"qualitativeEffects":[],"unlocks":[]}, "targetHouseId", "requiresTargetApproval", "requiresGmApproval", "aiBalanceStatus", "aiBalanceExplanation" }',
  ].filter(Boolean).join("\n");
  return { system: SYSTEM, user };
}

function fail(): never {
  throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function parseCosts(v: unknown): ProjectCost[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => {
    const o = c as Record<string, unknown>;
    if (!(PROJECT_COST_TYPES as readonly string[]).includes(o.type as string)) fail();
    if (typeof o.amount !== "number") fail();
    const timing = o.timing === "PER_TURN" || o.timing === "ON_COMPLETION" ? o.timing : "ON_START";
    return { type: o.type as ProjectCost["type"], amount: o.amount, timing };
  });
}

function parseEffects(v: unknown): CompletionEffects {
  const o = (v ?? {}) as Record<string, unknown>;
  const changes: AttributeChange[] = Array.isArray(o.attributeChanges)
    ? o.attributeChanges.map((c) => {
        const x = c as Record<string, unknown>;
        const allowed = ["riqueza", "recursos", "soldados", "controle", "stability"];
        if (!allowed.includes(x.attribute as string)) fail();
        if (typeof x.amount !== "number") fail();
        return { attribute: x.attribute as AttributeChange["attribute"], amount: x.amount, permanent: x.permanent === true };
      })
    : [];
  const favors = Array.isArray(o.favors)
    ? o.favors.map((f) => {
        const x = f as Record<string, unknown>;
        return { targetHouseId: String(x.targetHouseId ?? ""), amount: typeof x.amount === "number" ? x.amount : 1, requiresAcceptance: x.requiresAcceptance !== false };
      })
    : [];
  return { attributeChanges: changes, favors, assets: strArr(o.assets), qualitativeEffects: strArr(o.qualitativeEffects), unlocks: strArr(o.unlocks) };
}

export function parseProjectCardProposal(raw: string): ProjectProposal {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { fail(); }
  const o = obj as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title) fail();
  if (!isProjectCategory(o.category as string)) fail();
  if (typeof o.durationTurns !== "number" || o.durationTurns < 1) fail();
  const status = o.aiBalanceStatus;
  const okStatus = status === "BALANCED" || status === "STRONG" || status === "WEAK" || status === "NEEDS_GM_REVIEW" || status === null || status === undefined;
  if (!okStatus) fail();
  return {
    title: o.title,
    description: typeof o.description === "string" ? o.description : "",
    publicDescription: typeof o.publicDescription === "string" ? o.publicDescription : "",
    category: o.category as ProjectCategory,
    durationTurns: Math.round(o.durationTurns),
    costs: parseCosts(o.costs),
    requirements: strArr(o.requirements),
    risks: strArr(o.risks),
    complications: strArr(o.complications),
    completionEffects: parseEffects(o.completionEffects),
    targetHouseId: typeof o.targetHouseId === "string" ? o.targetHouseId : null,
    requiresTargetApproval: o.requiresTargetApproval === true,
    requiresGmApproval: o.requiresGmApproval === true,
    aiBalanceStatus: (status as ProjectProposal["aiBalanceStatus"]) ?? null,
    aiBalanceExplanation: typeof o.aiBalanceExplanation === "string" ? o.aiBalanceExplanation : null,
  };
}

export function enforceGmTriggers(p: ProjectProposal): ProjectProposal {
  let requiresGmApproval = p.requiresGmApproval;
  const maxPermanent = p.completionEffects.attributeChanges
    .filter((c) => c.permanent)
    .reduce((m, c) => Math.max(m, c.amount), 0);
  if (maxPermanent > 1) requiresGmApproval = true;
  if (p.durationTurns > 6) requiresGmApproval = true;
  const favorWithoutCost = p.completionEffects.favors.length > 0 && p.costs.length === 0;
  if (favorWithoutCost) requiresGmApproval = true;
  return { ...p, requiresGmApproval };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- ai/projectPrompts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/projectPrompts.ts backend/src/ai/projectPrompts.test.ts
git commit -m "feat(backend): add AI project-card generator and validator"
```

---

## Task 10: Validation body parsers

**Files:**
- Modify: `backend/src/validation/schemas.ts`
- Test: `backend/src/validation/schemas.projects.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/validation/schemas.projects.test.ts
import { describe, it, expect } from "vitest";
import { parseStartTemplateBody, parseAnalyzeCustomBody, parseProjectIdBody, parseRevisionBody, parseFavorRespondBody, parseApproveProjectBody, parseRejectProjectBody } from "./schemas";
import { HttpError } from "../types/domain";

describe("project body parsers", () => {
  it("parseStartTemplateBody requires templateId", () => {
    expect(parseStartTemplateBody({ templateId: "abrir-uma-nova-mina" }).templateId).toBe("abrir-uma-nova-mina");
    expect(() => parseStartTemplateBody({})).toThrow(HttpError);
  });
  it("parseAnalyzeCustomBody requires request and passes optional fields", () => {
    const b = parseAnalyzeCustomBody({ request: "Muralha", riskLevel: "high", maxSpend: 3 });
    expect(b.request).toBe("Muralha");
    expect(b.riskLevel).toBe("high");
    expect(b.maxSpend).toBe(3);
    expect(() => parseAnalyzeCustomBody({})).toThrow(HttpError);
  });
  it("parseAnalyzeCustomBody rejects bad riskLevel", () => {
    expect(() => parseAnalyzeCustomBody({ request: "x", riskLevel: "insane" })).toThrow(HttpError);
  });
  it("parseProjectIdBody requires projectId", () => {
    expect(parseProjectIdBody({ projectId: "p1" }).projectId).toBe("p1");
    expect(() => parseProjectIdBody({})).toThrow(HttpError);
  });
  it("parseRevisionBody requires projectId and note", () => {
    expect(parseRevisionBody({ projectId: "p1", note: "menos custo" }).note).toBe("menos custo");
    expect(() => parseRevisionBody({ projectId: "p1" })).toThrow(HttpError);
  });
  it("parseFavorRespondBody parses favorId and accept boolean", () => {
    expect(parseFavorRespondBody({ favorId: "f1", accept: true }).accept).toBe(true);
    expect(() => parseFavorRespondBody({ favorId: "f1" })).toThrow(HttpError);
  });
  it("parseApproveProjectBody requires projectId, note optional", () => {
    expect(parseApproveProjectBody({ projectId: "p1" }).projectId).toBe("p1");
  });
  it("parseRejectProjectBody requires projectId and note", () => {
    expect(parseRejectProjectBody({ projectId: "p1", note: "não" }).note).toBe("não");
    expect(() => parseRejectProjectBody({ projectId: "p1" })).toThrow(HttpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- schemas.projects`
Expected: FAIL — parsers not exported.

- [ ] **Step 3: Write implementation**

Append to `backend/src/validation/schemas.ts` (helpers `asObject`, `str` already
exist in the file):

```ts
export function parseStartTemplateBody(body: unknown): { templateId: string } {
  const o = asObject(body);
  return { templateId: str(o, "templateId", 80) };
}

export function parseAnalyzeCustomBody(body: unknown): {
  request: string; targetHouseId: string | null; desiredOutcome: string; maxSpend?: number; riskLevel?: "low" | "medium" | "high";
} {
  const o = asObject(body);
  const request = str(o, "request", 1500);
  const targetHouseId = str(o, "targetHouseId", 80, false) || null;
  const desiredOutcome = str(o, "desiredOutcome", 500, false);
  let maxSpend: number | undefined;
  if (o.maxSpend !== undefined) {
    if (typeof o.maxSpend !== "number" || o.maxSpend < 0) throw new HttpError(400, "INVALID_BODY", "maxSpend inválido.");
    maxSpend = o.maxSpend;
  }
  let riskLevel: "low" | "medium" | "high" | undefined;
  if (o.riskLevel !== undefined) {
    if (o.riskLevel !== "low" && o.riskLevel !== "medium" && o.riskLevel !== "high") throw new HttpError(400, "INVALID_BODY", "riskLevel inválido.");
    riskLevel = o.riskLevel;
  }
  return { request, targetHouseId, desiredOutcome, maxSpend, riskLevel };
}

export function parseProjectIdBody(body: unknown): { projectId: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80) };
}

export function parseRevisionBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000) };
}

export function parseFavorRespondBody(body: unknown): { favorId: string; accept: boolean } {
  const o = asObject(body);
  const favorId = str(o, "favorId", 120);
  if (typeof o.accept !== "boolean") throw new HttpError(400, "INVALID_BODY", "accept deve ser booleano.");
  return { favorId, accept: o.accept };
}

export function parseApproveProjectBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000, false) };
}

export function parseRejectProjectBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- schemas.projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/validation/schemas.projects.test.ts
git commit -m "feat(backend): add project and favor body parsers"
```

---

## Task 11: Player & GM routes + router wiring

Public canon for the AI = all wiki entries (`listWikiEntries`) joined as
`title\nbody`. IDs use the same 10-char generator style as wiki.

**Files:**
- Create: `backend/src/routes/projectRoutes.ts` (player handlers)
- Modify: `backend/src/routes/adminRoutes.ts` (GM handlers)
- Modify: `backend/src/router.ts` (register routes)
- Test: `backend/src/routes/projectRoutes.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/routes/projectRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjects, startProjectFromTemplate, cancelProject } from "./projectRoutes";
import type { Deps } from "./publicRoutes";
import type { HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";
import * as projectsDb from "../db/projects";
import * as housesDb from "../db/houses";
import * as wikiDb from "../db/wiki";
import * as auth from "../auth/playerAuth";
import type { House } from "@ravenloft/content";

const house: House = {
  houseId: "casa-a", name: "A", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
  leaderName: "", heirName: "", castleName: "", townsText: "", historyText: "", specialty: "", weakness: "",
  attributes: { riqueza: 3, recursos: 3, soldados: 3, controle: 3 }, createdAt: "", stability: 3,
};

function deps(): Deps { return { doc: {} as any, config: { tableName: "t", campaignId: "winter-dead" } as any }; }
function req(body: unknown): HandlerRequest { return { method: "POST", path: "/", headers: { authorization: "Bearer x" }, body } as any; }

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(auth, "requirePlayer").mockReturnValue({ type: "player", campaignId: "winter-dead", houseId: "casa-a", displayName: "A", exp: Date.now() + 1e6 } as any);
  vi.spyOn(housesDb, "getHouse").mockResolvedValue(house);
  vi.spyOn(wikiDb, "listWikiEntries").mockResolvedValue([]);
  vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([]);
  vi.spyOn(projectsDb, "listFavorsForHouse").mockResolvedValue([]);
  vi.spyOn(projectsDb, "putProject").mockResolvedValue();
  vi.spyOn(housesDb, "updateHouseAttributes").mockResolvedValue();
  vi.spyOn(housesDb, "updateHouseStabilityAndAssets").mockResolvedValue();
});

describe("projectRoutes", () => {
  it("getProjects returns templates, projects, favors, slotLimit, stability", async () => {
    const res = await getProjects(deps(), req(undefined));
    expect(res.status).toBe(200);
    const body: any = res.body;
    expect(body.templates.length).toBe(64);
    expect(body.slotLimit).toBe(1);
    expect(body.stability).toBe(3);
  });

  it("startProjectFromTemplate charges and activates an affordable card", async () => {
    const res = await startProjectFromTemplate(deps(), req({ templateId: "criar-uma-rede-de-batedores" }));
    expect(res.status).toBe(200);
    const p: any = res.body;
    expect(p.status).toBe("ACTIVE");
    expect(housesDb.updateHouseAttributes).toHaveBeenCalled();
  });

  it("startProjectFromTemplate blocks when slot limit reached", async () => {
    vi.spyOn(projectsDb, "listHouseProjects").mockResolvedValue([{ status: "ACTIVE" } as any]);
    await expect(startProjectFromTemplate(deps(), req({ templateId: "criar-uma-rede-de-batedores" }))).rejects.toThrow(HttpError);
  });

  it("cancelProject sets CANCELLED and does not refund", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ id: "p1", houseId: "casa-a", status: "ACTIVE" } as any);
    const res = await cancelProject(deps(), req({ projectId: "p1" }));
    expect((res.body as any).status).toBe("CANCELLED");
    expect(housesDb.updateHouseAttributes).not.toHaveBeenCalled();
  });

  it("cancelProject rejects another house's project", async () => {
    vi.spyOn(projectsDb, "getProject").mockResolvedValue({ id: "p1", houseId: "casa-b", status: "ACTIVE" } as any);
    await expect(cancelProject(deps(), req({ projectId: "p1" }))).rejects.toThrow(HttpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- routes/projectRoutes`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `projectRoutes.ts`**

Create `backend/src/routes/projectRoutes.ts`:

```ts
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { getHouse, updateHouseAttributes, updateHouseStabilityAndAssets } from "../db/houses";
import { getActiveTurn } from "../db/turns";
import { listWikiEntries } from "../db/wiki";
import { getProject, putProject, listHouseProjects, listFavorsForHouse, putFavor } from "../db/projects";
import { getTemplate, DEFAULT_PROJECT_TEMPLATES, emptyCompletionEffects, houseStability } from "@ravenloft/content";
import type { ProjectCard, ProjectTemplate, Favor } from "@ravenloft/content";
import { projectSlotLimit, activeProjectCount, canAffordStart, applyStartCharges } from "../projects/engine";
import { generateJson } from "../ai/openai";
import { buildProjectCardPrompt, parseProjectCardProposal, enforceGmTriggers, type ProjectProposal } from "../ai/projectPrompts";
import { parseStartTemplateBody, parseAnalyzeCustomBody, parseProjectIdBody, parseRevisionBody, parseFavorRespondBody } from "../validation/schemas";

function genId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

async function loadHouse(deps: Deps, houseId: string) {
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");
  return house;
}

async function currentTurnId(deps: Deps): Promise<number> {
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  return turn?.turnId ?? 0;
}

function templateToCard(t: ProjectTemplate, campaignId: string, houseId: string, turnId: number): ProjectCard {
  const now = new Date().toISOString();
  return {
    id: genId(), campaignId, houseId, title: t.title, description: t.description, publicDescription: t.description,
    category: t.category, status: "DRAFT", durationTurns: t.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: t.costs, requirements: t.requirements, completionEffects: t.completionEffects, risks: t.risks, complications: [],
    targetHouseId: null, requiresTargetApproval: t.requiresTargetApproval, requiresGmApproval: t.requiresGmApproval,
    aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: t.id,
    createdBy: "PLAYER", createdAtTurn: turnId, createdAt: now, updatedAt: now, completedAt: null,
  };
}

function proposalToCard(p: ProjectProposal, req: { request: string }, campaignId: string, houseId: string, turnId: number): ProjectCard {
  const now = new Date().toISOString();
  return {
    id: genId(), campaignId, houseId, title: p.title, description: p.description, publicDescription: p.publicDescription,
    category: p.category, status: "PENDING_PLAYER", durationTurns: p.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null,
    costs: p.costs, requirements: p.requirements, completionEffects: p.completionEffects, risks: p.risks, complications: p.complications,
    targetHouseId: p.targetHouseId, requiresTargetApproval: p.requiresTargetApproval, requiresGmApproval: p.requiresGmApproval,
    aiBalanceStatus: p.aiBalanceStatus, aiBalanceExplanation: p.aiBalanceExplanation, playerOriginalRequest: req.request,
    gmNotes: null, templateId: null, createdBy: "AI", createdAtTurn: turnId, createdAt: now, updatedAt: now, completedAt: null,
  };
}

export async function getProjects(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const house = await loadHouse(deps, player.houseId);
  const [projects, favors] = await Promise.all([
    listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId),
    listFavorsForHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId),
  ]);
  return {
    status: 200,
    body: {
      templates: DEFAULT_PROJECT_TEMPLATES,
      projects,
      favors: favors.filter((f) => f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
    },
  };
}

export async function startProjectFromTemplate(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { templateId } = parseStartTemplateBody(req.body);
  const template = getTemplate(templateId);
  if (!template) throw new HttpError(404, "NOT_FOUND", "Modelo de projeto não encontrado.");
  const house = await loadHouse(deps, player.houseId);
  const existing = await listHouseProjects(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (activeProjectCount(existing) >= projectSlotLimit(house)) {
    throw new HttpError(409, "BAD_STATUS", "Limite de projetos ativos atingido.");
  }
  const turnId = await currentTurnId(deps);
  const card = templateToCard(template, deps.config.campaignId, player.houseId, turnId);

  if (template.requiresGmApproval) {
    card.status = "PENDING_GM";
  } else if (template.requiresTargetApproval) {
    card.status = "PENDING_TARGET";
  } else {
    const afford = canAffordStart(house, card);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, card);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    card.status = "ACTIVE";
  }
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, card);
  return { status: 200, body: card };
}

export async function analyzeCustomProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const input = parseAnalyzeCustomBody(req.body);
  const house = await loadHouse(deps, player.houseId);
  const wiki = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = wiki.map((w) => `${w.title}\n${w.body}`).join("\n\n");
  const { system, user } = buildProjectCardPrompt(house, canon, input);
  const proposal = enforceGmTriggers(await generateJson(deps.chat, system, user, parseProjectCardProposal));
  const turnId = await currentTurnId(deps);
  const card = proposalToCard(proposal, input, deps.config.campaignId, player.houseId, turnId);
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, card);
  return { status: 200, body: card };
}

async function loadOwnProject(deps: Deps, houseId: string, projectId: string): Promise<ProjectCard> {
  const project = await getProject(deps.doc, deps.config.tableName, deps.config.campaignId, houseId, projectId);
  if (!project || project.houseId !== houseId) throw new HttpError(403, "NO_HOUSE", "Projeto não pertence à sua Casa.");
  return project;
}

export async function acceptProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  if (project.status !== "PENDING_PLAYER") throw new HttpError(409, "BAD_STATUS", "Projeto não está aguardando sua decisão.");
  const house = await loadHouse(deps, player.houseId);
  if (project.requiresGmApproval) {
    project.status = "PENDING_GM";
  } else if (project.requiresTargetApproval) {
    project.status = "PENDING_TARGET";
  } else {
    const afford = canAffordStart(house, project);
    if (!afford.ok) throw new HttpError(409, "BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
    const charged = applyStartCharges(house, project);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.attributes);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, charged.stability ?? 3, charged.assets ?? []);
    project.status = "ACTIVE";
  }
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function requestProjectRevision(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { projectId, note } = parseRevisionBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  const house = await loadHouse(deps, player.houseId);
  const wiki = await listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = wiki.map((w) => `${w.title}\n${w.body}`).join("\n\n");
  const { system, user } = buildProjectCardPrompt(house, canon, {
    request: `${project.playerOriginalRequest ?? project.title}\n\nAjuste pedido: ${note}`,
  });
  const proposal = enforceGmTriggers(await generateJson(deps.chat, system, user, parseProjectCardProposal));
  Object.assign(project, {
    title: proposal.title, description: proposal.description, publicDescription: proposal.publicDescription,
    category: proposal.category, durationTurns: proposal.durationTurns, costs: proposal.costs,
    requirements: proposal.requirements, risks: proposal.risks, complications: proposal.complications,
    completionEffects: proposal.completionEffects, targetHouseId: proposal.targetHouseId,
    requiresTargetApproval: proposal.requiresTargetApproval, requiresGmApproval: proposal.requiresGmApproval,
    aiBalanceStatus: proposal.aiBalanceStatus, aiBalanceExplanation: proposal.aiBalanceExplanation,
    status: "PENDING_PLAYER", updatedAt: new Date().toISOString(),
  });
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function submitProjectToGm(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  project.status = "PENDING_GM";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function cancelProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadOwnProject(deps, player.houseId, projectId);
  project.status = "CANCELLED";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function respondToFavor(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { favorId, accept } = parseFavorRespondBody(req.body);
  const favors = await listFavorsForHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  const favor = favors.find((f) => f.id === favorId);
  if (!favor) throw new HttpError(404, "NOT_FOUND", "Favor não encontrado.");
  const next: Favor = { ...favor, status: accept ? "ACCEPTED" : "DECLINED", updatedAt: new Date().toISOString() };
  await putFavor(deps.doc, deps.config.tableName, deps.config.campaignId, next);
  return { status: 200, body: next };
}
```

Note: `emptyCompletionEffects` import is available if needed; unused imports must
be removed to satisfy the linter before commit.

- [ ] **Step 4: Add GM handlers to `adminRoutes.ts`**

Append these handlers (imports `listCampaignProjects`, `getProject`, `putProject`,
`getHouse`, `updateHouseAttributes`, `updateHouseStabilityAndAssets` already
added in Task 8; add `import { canAffordStart, applyStartCharges } from "../projects/engine";`
and `import { parseProjectIdBody, parseApproveProjectBody, parseRejectProjectBody } from "../validation/schemas";`):

```ts
export async function adminListProjects(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const projects = await listCampaignProjects(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: projects };
}

async function loadProjectAcrossHouses(deps: Deps, projectId: string) {
  const all = await listCampaignProjects(deps.doc, deps.config.tableName, deps.config.campaignId);
  const project = all.find((p) => p.id === projectId);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Projeto não encontrado.");
  return project;
}

export async function adminApproveProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId, note } = parseApproveProjectBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");
  const afford = canAffordStart(house, project);
  if (afford.ok) {
    const charged = applyStartCharges(house, project);
    await updateHouseAttributes(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId, charged.attributes);
    await updateHouseStabilityAndAssets(deps.doc, deps.config.tableName, deps.config.campaignId, project.houseId, charged.stability ?? 3, charged.assets ?? []);
  }
  project.status = "ACTIVE";
  project.gmNotes = note || project.gmNotes;
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminRejectProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId, note } = parseRejectProjectBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "REJECTED";
  project.gmNotes = note;
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminPauseProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "PAUSED";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}

export async function adminResumeProject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { projectId } = parseProjectIdBody(req.body);
  const project = await loadProjectAcrossHouses(deps, projectId);
  project.status = "ACTIVE";
  project.updatedAt = new Date().toISOString();
  await putProject(deps.doc, deps.config.tableName, deps.config.campaignId, project);
  return { status: 200, body: project };
}
```

- [ ] **Step 5: Register routes in `router.ts`**

Add imports:

```ts
import { getProjects, startProjectFromTemplate, analyzeCustomProject, acceptProject, requestProjectRevision, submitProjectToGm, cancelProject, respondToFavor } from "./routes/projectRoutes";
```

Add to the `adminRoutes` import list: `adminListProjects, adminApproveProject, adminRejectProject, adminPauseProject, adminResumeProject`.

Add to the `routes` array:

```ts
  r("GET", "/api/player/projects", getProjects),
  r("POST", "/api/player/project/start", startProjectFromTemplate),
  r("POST", "/api/player/project/analyze", analyzeCustomProject),
  r("POST", "/api/player/project/accept", acceptProject),
  r("POST", "/api/player/project/revise", requestProjectRevision),
  r("POST", "/api/player/project/submit-gm", submitProjectToGm),
  r("POST", "/api/player/project/cancel", cancelProject),
  r("POST", "/api/player/favor/respond", respondToFavor),
  r("GET", "/api/admin/projects", adminListProjects),
  r("POST", "/api/admin/project/approve", adminApproveProject),
  r("POST", "/api/admin/project/reject", adminRejectProject),
  r("POST", "/api/admin/project/pause", adminPauseProject),
  r("POST", "/api/admin/project/resume", adminResumeProject),
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm run test --workspace backend -- routes/projectRoutes`
Expected: PASS.
Run: `npm run test --workspace backend`
Expected: PASS (all backend tests green).

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/projectRoutes.ts backend/src/routes/projectRoutes.test.ts backend/src/routes/adminRoutes.ts backend/src/router.ts
git commit -m "feat(backend): add player and GM project routes"
```

---

## Task 12: Frontend API layer (types + 3 implementations)

Add project types + methods to all three implementations so they stay in sync.

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/httpClient.ts`
- Modify: `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/mockClient.projects.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/api/mockClient.projects.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { MockApiClient } from "./mockClient";

async function loginPlayer(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as any);
  return acc.playerToken;
}

describe("MockApiClient projects", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); });

  it("getProjects returns the template library and slot limit", async () => {
    const token = await loginPlayer(client);
    const res = await client.getProjects(token);
    expect(res.templates.length).toBe(64);
    expect(res.slotLimit).toBe(1);
    expect(res.stability).toBe(3);
    expect(res.projects).toEqual([]);
  });

  it("startProjectFromTemplate activates an affordable project and charges costs", async () => {
    const token = await loginPlayer(client);
    const p = await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    expect(p.status).toBe("ACTIVE");
    const after = await client.getProjects(token);
    expect(after.projects).toHaveLength(1);
  });

  it("blocks a second active project when slot limit is 1", async () => {
    const token = await loginPlayer(client);
    await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    await expect(client.startProjectFromTemplate(token, { templateId: "infiltrar-um-agente" })).rejects.toThrow();
  });

  it("cancelProject marks it cancelled", async () => {
    const token = await loginPlayer(client);
    const p = await client.startProjectFromTemplate(token, { templateId: "criar-uma-rede-de-batedores" });
    const cancelled = await client.cancelProject(token, { projectId: p.id });
    expect(cancelled.status).toBe("CANCELLED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace frontend -- mockClient.projects`
Expected: FAIL — `getProjects` not on client.

- [ ] **Step 3: Add types to `frontend/src/types/api.ts`**

Add to the imports from `@ravenloft/content`: `ProjectCard, ProjectTemplate, Favor, CustomProjectInput`. Re-export them, and add input shapes:

```ts
import type {
  House, Attributes, TurnStatus, TurnResult, Submission, HouseExample, Emblem, WikiEntry, GmEntry,
  ProjectCard, ProjectTemplate, Favor, CustomProjectInput,
} from "@ravenloft/content";

export type {
  House, Attributes, TurnStatus, TurnResult, Submission, HouseExample, Emblem, WikiEntry, GmEntry,
  ProjectCard, ProjectTemplate, Favor, CustomProjectInput,
};

export interface ProjectsView {
  templates: ProjectTemplate[];
  projects: ProjectCard[];
  favors: Favor[];
  slotLimit: number;
  stability: number;
}
```

- [ ] **Step 4: Add methods to `ApiClient` interface (`client.ts`)**

Add the imports (`ProjectsView, ProjectCard, Favor, CustomProjectInput`) and, inside `interface ApiClient`:

```ts
  getProjects(playerToken: string): Promise<ProjectsView>;
  startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard>;
  analyzeCustomProject(playerToken: string, input: CustomProjectInput): Promise<ProjectCard>;
  acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard>;
  respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor>;
  adminListProjects(adminToken: string): Promise<ProjectCard[]>;
  adminApproveProject(adminToken: string, input: { projectId: string; note?: string }): Promise<ProjectCard>;
  adminRejectProject(adminToken: string, input: { projectId: string; note: string }): Promise<ProjectCard>;
  adminPauseProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
  adminResumeProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard>;
```

- [ ] **Step 5: Implement in `HttpApiClient` (`httpClient.ts`)**

Add imports (`ProjectsView, ProjectCard, Favor, CustomProjectInput`) and methods
(using the existing private `this.request`):

```ts
  getProjects(playerToken: string): Promise<ProjectsView> {
    return this.request<ProjectsView>("/api/player/projects", { token: playerToken });
  }
  startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/start", { method: "POST", body: input, token: playerToken });
  }
  analyzeCustomProject(playerToken: string, input: CustomProjectInput): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/analyze", { method: "POST", body: input, token: playerToken });
  }
  acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/accept", { method: "POST", body: input, token: playerToken });
  }
  requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/revise", { method: "POST", body: input, token: playerToken });
  }
  submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/submit-gm", { method: "POST", body: input, token: playerToken });
  }
  cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/player/project/cancel", { method: "POST", body: input, token: playerToken });
  }
  respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor> {
    return this.request<Favor>("/api/player/favor/respond", { method: "POST", body: input, token: playerToken });
  }
  adminListProjects(adminToken: string): Promise<ProjectCard[]> {
    return this.request<ProjectCard[]>("/api/admin/projects", { token: adminToken });
  }
  adminApproveProject(adminToken: string, input: { projectId: string; note?: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/approve", { method: "POST", body: input, token: adminToken });
  }
  adminRejectProject(adminToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/reject", { method: "POST", body: input, token: adminToken });
  }
  adminPauseProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/pause", { method: "POST", body: input, token: adminToken });
  }
  adminResumeProject(adminToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.request<ProjectCard>("/api/admin/project/resume", { method: "POST", body: input, token: adminToken });
  }
```

- [ ] **Step 6: Implement in `MockApiClient` (`mockClient.ts`)**

Add imports from `@ravenloft/content`:
`DEFAULT_PROJECT_TEMPLATES, getTemplate, projectSlotLimit, activeProjectCount,
canAffordStart, applyStartCharges, houseStability` and types
`ProjectCard, ProjectTemplate, Favor, CustomProjectInput`, plus `ProjectsView`.

Add fields to the class:

```ts
  private projects = new Map<string, ProjectCard[]>(); // keyed by houseId
  private favors: Favor[] = [];
  private projectSeq = 0;
```

Add methods (mirror server rules):

```ts
  async getProjects(playerToken: string): Promise<ProjectsView> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    return {
      templates: DEFAULT_PROJECT_TEMPLATES,
      projects: this.projects.get(rec.houseId) ?? [],
      favors: this.favors.filter((f) => f.toHouseId === rec.houseId && f.status === "PENDING"),
      slotLimit: projectSlotLimit(house),
      stability: houseStability(house),
    };
  }

  async startProjectFromTemplate(playerToken: string, input: { templateId: string }): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    const t = getTemplate(input.templateId);
    if (!t) throw new ApiError("NOT_FOUND", "Modelo não encontrado.");
    const list = this.projects.get(rec.houseId) ?? [];
    if (activeProjectCount(list) >= projectSlotLimit(house)) throw new ApiError("BAD_STATUS", "Limite de projetos ativos atingido.");
    const now = new Date().toISOString();
    const card: ProjectCard = {
      id: `proj-${++this.projectSeq}`, campaignId: "winter-dead", houseId: rec.houseId, title: t.title,
      description: t.description, publicDescription: t.description, category: t.category, status: "DRAFT",
      durationTurns: t.durationTurns, turnsCompleted: 0, lastProcessedTurnId: null, costs: t.costs,
      requirements: t.requirements, completionEffects: t.completionEffects, risks: t.risks, complications: [],
      targetHouseId: null, requiresTargetApproval: t.requiresTargetApproval, requiresGmApproval: t.requiresGmApproval,
      aiBalanceStatus: null, aiBalanceExplanation: null, playerOriginalRequest: null, gmNotes: null, templateId: t.id,
      createdBy: "PLAYER", createdAtTurn: this.activeTurn.turnId, createdAt: now, updatedAt: now, completedAt: null,
    };
    if (t.requiresGmApproval) card.status = "PENDING_GM";
    else if (t.requiresTargetApproval) card.status = "PENDING_TARGET";
    else {
      const afford = canAffordStart(house, card);
      if (!afford.ok) throw new ApiError("BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
      const charged = applyStartCharges(house, card);
      this.houses.set(rec.houseId, charged);
      card.status = "ACTIVE";
    }
    this.projects.set(rec.houseId, [...list, card]);
    return card;
  }

  async analyzeCustomProject(playerToken: string, input: CustomProjectInput): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const now = new Date().toISOString();
    const card: ProjectCard = {
      id: `proj-${++this.projectSeq}`, campaignId: "winter-dead", houseId: rec.houseId,
      title: `Projeto: ${input.request.slice(0, 40)}`, description: input.request, publicDescription: input.request,
      category: "INFRASTRUCTURE", status: "PENDING_PLAYER", durationTurns: 3, turnsCompleted: 0, lastProcessedTurnId: null,
      costs: [{ type: "RESOURCES", amount: 1, timing: "ON_START" }], requirements: [],
      completionEffects: { attributeChanges: [], favors: [], assets: [], qualitativeEffects: ["Efeito proposto pela IA."], unlocks: [] },
      risks: [], complications: [], targetHouseId: input.targetHouseId ?? null,
      requiresTargetApproval: !!input.targetHouseId, requiresGmApproval: false,
      aiBalanceStatus: "BALANCED", aiBalanceExplanation: "Proposta simulada equilibrada.",
      playerOriginalRequest: input.request, gmNotes: null, templateId: null, createdBy: "AI",
      createdAtTurn: this.activeTurn.turnId, createdAt: now, updatedAt: now, completedAt: null,
    };
    const list = this.projects.get(rec.houseId) ?? [];
    this.projects.set(rec.houseId, [...list, card]);
    return card;
  }

  private mutateProject(playerToken: string, projectId: string, fn: (p: ProjectCard) => void): ProjectCard {
    const rec = this.requirePlayer(playerToken);
    const list = this.projects.get(rec.houseId) ?? [];
    const p = list.find((x) => x.id === projectId);
    if (!p) throw new ApiError("NOT_FOUND", "Projeto não encontrado.");
    fn(p);
    p.updatedAt = new Date().toISOString();
    this.projects.set(rec.houseId, [...list]);
    return p;
  }

  async acceptProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    const rec = this.requirePlayer(playerToken);
    const house = this.houses.get(rec.houseId)!;
    return this.mutateProject(playerToken, input.projectId, (p) => {
      if (p.requiresGmApproval) p.status = "PENDING_GM";
      else if (p.requiresTargetApproval) p.status = "PENDING_TARGET";
      else {
        const afford = canAffordStart(house, p);
        if (!afford.ok) throw new ApiError("BAD_STATUS", afford.reason ?? "Recursos insuficientes.");
        this.houses.set(rec.houseId, applyStartCharges(house, p));
        p.status = "ACTIVE";
      }
    });
  }

  async requestProjectRevision(playerToken: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "PENDING_PLAYER"; p.aiBalanceExplanation = `Ajustado: ${input.note}`; });
  }

  async submitProjectToGm(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "PENDING_GM"; });
  }

  async cancelProject(playerToken: string, input: { projectId: string }): Promise<ProjectCard> {
    return this.mutateProject(playerToken, input.projectId, (p) => { p.status = "CANCELLED"; });
  }

  async respondToFavor(playerToken: string, input: { favorId: string; accept: boolean }): Promise<Favor> {
    const rec = this.requirePlayer(playerToken);
    const favor = this.favors.find((f) => f.id === input.favorId && f.toHouseId === rec.houseId);
    if (!favor) throw new ApiError("NOT_FOUND", "Favor não encontrado.");
    favor.status = input.accept ? "ACCEPTED" : "DECLINED";
    favor.updatedAt = new Date().toISOString();
    return favor;
  }

  async adminListProjects(adminTokenArg: string): Promise<ProjectCard[]> {
    this.requireAdmin(adminTokenArg);
    return Array.from(this.projects.values()).flat();
  }

  private mutateAnyProject(projectId: string, fn: (p: ProjectCard) => void): ProjectCard {
    for (const [houseId, list] of this.projects.entries()) {
      const p = list.find((x) => x.id === projectId);
      if (p) { fn(p); p.updatedAt = new Date().toISOString(); this.projects.set(houseId, [...list]); return p; }
    }
    throw new ApiError("NOT_FOUND", "Projeto não encontrado.");
  }

  async adminApproveProject(adminTokenArg: string, input: { projectId: string; note?: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "ACTIVE"; if (input.note) p.gmNotes = input.note; });
  }
  async adminRejectProject(adminTokenArg: string, input: { projectId: string; note: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "REJECTED"; p.gmNotes = input.note; });
  }
  async adminPauseProject(adminTokenArg: string, input: { projectId: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "PAUSED"; });
  }
  async adminResumeProject(adminTokenArg: string, input: { projectId: string }): Promise<ProjectCard> {
    this.requireAdmin(adminTokenArg);
    return this.mutateAnyProject(input.projectId, (p) => { p.status = "ACTIVE"; });
  }
```

(The admin token constant in `mockClient.ts` is `adminToken`; `requireAdmin`
already exists.)

- [ ] **Step 7: Run tests to verify pass**

Run: `npm run test --workspace frontend -- mockClient.projects`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/mockClient.projects.test.ts
git commit -m "feat(frontend): add project API types and three client implementations"
```

---

## Task 13: Player UI — HouseProjectsPanel in GamePage

**Files:**
- Create: `frontend/src/components/HouseProjectsPanel.tsx`
- Modify: `frontend/src/pages/GamePage.tsx`
- Test: `frontend/src/components/HouseProjectsPanel.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/HouseProjectsPanel.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MockApiClient } from "../api/mockClient";
import { ApiProvider } from "../api/ApiProvider";
import { HouseProjectsPanel } from "./HouseProjectsPanel";

async function seedToken(client: MockApiClient) {
  const acc = await client.createAccountAndHouse({
    displayName: "P", name: "Casa Teste", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
    leaderName: "L", heirName: "H", castleName: "Forte", townsText: "", historyText: "", specialty: "", weakness: "",
    attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
  } as any);
  return acc.playerToken;
}

describe("HouseProjectsPanel", () => {
  let client: MockApiClient;
  beforeEach(() => { client = new MockApiClient(); });

  it("renders the library and starts a project", async () => {
    const token = await seedToken(client);
    render(
      <ApiProvider client={client}>
        <HouseProjectsPanel playerToken={token} onChanged={() => {}} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText("Projetos da Casa")).toBeInTheDocument());
    fireEvent.click(await screen.findByText("Biblioteca"));
    const start = await screen.findAllByRole("button", { name: /Iniciar/i });
    fireEvent.click(start[0]);
    await waitFor(() => expect(screen.getByText(/Projetos Ativos/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace frontend -- HouseProjectsPanel`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/HouseProjectsPanel.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useApi } from "../api/ApiProvider";
import { ApiError, type ProjectCard, type ProjectsView, type ProjectTemplate } from "../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  MILITARY: "Militar", INFRASTRUCTURE: "Infraestrutura", ECONOMY: "Economia", DIPLOMACY: "Diplomacia",
  INTELLIGENCE: "Espionagem", SOCIETY: "Sociedade", MAGIC: "Magia", EXPLORATION: "Exploração",
};

function costLabel(costs: ProjectTemplate["costs"]): string {
  if (!costs.length) return "Sem custo";
  const names: Record<string, string> = { WEALTH: "Riqueza", RESOURCES: "Recursos", STABILITY: "Estabilidade", SOLDIERS_COMMITTED: "Soldados", CONTROL_COMMITTED: "Controle", FAVOR: "Favor", CUSTOM: "Especial" };
  return costs.map((c) => `${c.amount} ${names[c.type] ?? c.type}`).join(", ");
}

export function HouseProjectsPanel({ playerToken, onChanged }: { playerToken: string; onChanged: () => void }) {
  const api = useApi();
  const [data, setData] = useState<ProjectsView | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [proposal, setProposal] = useState<ProjectCard | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.getProjects(playerToken)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, playerToken]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setBusy(false); }
  }, [load, onChanged]);

  const active = useMemo(() => (data?.projects ?? []).filter((p) => p.status === "ACTIVE" || p.status === "PAUSED"), [data]);
  const pending = useMemo(() => (data?.projects ?? []).filter((p) => ["PENDING_PLAYER", "PENDING_GM", "PENDING_TARGET"].includes(p.status)), [data]);
  const templates = useMemo(() => {
    let list = data?.templates ?? [];
    if (filter !== "ALL") list = list.filter((t) => t.category === filter);
    if (search.trim()) list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [data, filter, search]);

  if (!data) return null;
  const slotFull = active.length >= data.slotLimit;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Projetos da Casa</Typography>
          <Chip label={`Estabilidade: ${data.stability}`} color="secondary" size="small" />
        </Stack>
        {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Projetos Ativos (${active.length}/${data.slotLimit})`} />
          <Tab label="Biblioteca" />
          <Tab label={`Favores (${data.favors.length})`} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            {active.length === 0 && <Typography color="text.secondary">Nenhum projeto ativo.</Typography>}
            {active.map((p) => (
              <Card key={p.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight="bold">{p.title}</Typography>
                    <Chip size="small" label={CATEGORY_LABELS[p.category]} />
                  </Stack>
                  {p.status === "PAUSED" && <Chip size="small" color="warning" label="Pausado" sx={{ my: 0.5 }} />}
                  <Typography variant="body2" sx={{ my: 1 }}>{p.description}</Typography>
                  <LinearProgress variant="determinate" value={(p.turnsCompleted / p.durationTurns) * 100} sx={{ my: 1 }} />
                  <Typography variant="caption">{p.turnsCompleted} de {p.durationTurns} turnos</Typography>
                  <Box>
                    <Button size="small" color="error" disabled={busy}
                      onClick={() => { if (confirm("Cancelar o projeto? O cancelamento não gera reembolso.")) void run(() => api.cancelProject(playerToken, { projectId: p.id })); }}>
                      Cancelar
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {pending.map((p) => (
              <Alert key={p.id} severity="info">
                {p.title} — {p.status === "PENDING_GM" ? "aguardando o mestre" : p.status === "PENDING_TARGET" ? "aguardando outra Casa" : "aguardando sua decisão"}
                {p.status === "PENDING_PLAYER" && (
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" disabled={busy} onClick={() => void run(() => api.acceptProject(playerToken, { projectId: p.id }))}>Aceitar</Button>
                    <Button size="small" disabled={busy} onClick={() => void run(() => api.submitProjectToGm(playerToken, { projectId: p.id }))}>Enviar ao mestre</Button>
                  </Box>
                )}
              </Alert>
            ))}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Categoria" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="ALL">Todas</MenuItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
              <Button variant="outlined" onClick={() => setCreateOpen(true)}>Criar minha carta</Button>
            </Stack>
            {slotFull && <Alert severity="warning">Limite de projetos ativos atingido.</Alert>}
            {templates.map((t) => (
              <Card key={t.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight="bold">{t.title}</Typography>
                    <Chip size="small" label={CATEGORY_LABELS[t.category]} />
                  </Stack>
                  <Typography variant="body2" sx={{ my: 0.5 }}>{t.description}</Typography>
                  <Typography variant="caption" display="block">Duração: {t.durationTurns} turnos · Custo: {costLabel(t.costs)}</Typography>
                  <Button size="small" sx={{ mt: 1 }} disabled={busy || slotFull}
                    onClick={() => { if (confirm(`Iniciar "${t.title}"? Custo: ${costLabel(t.costs)}.`)) void run(() => api.startProjectFromTemplate(playerToken, { templateId: t.id })); }}>
                    Iniciar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1}>
            {data.favors.length === 0 && <Typography color="text.secondary">Nenhum favor pendente.</Typography>}
            {data.favors.map((f) => (
              <Alert key={f.id} severity="info"
                action={<>
                  <Button size="small" disabled={busy} onClick={() => void run(() => api.respondToFavor(playerToken, { favorId: f.id, accept: true }))}>Aceitar</Button>
                  <Button size="small" color="error" disabled={busy} onClick={() => void run(() => api.respondToFavor(playerToken, { favorId: f.id, accept: false }))}>Recusar</Button>
                </>}>
                {f.reason} (de {f.fromHouseId})
              </Alert>
            ))}
          </Stack>
        )}
      </CardContent>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Criar minha carta</DialogTitle>
        <DialogContent>
          {!proposal ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="O que sua Casa deseja realizar?" value={request} onChange={(e) => setRequest(e.target.value)} multiline minRows={3} fullWidth />
              <TextField select label="Nível de risco" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as "low" | "medium" | "high")}>
                <MenuItem value="low">Baixo</MenuItem>
                <MenuItem value="medium">Médio</MenuItem>
                <MenuItem value="high">Alto</MenuItem>
              </TextField>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography fontWeight="bold">{proposal.title}</Typography>
              <Typography variant="body2">{proposal.description}</Typography>
              <Typography variant="caption">Duração: {proposal.durationTurns} turnos · Custo: {costLabel(proposal.costs)}</Typography>
              {proposal.aiBalanceExplanation && <Alert severity="info">{proposal.aiBalanceExplanation}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!proposal ? (
            <Button disabled={busy || !request.trim()} onClick={async () => {
              setBusy(true); setError(null);
              try { setProposal(await api.analyzeCustomProject(playerToken, { request, riskLevel })); }
              catch (e) { setError(e instanceof ApiError ? e.message : "Falha ao analisar."); }
              finally { setBusy(false); }
            }}>Analisar</Button>
          ) : (
            <>
              <Button onClick={() => setProposal(null)}>Pedir ajuste</Button>
              <Button variant="contained" disabled={busy} onClick={() => void run(async () => {
                await api.acceptProject(playerToken, { projectId: proposal.id });
                setProposal(null); setRequest(""); setCreateOpen(false);
              })}>Aceitar</Button>
            </>
          )}
          <Button onClick={() => { setCreateOpen(false); setProposal(null); }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 4: Render in `GamePage.tsx`**

Add the import near the other component imports:

```ts
import { HouseProjectsPanel } from "../components/HouseProjectsPanel";
```

Render it after the House card (find where the House `<Card>` closes and the
order form begins; insert between them). Pass the player token from
`loadPlayerSession()` and refresh the game view on change:

```tsx
{session && (
  <HouseProjectsPanel playerToken={session.playerToken} onChanged={() => void loadGame()} />
)}
```

Ensure `session` (from `loadPlayerSession()`) and a `loadGame` callback are in
scope; if the existing loader is named differently (e.g. the `useCallback` that
calls `api.getGame`), reuse that name instead of `loadGame`.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test --workspace frontend -- HouseProjectsPanel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/HouseProjectsPanel.tsx frontend/src/components/HouseProjectsPanel.test.tsx frontend/src/pages/GamePage.tsx
git commit -m "feat(frontend): add House Projects player panel"
```

---

## Task 14: GM UI — AdminProjectsTab

**Files:**
- Create: `frontend/src/components/admin/AdminProjectsTab.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Test: `frontend/src/components/admin/AdminProjectsTab.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/admin/AdminProjectsTab.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminProjectsTab } from "./AdminProjectsTab";

describe("AdminProjectsTab", () => {
  it("lists projects and approves a pending one", async () => {
    const client = new MockApiClient();
    // Seed a pending-GM project directly via the mock's admin list by starting one that needs GM.
    const acc = await client.createAccountAndHouse({
      displayName: "P", name: "Casa X", motto: "", emblem: { icon: "lobo", color1: "#000", color2: "#111" },
      leaderName: "L", heirName: "H", castleName: "F", townsText: "", historyText: "", specialty: "", weakness: "",
      attributes: { riqueza: 3, recursos: 3, soldados: 2, controle: 2 },
    } as any);
    await client.startProjectFromTemplate(acc.playerToken, { templateId: "contratar-a-ordem-dos-tres" });

    render(
      <ApiProvider client={client}>
        <AdminProjectsTab adminToken="mock-admin-token" busy={false} onError={vi.fn()} />
      </ApiProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Contratar a Ordem dos Três/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Aprovar/i }));
    await waitFor(() => expect(screen.getByText(/ACTIVE|Ativo/i)).toBeInTheDocument());
  });
});
```

> Note: the mock admin token constant in `mockClient.ts` is
> `const adminToken = "mock-admin-token"` (used by `requireAdmin`). The test above
> uses that exact literal.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace frontend -- AdminProjectsTab`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/admin/AdminProjectsTab.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useApi } from "../../api/ApiProvider";
import { ApiError, type ProjectCard } from "../../types/api";

export function AdminProjectsTab({ adminToken, busy, onError }: { adminToken: string; busy: boolean; onError: (m: string) => void }) {
  const api = useApi();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setProjects(await api.adminListProjects(adminToken)); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Erro ao carregar projetos."); }
  }, [api, adminToken, onError]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); await load(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setWorking(false); }
  }, [load, onError]);

  const pending = useMemo(() => projects.filter((p) => p.status === "PENDING_GM"), [projects]);
  const activeOrPaused = useMemo(() => projects.filter((p) => p.status === "ACTIVE" || p.status === "PAUSED"), [projects]);
  const disabled = busy || working;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Aprovações pendentes</Typography>
      {pending.length === 0 && <Typography color="text.secondary">Nenhum projeto aguardando aprovação.</Typography>}
      {pending.map((p) => (
        <Card key={p.id} variant="outlined">
          <CardContent>
            <Typography fontWeight="bold">{p.title} <Chip size="small" label={p.houseId} /></Typography>
            {p.playerOriginalRequest && <Typography variant="body2" color="text.secondary">Pedido: {p.playerOriginalRequest}</Typography>}
            <Typography variant="body2" sx={{ my: 1 }}>{p.description}</Typography>
            <Typography variant="caption" display="block">Duração: {p.durationTurns} turnos</Typography>
            {p.aiBalanceExplanation && <Alert severity="info" sx={{ my: 1 }}>{p.aiBalanceExplanation}</Alert>}
            <TextField size="small" fullWidth label="Nota do mestre" value={notes[p.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} sx={{ my: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={disabled} onClick={() => void run(() => api.adminApproveProject(adminToken, { projectId: p.id, note: notes[p.id] }))}>Aprovar</Button>
              <Button color="error" disabled={disabled} onClick={() => void run(() => api.adminRejectProject(adminToken, { projectId: p.id, note: notes[p.id] ?? "Rejeitado." }))}>Rejeitar</Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Typography variant="h6">Projetos ativos</Typography>
      {activeOrPaused.map((p) => (
        <Card key={p.id} variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography>{p.title} <Chip size="small" label={p.houseId} /> <Chip size="small" label={p.status} /></Typography>
              {p.status === "ACTIVE"
                ? <Button size="small" disabled={disabled} onClick={() => void run(() => api.adminPauseProject(adminToken, { projectId: p.id }))}>Pausar</Button>
                : <Button size="small" disabled={disabled} onClick={() => void run(() => api.adminResumeProject(adminToken, { projectId: p.id }))}>Retomar</Button>}
            </Stack>
            <Typography variant="caption">{p.turnsCompleted} de {p.durationTurns} turnos</Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Wire into `AdminPage.tsx`**

Add the import:

```ts
import { AdminProjectsTab } from "../components/admin/AdminProjectsTab";
```

Add a tab entry to the `TABS` array (after `prompts`):

```ts
  { value: "projetos", label: "Projetos", disabled: false },
```

Render its content alongside the other `activeTab ===` blocks:

```tsx
{activeTab === "projetos" && adminToken && (
  <AdminProjectsTab adminToken={adminToken} busy={busy} onError={setError} />
)}
```

Use the existing admin token state variable name and the existing error setter
(`setError`) — inspect `AdminPage.tsx` and match the actual identifiers.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test --workspace frontend -- AdminProjectsTab`
Expected: PASS.
Run: `npm run test --workspace frontend`
Expected: PASS (all frontend tests green).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AdminProjectsTab.tsx frontend/src/components/admin/AdminProjectsTab.test.tsx frontend/src/pages/AdminPage.tsx
git commit -m "feat(frontend): add GM projects approval tab"
```

---

## Final verification

- [ ] **Build shared, then run all suites**

```bash
npm run build --workspace shared
npm run test --workspace shared
npm run test --workspace backend
npm run test --workspace frontend
```

Expected: all green (backend ~237+, frontend ~93+ plus the new tests).

- [ ] **Typecheck / build both apps**

```bash
npm run build:backend
npm run build --workspace frontend
```

Expected: no TypeScript errors.

- [ ] **Lint the changed files (baseline has known pre-existing errors)**

Run: `npx eslint backend/src/projects backend/src/routes/projectRoutes.ts frontend/src/components/HouseProjectsPanel.tsx frontend/src/components/admin/AdminProjectsTab.tsx`
Expected: no new errors in the new files (remove unused imports if flagged).

## Deploy (after merge to main)

- Backend (SAM): `npm run build:backend`; from `backend/`: `set -a && source .deploy.env && set +a && sam deploy --stack-name ravenloft-winter --region us-east-1 --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM --resolve-s3 --parameter-overrides AdminCodeHash="$ADMIN_CODE_HASH" TokenSigningSecret="$TOKEN_SIGNING_SECRET" AllowedOrigin="https://main.d1emmrcvmpw55g.amplifyapp.com" OpenAiApiKey="$OPENAI_API_KEY" OpenAiModel=gpt-4o-mini`
- Frontend (manual Amplify zip): `cd frontend && npm run build`; `cd dist && zip -qr /tmp/hp.zip .`; `aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --region us-east-1` → upload zip to `zipUploadUrl` via `curl -H "Content-Type: application/zip" --upload-file /tmp/hp.zip "$zipUploadUrl"` → `aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id <id> --region us-east-1` → poll `aws amplify get-job` until SUCCEED.
- Smoke test: open `/game` (Projetos da Casa panel: start a template, see it active), and `/admin?tab=projetos` (approve/pause).
