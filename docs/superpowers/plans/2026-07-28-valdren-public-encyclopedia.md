# Valdren Public Encyclopedia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public Valdren Wiki with a rich canonical encyclopedia, add the atlas map, and update the live DynamoDB Wiki.

**Architecture:** The canonical player-facing content lives in `shared/src/defaultWiki.ts` and is delivered through the existing Wiki API. `WikiEntry` gains an optional `imageUrl`, rendered by the public Wiki and preserved by the Admin Wiki manager. A one-off backend script replaces live `WIKI#` rows with the new defaults after verification.

**Tech Stack:** TypeScript monorepo, React + Material UI + Vitest, AWS SDK/DynamoDB, Amplify static hosting.

---

### Task 1: Extend Wiki metadata and image support

**Files:**
- Modify: `shared/src/wiki.ts`
- Modify: `shared/src/defaultWiki.ts`
- Modify: `backend/src/validation/schemas.ts`
- Modify: `backend/src/db/wiki.ts`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/WikiManager.tsx`
- Modify: `frontend/src/pages/WikiPage.tsx`
- Test: `backend/src/validation/schemas.test.ts`
- Test: `backend/src/db/wiki.test.ts`
- Test: `frontend/src/pages/WikiPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests for:

```ts
expect(WIKI_SECTION_IDS).toContain("geografia");
expect(WIKI_SECTION_IDS).toContain("governo");
expect(WIKI_SECTION_IDS).toContain("tributos");
```

In backend validation tests, assert `parseWikiCreateBody` accepts `{ imageUrl: "/valdren-map.png" }` and rejects `javascript:alert(1)`.

In DB tests, assert `toEntry`/`listWikiEntries` preserves `imageUrl`.

In `WikiPage.test.tsx`, render a `WikiEntry` with `imageUrl: "/valdren-map.png"` and assert an image with alt text based on the entry title appears before the body text.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test --workspace backend -- src/validation/schemas.test.ts src/db/wiki.test.ts
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected: tests fail because section IDs and `imageUrl` support do not exist yet.

- [ ] **Step 3: Implement minimal image and section support**

Update `shared/src/wiki.ts` to include the expanded public sections and `imageUrl?: string` on `WikiEntry`.

Update `DefaultWikiEntry` in `shared/src/defaultWiki.ts` to include `imageUrl?: string`.

Update `backend/src/validation/schemas.ts` so Wiki create/update bodies return `{ section, title, body, order, imageUrl }`, where `imageUrl` is optional, max 500 chars, and must be empty, start with `/`, or start with `https://`.

Update `backend/src/db/wiki.ts` so `toEntry` includes `imageUrl` when present.

Update `frontend/src/types/api.ts` `WikiEntryInput` to include optional `imageUrl`.

Update `WikiPage` to render:

```tsx
{entry.imageUrl && (
  <Box
    component="img"
    src={entry.imageUrl}
    alt={`Imagem de ${entry.title}`}
    sx={{ width: "100%", borderRadius: 1, mb: 2, display: "block" }}
  />
)}
```

Update `WikiManager` to include an optional `imageUrl` field in form state and save it.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build --workspace shared
npm run test --workspace backend -- src/validation/schemas.test.ts src/db/wiki.test.ts
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/src/wiki.ts shared/src/defaultWiki.ts backend/src/validation/schemas.ts backend/src/db/wiki.ts frontend/src/types/api.ts frontend/src/components/WikiManager.tsx frontend/src/pages/WikiPage.tsx backend/src/validation/schemas.test.ts backend/src/db/wiki.test.ts frontend/src/pages/WikiPage.test.tsx
git commit -m "feat: support images in public wiki entries"
```

Commit body:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Task 2: Generate canonical encyclopedia defaults and map asset

**Files:**
- Create: `scripts/generate-valdren-wiki.mjs`
- Replace: `shared/src/defaultWiki.ts`
- Create: `frontend/public/valdren-map.png`
- Test: `backend/src/db/wiki.test.ts`

- [ ] **Step 1: Write failing content tests**

Add a test in `backend/src/db/wiki.test.ts`:

```ts
it("ships the canonical public Valdren encyclopedia", () => {
  const titles = DEFAULT_WIKI_ENTRIES.map((entry) => entry.title);
  expect(titles).toContain("Valdren, o reino-ilha");
  expect(titles).toContain("Atlas de Valdren");
  expect(titles).toContain("Asterhall — A Cidade da Coroa");
  expect(titles).toContain("Casa Khazdrun — A Montanha e a Maré");
  expect(titles).toContain("A ameaça do Norte");
  expect(DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Atlas de Valdren")?.imageUrl).toBe("/valdren-map.png");
  const fullText = DEFAULT_WIKI_ENTRIES.map((entry) => `${entry.title}\n${entry.body}`).join("\n");
  expect(fullText).not.toMatch(/Perfil de poder/i);
  expect(fullText).not.toMatch(/\|\\s*Riqueza\\s*\\|\\s*Recursos\\s*\\|\\s*Soldados\\s*\\|\\s*Controle\\s*\\|/i);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test --workspace backend -- src/db/wiki.test.ts
```

Expected: test fails because defaults have not yet been replaced with the canonical encyclopedia.

- [ ] **Step 3: Add generator and map asset**

Create `scripts/generate-valdren-wiki.mjs`. The script reads:

```js
const encyclopediaPath = "/Users/jessicarosa/Downloads/VALDREN_MEGA_ENCICLOPEDIA_PUBLICA_CANONICA_V2.md";
const atlasPath = "/Users/jessicarosa/Downloads/ATLAS_GEOGRAFICO_DE_VALDREN_CANONICO_V2.md";
```

It should:

1. Parse markdown `##` sections from both files.
2. Map headings to the expanded Wiki sections.
3. Skip headings named `Perfil de poder`, `Conflito central`, and `Facções internas`.
4. Remove markdown tables containing `Riqueza`, `Recursos`, `Soldados`, `Controle`.
5. Emit a TypeScript `DEFAULT_WIKI_ENTRIES` array.
6. Add an explicit first geografia entry titled `Atlas de Valdren` with `imageUrl: "/valdren-map.png"`.

Copy the map:

```bash
mkdir -p frontend/public
cp "/Users/jessicarosa/Downloads/ChatGPT Image Jul 28, 2026, 10_54_45 PM.png" frontend/public/valdren-map.png
```

- [ ] **Step 4: Generate defaults**

Run:

```bash
node scripts/generate-valdren-wiki.mjs
npm run build --workspace shared
```

Expected: `shared/src/defaultWiki.ts` contains many canonical entries and TypeScript builds.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run test --workspace backend -- src/db/wiki.test.ts
```

Expected: all Wiki DB/default tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-valdren-wiki.mjs shared/src/defaultWiki.ts frontend/public/valdren-map.png backend/src/db/wiki.test.ts
git commit -m "feat: replace public wiki with Valdren encyclopedia"
```

Commit body:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Task 3: Add live Wiki replacement script

**Files:**
- Create: `backend/scripts/replace-wiki.mjs`
- Modify: `backend/package.json`

- [ ] **Step 1: Write the script**

Create `backend/scripts/replace-wiki.mjs` that:

1. Imports `DEFAULT_WIKI_ENTRIES` from `../../shared/dist/index.js`.
2. Uses `DynamoDBDocumentClient`.
3. Queries all `PK = CAMPAIGN#WINTER_DEAD AND begins_with(SK, WIKI#)`.
4. Deletes existing Wiki rows in batches.
5. Inserts defaults with stable IDs like `${section}-${order}-${slug(title)}`.
6. Requires `CONFIRM_REPLACE_WIKI=yes` to run.

Add package script:

```json
"replace-wiki": "node scripts/replace-wiki.mjs"
```

- [ ] **Step 2: Dry run by refusing without confirmation**

Run:

```bash
npm run build:shared
npm run replace-wiki --workspace backend
```

Expected: command exits non-zero with a message saying to set `CONFIRM_REPLACE_WIKI=yes`.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/replace-wiki.mjs backend/package.json
git commit -m "chore: add live wiki replacement script"
```

Commit body:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Task 4: Full validation, deploy, and live data replacement

**Files:**
- No source edits unless validation reveals a defect.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: all shared, backend and frontend tests pass.

- [ ] **Step 2: Commit spec and plan if still uncommitted**

Run:

```bash
git add docs/superpowers/specs/2026-07-28-valdren-public-encyclopedia-design.md docs/superpowers/plans/2026-07-28-valdren-public-encyclopedia.md
git commit -m "docs: plan Valdren public encyclopedia expansion"
```

Commit body:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

- [ ] **Step 3: Push branch/merge to main following finishing workflow**

Use the finishing branch workflow, then push `main`.

- [ ] **Step 4: Deploy backend if backend code changed**

Run:

```bash
npm run deploy:backend
```

Expected: SAM stack `ravenloft-winter` updates successfully.

- [ ] **Step 5: Replace live Wiki data**

Run:

```bash
npm run build:shared
CONFIRM_REPLACE_WIKI=yes npm run replace-wiki --workspace backend
```

Expected: output reports deleted old Wiki entries and inserted `DEFAULT_WIKI_ENTRIES.length` new entries.

- [ ] **Step 6: Deploy frontend manually to Amplify**

Run:

```bash
npm run build
rm -f frontend/dist.zip
(cd frontend/dist && zip -qr ../dist.zip .)
DEPLOY=$(aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --region us-east-1)
JOB_ID=$(node -e "console.log(JSON.parse(process.argv[1]).jobId)" "$DEPLOY")
UPLOAD_URL=$(node -e "console.log(JSON.parse(process.argv[1]).zipUploadUrl)" "$DEPLOY")
curl -sS -H "Content-Type: application/zip" --upload-file frontend/dist.zip "$UPLOAD_URL" >/dev/null
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1
aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1 --query "job.summary.status" --output text
```

Poll until `SUCCEED`.

- [ ] **Step 7: Smoke check live Wiki**

Run:

```bash
curl -sS https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/wiki | grep -E "Atlas de Valdren|Casa Khazdrun|A ameaça do Norte"
curl -sS https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/geografia | grep -E "index-|Valdren"
```

Expected: API returns canonical entries and frontend serves the deployed build.

---

## Self-review

- Spec coverage: covers section expansion, map image support, mechanics filtering, defaults, live replacement, tests, backend/frontend deploy.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `imageUrl` is consistently optional on default, API input and Wiki entry.
