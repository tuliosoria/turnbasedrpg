# Game Narrative Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render player-facing narrative text on `/game` with Markdown formatting and guide new AI-generated turn text to use readable Markdown.

**Architecture:** Reuse the existing `WikiMarkdown` component for narrative display in `GamePage`. Keep the existing JSON contracts unchanged and add prompt guidance so generated strings contain clean Markdown paragraphs, bold, and italics.

**Tech Stack:** React 18, MUI, `react-markdown`, Vitest, Testing Library, TypeScript.

---

## File Structure

- Modify `frontend/src/pages/GamePage.tsx`: replace plain `Typography` rendering for narrative fields with `WikiMarkdown`.
- Modify `frontend/src/pages/GamePage.test.tsx`: add tests proving Markdown is rendered in current public event, current private information, previous public result, and previous private result.
- Modify `backend/src/ai/prompts.ts`: add a shared Markdown style instruction and include it in public-event, private-info, and resolution prompts.
- Modify `backend/src/ai/prompts.test.ts`: verify prompt strings request readable Markdown while preserving strict JSON output.

---

### Task 1: Render Game Narrative Markdown

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx`
- Modify: `frontend/src/pages/GamePage.test.tsx`

- [ ] **Step 1: Write failing Markdown rendering test**

In `frontend/src/pages/GamePage.test.tsx`, add this test inside `describe("GamePage", () => { ... })`:

```tsx
it("renders current and previous narrative Markdown in the player view", async () => {
  const client = new MockApiClient();
  const account = await client.createAccountAndHouse(houseInput);
  await client.adminComposeTurn("mock-admin-token", {
    publicEvent: "**Asterhall** treme sob *sinos distantes*.\n\nAs estradas se fecham.",
    privateInfo: {
      [account.houseId]: "Sua Casa ouve **um segredo** nas *catacumbas*.",
    },
  });
  await client.adminLockTurn("mock-admin-token");
  await client.adminApplyResolution("mock-admin-token", {
    publicResult: "**O portão norte** resistiu.\n\n*Mas a neve ficou negra.*",
    houseResults: {
      [account.houseId]: "Você sabe que **o herdeiro** viu *uma sombra*.",
    },
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

  expect((await screen.findByText("O portão norte")).tagName.toLowerCase()).toBe("strong");
  expect(screen.getByText("Mas a neve ficou negra.").tagName.toLowerCase()).toBe("em");
  expect(screen.getByText("o herdeiro").tagName.toLowerCase()).toBe("strong");
  expect(screen.getByText("uma sombra").tagName.toLowerCase()).toBe("em");
  expect(screen.getByText("Asterhall").tagName.toLowerCase()).toBe("strong");
  expect(screen.getByText("sinos distantes").tagName.toLowerCase()).toBe("em");
  expect(screen.getByText("um segredo").tagName.toLowerCase()).toBe("strong");
  expect(screen.getByText("catacumbas").tagName.toLowerCase()).toBe("em");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace frontend -- src/pages/GamePage.test.tsx
```

Expected: FAIL because the page renders raw Markdown markers inside `Typography`.

- [ ] **Step 3: Render narrative fields with `WikiMarkdown`**

In `frontend/src/pages/GamePage.tsx`, add the import:

```tsx
import { WikiMarkdown } from "../components/WikiMarkdown";
```

Replace:

```tsx
{game.previousResult.publicResult && <Typography sx={{ mb: 1 }}>{game.previousResult.publicResult}</Typography>}
```

with:

```tsx
{game.previousResult.publicResult && (
  <Box sx={{ mb: 1 }}>
    <WikiMarkdown body={game.previousResult.publicResult} />
  </Box>
)}
```

Replace:

```tsx
<Typography sx={{ color: "text.secondary" }}>{game.previousResult.privateResult}</Typography>
```

with:

```tsx
<Box sx={{ color: "text.secondary" }}>
  <WikiMarkdown body={game.previousResult.privateResult} />
</Box>
```

Replace:

```tsx
<Typography>{game.publicEvent}</Typography>
```

with:

```tsx
<WikiMarkdown body={game.publicEvent} />
```

Replace:

```tsx
<Typography>{game.privateInformation}</Typography>
```

with:

```tsx
<WikiMarkdown body={game.privateInformation} />
```

- [ ] **Step 4: Run GamePage tests**

Run:

```bash
npm run test --workspace frontend -- src/pages/GamePage.test.tsx
```

Expected: all `GamePage` tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx
git commit -m "feat: render game narrative markdown"
```

---

### Task 2: Guide AI Turn Text Formatting

**Files:**
- Modify: `backend/src/ai/prompts.ts`
- Modify: `backend/src/ai/prompts.test.ts`

- [ ] **Step 1: Write failing prompt tests**

In `backend/src/ai/prompts.test.ts`, add these assertions to the existing `buildPublicEventPrompt` test named `"asks for a JSON public event, includes world context and house names"`:

```ts
expect(prompt.system).toContain("Markdown");
expect(prompt.system).toContain("**negrito**");
expect(prompt.system).toContain("*itálico*");
expect(prompt.system).toContain("sem cabeçalhos Markdown");
```

Add this new test after the existing `buildPublicEventPrompt` describe block and before any unrelated describe block:

```ts
describe("turn narrative Markdown formatting prompts", () => {
  it("asks private info and resolution outputs to use readable Markdown inside JSON strings", () => {
    const privatePrompt = buildPrivateInfoPrompt(houses, "A neve fecha os portões.");
    const resolutionPrompt = buildResolutionPrompt(
      {
        turnId: 2,
        status: "LOCKED",
        publicEvent: "A neve fecha os portões.",
        privateInfo: {},
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      houses,
      [],
    );

    expect(privatePrompt.system).toContain("Markdown");
    expect(privatePrompt.system).toContain("**negrito**");
    expect(privatePrompt.system).toContain("*itálico*");
    expect(privatePrompt.system).toContain("sem cabeçalhos Markdown");
    expect(privatePrompt.system).toContain("JSON");
    expect(resolutionPrompt.system).toContain("Markdown");
    expect(resolutionPrompt.system).toContain("**negrito**");
    expect(resolutionPrompt.system).toContain("*itálico*");
    expect(resolutionPrompt.system).toContain("sem cabeçalhos Markdown");
    expect(resolutionPrompt.system).toContain("JSON");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: FAIL because prompt text does not mention Markdown guidance.

- [ ] **Step 3: Add shared Markdown instruction**

In `backend/src/ai/prompts.ts`, add this constant after `PREMISE`:

```ts
const PLAYER_NARRATIVE_MARKDOWN_FORMAT =
  " Formate textos narrativos exibidos ao jogador em Markdown limpo: use 2 ou 3 parágrafos curtos quando ajudar a leitura, use **negrito** para nomes, ameaças, locais e consequências importantes, use *itálico* para clima, rumores, presságios e sussurros, e escreva sem cabeçalhos Markdown ou excesso de símbolos.";
```

Update `buildPublicEventPrompt` by inserting the instruction before the strict JSON sentence. Replace the final sentence fragment:

```ts
" Crie o EVENTO PÚBLICO do próximo turno: um acontecimento marcante que afeta todo o reino de Valdren e provoca decisões das Casas. Escreva 2 a 4 frases, com tom sombrio e cinematográfico, coerente com o mundo e a continuidade dos turnos anteriores. Não decida as ações das Casas nem os resultados. Não exponha diretamente informações privadas, ordens privadas, consequências privadas ou segredos ainda não revelados. Responda ESTRITAMENTE em JSON no formato: {\"publicEvent\": string}.";
```

with:

```ts
" Crie o EVENTO PÚBLICO do próximo turno: um acontecimento marcante que afeta todo o reino de Valdren e provoca decisões das Casas. Escreva 2 a 4 frases, com tom sombrio e cinematográfico, coerente com o mundo e a continuidade dos turnos anteriores. Não decida as ações das Casas nem os resultados. Não exponha diretamente informações privadas, ordens privadas, consequências privadas ou segredos ainda não revelados." +
PLAYER_NARRATIVE_MARKDOWN_FORMAT +
" Responda ESTRITAMENTE em JSON no formato: {\"publicEvent\": string}.";
```

Update `buildPrivateInfoPrompt` from:

```ts
const system = withContext(PREMISE, ctx) + " Gere uma informação privada curta (2-4 frases) para CADA Casa, coerente com seus atributos e com o evento público. Responda ESTRITAMENTE em JSON: um objeto onde cada chave é o id da Casa e o valor é o texto da informação privada.";
```

to:

```ts
const system = withContext(PREMISE, ctx) + " Gere uma informação privada curta (2-4 frases) para CADA Casa, coerente com seus atributos e com o evento público." + PLAYER_NARRATIVE_MARKDOWN_FORMAT + " Responda ESTRITAMENTE em JSON: um objeto onde cada chave é o id da Casa e o valor é o texto da informação privada.";
```

Update `buildResolutionPrompt` from:

```ts
const system = withContext(PREMISE, ctx) + ` Resolva o turno com base nas ordens escritas pelos jogadores. Lembre-se: os atributos limitam o que é plausível. Responda ESTRITAMENTE em JSON com o formato: {"publicResult": string, "houseResults": { [houseId]: string }, "attributeDeltas": { [houseId]: { riqueza?: number, recursos?: number, soldados?: number, controle?: number } }, "discoveries": string[] }. As variações de atributo (deltas) devem ser pequenas inteiras (entre -2 e +1) e justificadas pela narrativa.`;
```

to:

```ts
const system = withContext(PREMISE, ctx) + ` Resolva o turno com base nas ordens escritas pelos jogadores. Lembre-se: os atributos limitam o que é plausível.${PLAYER_NARRATIVE_MARKDOWN_FORMAT} Responda ESTRITAMENTE em JSON com o formato: {"publicResult": string, "houseResults": { [houseId]: string }, "attributeDeltas": { [houseId]: { riqueza?: number, recursos?: number, soldados?: number, controle?: number } }, "discoveries": string[] }. As variações de atributo (deltas) devem ser pequenas inteiras (entre -2 e +1) e justificadas pela narrativa.`;
```

- [ ] **Step 4: Run prompt tests**

Run:

```bash
npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: all selected prompt tests pass.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add backend/src/ai/prompts.ts backend/src/ai/prompts.test.ts
git commit -m "feat: guide game narrative markdown"
```

---

### Task 3: Verify, Merge, Push, Deploy

**Files:**
- Modify only if verification reveals integration issues.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm run test --workspace frontend -- src/pages/GamePage.test.tsx && npm run test --workspace backend -- src/ai/prompts.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: shared/frontend production build succeeds.

- [ ] **Step 3: Commit plan**

Run:

```bash
git add docs/superpowers/plans/2026-07-31-game-narrative-markdown.md
git commit -m "docs: plan game narrative markdown"
```

If the plan is already committed before implementation, skip this step.

- [ ] **Step 4: Merge to main and push**

Run from `/Users/jessicarosa/turnbasedrpg`:

```bash
git merge --ff-only feature/game-markdown-formatting
git push origin main
```

Expected: push succeeds; deployment starts from main.

---

## Self-Review

- Spec coverage: Task 1 covers all four player-facing narrative fields. Task 2 covers AI prompt guidance for public events, private info, and resolution strings. Task 3 covers verification and push/deploy trigger.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. Code snippets include exact target strings and commands.
- Type consistency: `WikiMarkdown` takes `{ body: string }`; all updated fields are strings from `PlayerGameView`; prompt functions keep existing return shapes.

