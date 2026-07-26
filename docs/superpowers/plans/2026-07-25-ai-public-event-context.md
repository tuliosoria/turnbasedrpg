# AI Public Event Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Rascunhar evento público com IA" use the campaign plot, player-created Houses, public Wiki and the last 5 turns for continuity.

**Architecture:** Keep the existing admin endpoint and JSON response shape. Add a focused prompt-context formatter in `backend/src/ai/prompts.ts`, then have `draftPublicEvent` load Wiki entries and recent submissions before calling OpenAI.

**Tech Stack:** TypeScript, Vitest, AWS Lambda backend, DynamoDB, OpenAI chat completion helper.

---

## File structure

- `backend/src/ai/prompts.ts`: owns prompt formatting. Add types and helper functions for public event context here because the prompt builder already lives here.
- `backend/src/ai/prompts.test.ts`: unit tests for the context packet and prompt guardrails.
- `backend/src/routes/adminRoutes.ts`: load Wiki entries and recent turn submissions, then pass the richer context to `buildPublicEventPrompt`.
- `backend/src/routes/adminRoutes.test.ts`: route integration tests using mocked DB modules and mocked chat.

---

### Task 1: Add public event context formatting

**Files:**
- Modify: `backend/src/ai/prompts.test.ts`
- Modify: `backend/src/ai/prompts.ts`

- [ ] **Step 1: Write the failing test**

Add this import update at the top of `backend/src/ai/prompts.test.ts`:

```ts
import type { House, Submission, Turn, WikiEntry } from "@ravenloft/content";
import { buildChronicle, buildImagePrompt, buildHouseImagePrompt, buildPrivateInfoPrompt, buildPublicEventPrompt, buildResolutionPrompt, buildPublicEventContext } from "./prompts";
```

Then add this test inside `describe("buildPublicEventPrompt", () => { ... })`:

```ts
it("builds a rich continuity packet for public event drafting", () => {
  const wiki: WikiEntry[] = [
    {
      entryId: "w1",
      section: "casas",
      title: "Casa Do Ouro",
      body: "Mineiros, joalheiros e ferreiros ergueram vilas nas encostas.",
      order: 6,
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
  ];
  const turns: Turn[] = [
    {
      turnId: 1,
      status: "RESOLVED",
      publicEvent: "A neve fechou a estrada do norte.",
      privateInfo: { "casa-vargen": "Batedores viram luzes azuis na ponte." },
      createdAt: "2026-01-01T00:00:00.000Z",
      result: {
        publicResult: "A ponte caiu antes do amanhecer.",
        houseResults: { "casa-vargen": "A guarda retornou com baixas." },
        attributeDeltas: { "casa-vargen": { soldados: -1 } },
        discoveries: ["Há túneis sob a estrada velha."],
      },
    },
  ];
  const submissionsByTurn = new Map<number, Submission[]>([
    [1, [{ houseId: "casa-vargen", orderText: "Enviar patrulhas discretas.", submittedAt: "2026-01-02T00:00:00.000Z" }]],
  ]);

  const context = buildPublicEventContext({
    lore: "Valdren está cercada pelas Brumas.",
    houses,
    wiki,
    turns,
    submissionsByTurn,
  });

  expect(context).toContain("ENREDO");
  expect(context).toContain("Valdren está cercada pelas Brumas.");
  expect(context).toContain("CASAS EM JOGO");
  expect(context).toContain("Casa Vargen");
  expect(context).toContain("Líder: Aldric");
  expect(context).toContain("História: Uma casa antiga.");
  expect(context).toContain("WIKI PÚBLICA");
  expect(context).toContain("Casa Do Ouro");
  expect(context).toContain("ÚLTIMOS 5 TURNOS");
  expect(context).toContain("Evento público: A neve fechou a estrada do norte.");
  expect(context).toContain("Informação privada para Casa Vargen: Batedores viram luzes azuis na ponte.");
  expect(context).toContain("Ordem da Casa Vargen: Enviar patrulhas discretas.");
  expect(context).toContain("Resultado privado da Casa Vargen: A guarda retornou com baixas.");
  expect(context).toContain("Mudanças de atributos: Casa Vargen: soldados -1");
  expect(context).toContain("Descobertas: Há túneis sob a estrada velha.");
  expect(context).toContain("REGRA DE SIGILO");
  expect(context).toContain("não revele diretamente");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: FAIL with an import error because `buildPublicEventContext` is not exported yet.

- [ ] **Step 3: Implement the context builder**

In `backend/src/ai/prompts.ts`, update the imports:

```ts
import type { Turn, TurnResult, House, Submission, Emblem, WikiEntry, AttributeKey } from "@ravenloft/content";
```

Add these interfaces and helpers below `WorldContext`:

```ts
export interface PublicEventContextInput {
  lore?: string;
  houses: House[];
  wiki: WikiEntry[];
  turns: Turn[];
  submissionsByTurn: Map<number, Submission[]>;
}

function houseName(houses: House[], houseId: string): string {
  return houses.find((h) => h.houseId === houseId)?.name ?? houseId;
}

function publicHouseLine(h: House): string {
  const a = h.attributes;
  return [
    `${h.name} (${h.houseId})`,
    `Lema: ${h.motto}`,
    `Líder: ${h.leaderName}`,
    `Herdeiro: ${h.heirName}`,
    `Castelo: ${h.castleName}`,
    `Povoados: ${h.townsText}`,
    `História: ${h.historyText}`,
    `Especialidade: ${h.specialty}`,
    `Fraqueza: ${h.weakness}`,
    `Atributos: Riqueza ${a.riqueza}, Recursos ${a.recursos}, Soldados ${a.soldados}, Controle ${a.controle}`,
  ].join("\n");
}

function formatAttributeDeltas(houses: House[], deltas: TurnResult["attributeDeltas"]): string {
  const lines: string[] = [];
  for (const [houseId, attrs] of Object.entries(deltas ?? {})) {
    const parts = Object.entries(attrs as Partial<Record<AttributeKey, number>>)
      .map(([key, value]) => `${key} ${value && value > 0 ? `+${value}` : value}`)
      .join(", ");
    if (parts) lines.push(`${houseName(houses, houseId)}: ${parts}`);
  }
  return lines.length ? lines.join("; ") : "nenhuma";
}

function formatTurnMemory(turn: Turn, houses: House[], submissions: Submission[]): string {
  const privateInfo = Object.entries(turn.privateInfo ?? {})
    .map(([houseId, text]) => `Informação privada para ${houseName(houses, houseId)}: ${text}`)
    .join("\n") || "Informação privada: nenhuma";
  const orders = submissions
    .map((s) => `Ordem da ${houseName(houses, s.houseId)}: ${s.orderText}`)
    .join("\n") || "Ordens: nenhuma";
  const privateResults = Object.entries(turn.result?.houseResults ?? {})
    .map(([houseId, text]) => `Resultado privado da ${houseName(houses, houseId)}: ${text}`)
    .join("\n") || "Resultados privados: nenhum";
  const discoveries = turn.result?.discoveries?.length ? turn.result.discoveries.join("; ") : "nenhuma";
  return [
    `Turno ${turn.turnId} (${turn.status})`,
    `Evento público: ${turn.publicEvent || "(vazio)"}`,
    privateInfo,
    orders,
    `Resultado público: ${turn.result?.publicResult ?? "(sem resultado público)"}`,
    privateResults,
    `Mudanças de atributos: ${formatAttributeDeltas(houses, turn.result?.attributeDeltas ?? {})}`,
    `Descobertas: ${discoveries}`,
  ].join("\n");
}

export function buildPublicEventContext(input: PublicEventContextInput): string {
  const recentTurns = input.turns
    .sort((a, b) => a.turnId - b.turnId)
    .slice(-5);
  const wikiText = input.wiki
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.title.localeCompare(b.title))
    .map((entry) => `[${entry.section}] ${entry.title}\n${entry.body}`)
    .join("\n\n") || "(nenhuma entrada pública na Wiki)";
  const turnText = recentTurns
    .map((turn) => formatTurnMemory(turn, input.houses, input.submissionsByTurn.get(turn.turnId) ?? []))
    .join("\n\n") || "(nenhum turno anterior)";

  return [
    "ENREDO",
    input.lore?.trim() || "(sem World Bible cadastrado)",
    "",
    "CASAS EM JOGO",
    input.houses.length ? input.houses.map(publicHouseLine).join("\n\n") : "(nenhuma Casa cadastrada)",
    "",
    "WIKI PÚBLICA",
    wikiText,
    "",
    "ÚLTIMOS 5 TURNOS",
    turnText,
    "",
    "REGRA DE SIGILO",
    "Use informações privadas, ordens e resultados privados apenas como memória de continuidade. Não revele diretamente segredos, ordens privadas, consequências privadas, descobertas ocultas ou verdades de mestre no evento público. Transforme esse material em sinais públicos, rumores, pressões, consequências indiretas e novos problemas visíveis.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: PASS for `backend/src/ai/prompts.test.ts`.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/ai/prompts.ts backend/src/ai/prompts.test.ts
git commit -m "feat: format AI public event context"
```

---

### Task 2: Inject rich context into the public event prompt

**Files:**
- Modify: `backend/src/ai/prompts.test.ts`
- Modify: `backend/src/ai/prompts.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("buildPublicEventPrompt", () => { ... })`:

```ts
it("injects the rich continuity packet and tells the model not to leak private memory", () => {
  const context = [
    "ENREDO",
    "Valdren está cercada pelas Brumas.",
    "CASAS EM JOGO",
    "Casa Do Ouro",
    "WIKI PÚBLICA",
    "Casa Khazdrun",
    "ÚLTIMOS 5 TURNOS",
    "Informação privada para Casa Solarion: um culto viu sinais no rio.",
    "REGRA DE SIGILO",
    "não revele diretamente",
  ].join("\n");

  const prompt = buildPublicEventPrompt(houses, { publicEventContext: context });

  expect(prompt.system).toContain("CONTEXTO DA CAMPANHA");
  expect(prompt.system).toContain("Casa Do Ouro");
  expect(prompt.system).toContain("Informação privada para Casa Solarion");
  expect(prompt.system).toContain("não revele diretamente");
  expect(prompt.system).toContain("Não decida as ações das Casas nem os resultados.");
  expect(prompt.user).toContain("Use o CONTEXTO DA CAMPANHA");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: FAIL because `WorldContext` does not yet have `publicEventContext` and `buildPublicEventPrompt` ignores that field.

- [ ] **Step 3: Update the prompt type and builder**

In `backend/src/ai/prompts.ts`, update `WorldContext`:

```ts
export interface WorldContext {
  lore?: string;
  chronicle?: string;
  publicEventContext?: string;
}
```

Replace `buildPublicEventPrompt` with:

```ts
export function buildPublicEventPrompt(houses: House[], ctx?: WorldContext): { system: string; user: string } {
  const contextBlock = ctx?.publicEventContext?.trim()
    ? `\n\nCONTEXTO DA CAMPANHA:\n${ctx.publicEventContext.trim()}`
    : "";
  const system = withContext(PREMISE, { lore: ctx?.lore, chronicle: ctx?.chronicle }) +
    contextBlock +
    " Crie o EVENTO PÚBLICO do próximo turno: um acontecimento marcante que afeta todo o reino de Valdren e provoca decisões das Casas. Escreva 2 a 4 frases, com tom sombrio e cinematográfico, coerente com o mundo e a continuidade dos turnos anteriores. Não decida as ações das Casas nem os resultados. Não exponha diretamente informações privadas, ordens privadas, consequências privadas ou segredos ainda não revelados. Responda ESTRITAMENTE em JSON no formato: {\"publicEvent\": string}.";
  const user = [
    "Use o CONTEXTO DA CAMPANHA para criar continuidade. O texto final deve ser conhecimento público dos personagens.",
    "Casas atualmente em jogo:",
    houses.length ? houses.map(houseLine).join("\n") : "(nenhuma Casa cadastrada ainda)",
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: PASS for `backend/src/ai/prompts.test.ts`.

- [ ] **Step 5: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/ai/prompts.ts backend/src/ai/prompts.test.ts
git commit -m "feat: enrich public event AI prompt"
```

---

### Task 3: Load Wiki and recent submissions in the admin route

**Files:**
- Modify: `backend/src/routes/adminRoutes.test.ts`
- Modify: `backend/src/routes/adminRoutes.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("draftPublicEvent", () => { ... })` in `backend/src/routes/adminRoutes.test.ts`:

```ts
it("passes world lore, player Houses, Wiki and the last 5 turns with submissions into the prompt", async () => {
  const chat = vi.fn(async () => JSON.stringify({ publicEvent: "Sinos tocam ao sul de Solythar." }));
  vi.mocked(worldBibleDb.getWorldBible).mockResolvedValue({
    lore: "Valdren é uma ilha cercada pelas Brumas.",
    visualDirectives: "Dark fantasy",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  vi.mocked(wikiDb.listWikiEntries).mockResolvedValue([
    {
      entryId: "w1",
      section: "casas",
      title: "Casa Do Ouro",
      body: "Mineiros, joalheiros e ferreiros enriqueceram nas encostas.",
      order: 6,
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
  ]);
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...draftTurn, turnId: 7, status: "DRAFT" });
  vi.mocked(turnsDb.listTurns).mockResolvedValue([
    ...Array.from({ length: 6 }, (_, i): Turn => ({
      turnId: i + 1,
      status: "RESOLVED",
      publicEvent: `Evento ${i + 1}`,
      privateInfo: { "casa-vargen": `Privado ${i + 1}` },
      createdAt: "2026-01-01T00:00:00.000Z",
      result: {
        publicResult: `Resultado ${i + 1}`,
        houseResults: { "casa-vargen": `Resultado privado ${i + 1}` },
        attributeDeltas: { "casa-vargen": { soldados: -1 } },
        discoveries: [`Descoberta ${i + 1}`],
      },
    })),
    { ...draftTurn, turnId: 7, status: "DRAFT" },
  ]);
  vi.mocked(submissionsDb.listSubmissions).mockImplementation(async (_doc, _table, _campaign, turnId) => [
    { houseId: "casa-vargen", orderText: `Ordem ${turnId}`, submittedAt: "2026-01-02T00:00:00.000Z" },
  ]);

  const res = await draftPublicEvent({ ...deps, chat }, authReq({ method: "POST" }));

  expect(res).toEqual({ status: 200, body: { publicEvent: "Sinos tocam ao sul de Solythar." } });
  expect(wikiDb.listWikiEntries).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead");
  expect(submissionsDb.listSubmissions).toHaveBeenCalledTimes(5);
  expect(submissionsDb.listSubmissions).not.toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 1);
  expect(submissionsDb.listSubmissions).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 2);
  expect(submissionsDb.listSubmissions).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 6);
  const system = chat.mock.calls[0][0] as string;
  expect(system).toContain("CONTEXTO DA CAMPANHA");
  expect(system).toContain("Valdren é uma ilha cercada pelas Brumas.");
  expect(system).toContain("Casa Do Ouro");
  expect(system).toContain("Uma casa antiga.");
  expect(system).toContain("Ordem da Casa Vargen: Ordem 6");
  expect(system).toContain("Resultado privado da Casa Vargen: Resultado privado 6");
  expect(system).toContain("Descoberta 6");
  expect(system).not.toContain("Evento 1");
  expect(turnsDb.putTurn).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/routes/adminRoutes.test.ts
```

Expected: FAIL because `draftPublicEvent` does not call `listWikiEntries` or `listSubmissions` for the last 5 turns yet.

- [ ] **Step 3: Update imports**

In `backend/src/routes/adminRoutes.ts`, change the prompts import to include `buildPublicEventContext`:

```ts
import { buildChronicle, buildImagePrompt, buildPrivateInfoPrompt, buildPublicEventContext, buildPublicEventPrompt, buildResolutionPrompt } from "../ai/prompts";
```

- [ ] **Step 4: Update `draftPublicEvent`**

Replace the data loading and prompt creation inside `draftPublicEvent` with:

```ts
  const [houses, turns, worldBible, wiki] = await Promise.all([
    listHouses(deps.doc, tableName, campaignId),
    listTurns(deps.doc, tableName, campaignId),
    dbGetWorldBible(deps.doc, tableName, campaignId),
    listWikiEntries(deps.doc, tableName, campaignId),
  ]);
  const previousTurns = turns.filter((t) => t.turnId < turn.turnId);
  const recentTurns = previousTurns.slice(-5);
  const submissionPairs = await Promise.all(
    recentTurns.map(async (t) => [t.turnId, await listSubmissions(deps.doc, tableName, campaignId, t.turnId)] as const),
  );
  const submissionsByTurn = new Map(submissionPairs);
  const chronicle = buildChronicle(previousTurns);
  const publicEventContext = buildPublicEventContext({
    lore: worldBible?.lore,
    houses,
    wiki,
    turns: recentTurns,
    submissionsByTurn,
  });
  const { system, user } = buildPublicEventPrompt(houses, { lore: worldBible?.lore, chronicle, publicEventContext });
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/routes/adminRoutes.test.ts
```

Expected: PASS for `backend/src/routes/adminRoutes.test.ts`.

- [ ] **Step 6: Commit**

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/src/routes/adminRoutes.ts backend/src/routes/adminRoutes.test.ts
git commit -m "feat: pass rich context to public event AI"
```

---

### Task 4: Validate, deploy and push

**Files:**
- No new source files beyond prior tasks.

- [ ] **Step 1: Run focused backend verification**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/ai/prompts.test.ts src/routes/adminRoutes.test.ts
```

Expected: both test files pass.

- [ ] **Step 2: Run backend typecheck**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run typecheck --workspace backend
```

Expected: TypeScript exits 0 with no errors.

- [ ] **Step 3: Build backend**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build:backend
```

Expected: shared package builds, backend bundle writes `backend/dist/handler.mjs`.

- [ ] **Step 4: Deploy backend**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run deploy:backend
```

Expected: SAM deploy completes successfully for stack `ravenloft-winter`.

- [ ] **Step 5: Smoke test the admin AI endpoint shape**

Run this only if an admin token is available in the environment as `ADMIN_TOKEN`:

```bash
curl -s -X POST https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/admin/turn/draft-public-event \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: a JSON response containing either `{ "publicEvent": "..." }` if AI is configured and the active turn is `DRAFT`, or a clear API error such as `BAD_STATUS` if there is no draft turn. Do not force campaign state changes just to smoke test.

- [ ] **Step 6: Push commits**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git push
```

Expected: all implementation commits are pushed to `origin/main`.
