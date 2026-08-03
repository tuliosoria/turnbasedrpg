# Player Turn History Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players browse every resolved past turn on `/game` via horizontal tabs (Turno 1, Turno 2, …), each showing that turn's public result + the player's private result + result image.

**Architecture:** Replace the single `previousResult` field on `PlayerGameView` with a `turnHistory` array of all RESOLVED turns. The backend `getGame` builds it from `listTurns`; the mock mirrors it from tracked resolved turns; `GamePage` renders a tabbed history card.

**Tech Stack:** TypeScript, React, MUI (`Tabs`/`Tab`), Vitest + Testing Library, AWS Lambda (DynamoDB), Vite.

---

### Task 1: Replace `previousResult` type with `turnHistory`

**Files:**
- Modify: `frontend/src/types/api.ts` (interfaces `PreviousResult`, `PlayerGameView` around lines 120-136)

This is a pure type change consumed by later tasks. There is no dedicated test file for `types/api.ts`; type correctness is enforced by `tsc` when the backend/mock/frontend tasks compile.

- [ ] **Step 1: Remove `PreviousResult`, add `TurnHistoryEntry`, update `PlayerGameView`**

In `frontend/src/types/api.ts`, delete the `PreviousResult` interface:

```ts
export interface PreviousResult {
  publicResult?: string;
  privateResult?: string;
  discoveries: string[];
  resultImageUrl?: string;
}
```

Replace it with:

```ts
export interface TurnHistoryEntry {
  turnId: number;
  publicResult?: string;
  privateResult?: string;
  discoveries: string[];
  resultImageUrl?: string;
}
```

Then in `PlayerGameView`, change the last field from:

```ts
  previousResult: PreviousResult | null;
```

to:

```ts
  turnHistory: TurnHistoryEntry[];
```

- [ ] **Step 2: Verify frontend type-checks in isolation are expected to fail elsewhere**

Run: `cd frontend && npx tsc --noEmit`
Expected: FAIL — errors in `src/api/mockClient.ts` and `src/pages/GamePage.tsx` referencing `previousResult`. This is expected; those are fixed in Tasks 3 and 4. (Type file itself must not report errors.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api.ts
git commit -m "refactor: replace previousResult with turnHistory in PlayerGameView type"
```

---

### Task 2: Backend `getGame` returns `turnHistory`

**Files:**
- Modify: `backend/src/routes/playerRoutes.ts` (`getGame`, the whole `resultTurn`/`previousResult` block)
- Test: `backend/src/routes/playerRoutes.test.ts`

- [ ] **Step 1: Update the failing tests first**

In `backend/src/routes/playerRoutes.test.ts`:

Replace the assertion `previousResult: null,` inside the test `"returns the house, active turn, private information, and submission"` with:

```ts
      turnHistory: [],
```

Replace the entire test `"includes the previous result when the active turn is resolved"` with:

```ts
  it("includes resolved turns in turnHistory", async () => {
    const resolvedTurn: Turn = {
      ...openTurn,
      status: "RESOLVED",
      result: {
        publicResult: "O reino sobreviveu à noite.",
        houseResults: { "casa-vargen": "Vargen segurou a passagem." },
        attributeDeltas: {},
        discoveries: ["Há mortos sob o lago."],
      },
      resultImageUrl: "https://example.com/resultado.png",
    };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(resolvedTurn);
    vi.mocked(turnsDb.listTurns).mockResolvedValue([resolvedTurn]);

    const res = await getGame(deps, authReq());

    expect((res.body as any).turnHistory).toEqual([
      {
        turnId: 1,
        publicResult: "O reino sobreviveu à noite.",
        privateResult: "Vargen segurou a passagem.",
        discoveries: ["Há mortos sob o lago."],
        resultImageUrl: "https://example.com/resultado.png",
      },
    ]);
  });

  it("lists multiple resolved turns ascending and excludes non-resolved turns", async () => {
    const turn1: Turn = {
      ...openTurn,
      turnId: 1,
      status: "RESOLVED",
      result: {
        publicResult: "Turno 1 público.",
        houseResults: { "casa-vargen": "Vargen no turno 1." },
        attributeDeltas: {},
        discoveries: [],
      },
    };
    const turn2: Turn = {
      ...openTurn,
      turnId: 2,
      status: "RESOLVED",
      result: {
        publicResult: "Turno 2 público.",
        houseResults: { "casa-vargen": "Vargen no turno 2." },
        attributeDeltas: {},
        discoveries: [],
      },
    };
    const turn3Open: Turn = { ...openTurn, turnId: 3, status: "OPEN" };
    vi.mocked(turnsDb.getActiveTurn).mockResolvedValue(turn3Open);
    // deliberately out of order to prove sorting
    vi.mocked(turnsDb.listTurns).mockResolvedValue([turn2, turn3Open, turn1]);

    const res = await getGame(deps, authReq());

    const history = (res.body as any).turnHistory;
    expect(history.map((h: any) => h.turnId)).toEqual([1, 2]);
    expect(history[0].privateResult).toBe("Vargen no turno 1.");
    expect(history[1].privateResult).toBe("Vargen no turno 2.");
  });
```

Delete the test `"keeps showing the latest resolved result while the next turn is only a draft"` entirely (its behavior is now covered by turnHistory always listing resolved turns). If that test references a `draftTurn`/`resolvedTurn` local only used there, remove those locals too.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/routes/playerRoutes.test.ts`
Expected: FAIL — body has `previousResult`, not `turnHistory`.

- [ ] **Step 3: Update `getGame` implementation**

In `backend/src/routes/playerRoutes.ts`, replace this block:

```ts
  let resultTurn = turn?.status === "RESOLVED" ? turn : null;
  if (turn?.status === "DRAFT") {
    const turns = await listTurns(deps.doc, deps.config.tableName, deps.config.campaignId);
    resultTurn = turns
      .filter((t) => t.turnId < turn.turnId && t.status === "RESOLVED" && t.result)
      .at(-1) ?? null;
  }
  const previousResult = resultTurn?.result
    ? {
        publicResult: resultTurn.result.publicResult,
        privateResult: resultTurn.result.houseResults[houseId],
        discoveries: resultTurn.result.discoveries ?? [],
        resultImageUrl: resultTurn.resultImageUrl,
      }
    : null;
```

with:

```ts
  const allTurns = await listTurns(deps.doc, deps.config.tableName, deps.config.campaignId);
  const turnHistory = allTurns
    .filter((t) => t.status === "RESOLVED" && t.result)
    .sort((a, b) => a.turnId - b.turnId)
    .map((t) => ({
      turnId: t.turnId,
      publicResult: t.result!.publicResult,
      privateResult: t.result!.houseResults[houseId],
      discoveries: t.result!.discoveries ?? [],
      resultImageUrl: t.resultImageUrl,
    }));
```

Then in the returned `body`, replace `previousResult,` with `turnHistory,`.

Confirm `listTurns` is still imported (it is already imported at the top of the file).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/playerRoutes.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS (no other test referenced `previousResult`)

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/playerRoutes.ts backend/src/routes/playerRoutes.test.ts
git commit -m "feat: expose resolved turn history from getGame"
```

---

### Task 3: Mock API `getGame` builds `turnHistory`

**Files:**
- Modify: `frontend/src/api/mockClient.ts` (fields, `getGame`, `adminApplyResolution`, `adminResetCampaign`)
- Test: `frontend/src/api/mockClient.test.ts`

The mock currently tracks only a single `lastResult`. It must track all resolved turns so `getGame` can build `turnHistory`.

**Admin flow reference (verified against `mockClient.ts`):** admin code is `"admin-test"`; `adminOpenTurn(token)` takes only the token (the event is set beforehand via `adminComposeTurn(token, { publicEvent, privateInfo })`). The mock's starter turn (turnId 1) is already `OPEN`, so resolving it is just `adminLockTurn` → `adminApplyResolution`. Every subsequent turn requires `adminComposeTurn` → `adminOpenTurn` → `adminLockTurn` → `adminApplyResolution`. The test file already imports `houseInput`.

- [ ] **Step 1: Write the failing test**

Add this test to `frontend/src/api/mockClient.test.ts` (inside the existing top-level `describe`):

```ts
it("accumulates resolved turns in getGame turnHistory", async () => {
  const client = new MockApiClient();
  const account = await client.createAccountAndHouse(houseInput);
  const { adminToken } = await client.adminLogin("admin-test");

  // Starter turn (turnId 1) is already OPEN — lock and resolve it.
  await client.adminLockTurn(adminToken);
  await client.adminApplyResolution(adminToken, {
    publicResult: "Resultado público 1",
    houseResults: { [account.houseId]: "Privado casa turno 1" },
    attributeDeltas: {},
    discoveries: [],
  });

  const view = await client.getGame(account.playerToken);
  expect(view.turnHistory).toHaveLength(1);
  expect(view.turnHistory[0]).toMatchObject({
    turnId: 1,
    publicResult: "Resultado público 1",
    privateResult: "Privado casa turno 1",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: FAIL — `view.turnHistory` is `undefined`.

- [ ] **Step 3: Track resolved turns in the mock (replacing `lastResult`)**

The single-result fields `lastResult`/`lastResultImageUrl` become dead once `getGame` no longer reads them, so replace them with a list. In `frontend/src/api/mockClient.ts`:

Replace the two fields (near line 110):

```ts
  private lastResult: TurnResult | null = null;
  private lastResultImageUrl: string | undefined = undefined;
```

with:

```ts
  private resolvedTurns: Array<{ turnId: number; result: TurnResult; resultImageUrl?: string }> = [];
```

In `adminApplyResolution`, replace the two assignments:

```ts
    this.lastResult = result;
    this.lastResultImageUrl = this.activeTurn.resultImageUrl;
```

with:

```ts
    this.resolvedTurns.push({
      turnId: this.activeTurn.turnId,
      result,
      resultImageUrl: this.activeTurn.resultImageUrl,
    });
```

In `adminResetCampaign`, replace the two reset lines:

```ts
    this.lastResult = null;
    this.lastResultImageUrl = undefined;
```

with:

```ts
    this.resolvedTurns = [];
```

- [ ] **Step 4: Build `turnHistory` in mock `getGame`**

In `getGame`, replace the `previousResult` block:

```ts
    const previousResult = this.lastResult
      ? {
          publicResult: this.lastResult.publicResult,
          privateResult: this.lastResult.houseResults[record.houseId],
          discoveries: this.lastResult.discoveries,
          resultImageUrl: this.lastResultImageUrl,
        }
      : null;
```

with:

```ts
    const turnHistory = this.resolvedTurns
      .slice()
      .sort((a, b) => a.turnId - b.turnId)
      .map((entry) => ({
        turnId: entry.turnId,
        publicResult: entry.result.publicResult,
        privateResult: entry.result.houseResults[record.houseId],
        discoveries: entry.result.discoveries,
        resultImageUrl: entry.resultImageUrl,
      }));
```

And in the returned object, replace `previousResult,` with `turnHistory,`.

- [ ] **Step 5: Run the mock test suite**

Run: `cd frontend && npx vitest run src/api/mockClient.test.ts`
Expected: PASS

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: only remaining error is in `src/pages/GamePage.tsx` (fixed in Task 4). `mockClient.ts` must be clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/mockClient.ts frontend/src/api/mockClient.test.ts
git commit -m "feat: build turnHistory in mock getGame"
```

---

### Task 4: Turn history tabs on `GamePage`

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx`
- Test: `frontend/src/pages/GamePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that drives the mock through two resolved turns and asserts tabs render with the most recent selected by default, and that switching tabs changes content. Add to `frontend/src/pages/GamePage.test.tsx`. Reuse the file's existing `houseInput` constant. Admin code is `"admin-test"`; the starter turn (turnId 1) is already OPEN, so turn 1 is resolved with just lock+apply, while turn 2 needs compose→open→lock→apply:

```ts
it("shows past turns as tabs with the most recent selected by default", async () => {
  const client = new MockApiClient();
  const account = await client.createAccountAndHouse(houseInput);
  const { adminToken } = await client.adminLogin("admin-test");

  // Turn 1 (starter turn is already OPEN)
  await client.adminLockTurn(adminToken);
  await client.adminApplyResolution(adminToken, {
    publicResult: "Resultado público do turno 1",
    houseResults: { [account.houseId]: "Privado do turno 1" },
    attributeDeltas: {},
    discoveries: [],
  });

  // Turn 2
  await client.adminComposeTurn(adminToken, { publicEvent: "Evento 2", privateInfo: {} });
  await client.adminOpenTurn(adminToken);
  await client.adminLockTurn(adminToken);
  await client.adminApplyResolution(adminToken, {
    publicResult: "Resultado público do turno 2",
    houseResults: { [account.houseId]: "Privado do turno 2" },
    attributeDeltas: {},
    discoveries: [],
  });

  savePlayerSession({
    playerToken: account.playerToken,
    houseId: account.houseId,
    displayName: account.displayName,
  });
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GamePage />
        </MemoryRouter>
      </ApiProvider>,
    );
  });

  expect(await screen.findByRole("tab", { name: /Turno 1/ })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Turno 2/ })).toBeInTheDocument();
  // most recent selected by default
  expect(screen.getByText(/Resultado público do turno 2/)).toBeInTheDocument();

  // switch to turn 1
  await userEvent.click(screen.getByRole("tab", { name: /Turno 1/ }));
  expect(screen.getByText(/Resultado público do turno 1/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: FAIL — no `Turno 1` tab (the old `previousResult` card is gone / not yet replaced).

- [ ] **Step 3: Add MUI Tabs imports**

At the top of `frontend/src/pages/GamePage.tsx`, add:

```ts
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
```

- [ ] **Step 4: Add selected-tab state synced to history length**

Inside the `GamePage` component, alongside the other `useState` hooks, add:

```ts
  const [historyTab, setHistoryTab] = useState(0);
```

After `game` is loaded, keep the selected tab pointing at the most recent turn. Add this effect below the existing `useEffect`:

```ts
  useEffect(() => {
    if (game && game.turnHistory.length > 0) {
      setHistoryTab(game.turnHistory.length - 1);
    }
  }, [game?.turnHistory.length]);
```

- [ ] **Step 5: Replace the `previousResult` card with a tabbed history card**

Replace the whole `{game.previousResult && ( ... )}` block with:

```tsx
        {game.turnHistory.length > 0 && (
          <Card component="section">
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Histórico de turnos
              </Typography>
              <Tabs
                value={Math.min(historyTab, game.turnHistory.length - 1)}
                onChange={(_event, value) => setHistoryTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2 }}
              >
                {game.turnHistory.map((entry) => (
                  <Tab key={entry.turnId} label={`Turno ${entry.turnId}`} />
                ))}
              </Tabs>
              {(() => {
                const entry = game.turnHistory[Math.min(historyTab, game.turnHistory.length - 1)];
                return (
                  <Box>
                    {entry.publicResult && (
                      <Box sx={{ mb: 1 }}>
                        <WikiMarkdown body={entry.publicResult} />
                      </Box>
                    )}
                    {entry.privateResult && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="h3" gutterBottom>
                          Informação Privada
                        </Typography>
                        <Box sx={{ color: "text.secondary" }}>
                          <WikiMarkdown body={entry.privateResult} />
                        </Box>
                      </Box>
                    )}
                    {entry.resultImageUrl && (
                      <Box
                        component="img"
                        src={entry.resultImageUrl}
                        alt={`Ilustração do resultado do turno ${entry.turnId}`}
                        sx={{ width: "100%", borderRadius: 1, my: 1, display: "block" }}
                      />
                    )}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 6: Run the GamePage test suite**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: PASS

- [ ] **Step 7: Full frontend checks**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx
git commit -m "feat: show resolved turn history tabs on game page"
```

---

## Final Verification

- [ ] Run backend suite: `cd backend && npx vitest run` — Expected: PASS
- [ ] Run frontend suite: `cd frontend && npx vitest run` — Expected: PASS
- [ ] Build both: `cd backend && npm run build` and `cd frontend && npm run build` — Expected: success
- [ ] Manual smoke (mock): tabs Turno 1..N render, most recent selected, switching tabs changes content, no history card before any turn resolves.
