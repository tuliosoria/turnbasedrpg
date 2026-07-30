# Valdren Census Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated public `Censo` Wiki section containing the canonical Valdren population and demography document.

**Architecture:** Add one fixed Wiki section and one generated default Wiki entry sourced from `/Users/jessicarosa/Downloads/POPULACAO_E_DEMOGRAFIA_DE_VALDREN_CANONICA.md`. Regenerate `shared/src/defaultWiki.ts`, then use the existing safe `replace-wiki` script to update live DynamoDB.

**Tech Stack:** TypeScript shared content package, Node.js generation script, Vitest, React Wiki route, DynamoDB replacement script.

---

## File Structure

- Modify `shared/src/wiki.ts`
  - Add fixed section `{ id: "censo", label: "Censo" }` after `visao-geral`.
- Modify `scripts/generate-valdren-wiki.mjs`
  - Read the canonical census Markdown file.
  - Normalize the source title to the public entry title `Censo Canônico de Valdren`.
  - Append a `censo` entry before ordering.
- Regenerate `shared/src/defaultWiki.ts`
  - Include one entry in section `censo`.
- Modify `backend/src/db/wiki.test.ts`
  - Assert section and default content.
- Modify `frontend/src/pages/WikiPage.test.tsx`
  - Assert `/valdren/censo` route renders census content.
- Modify `backend/scripts/replace-wiki.mjs` and `backend/scripts/replace-wiki.test.mjs`
  - Strengthen default validation so live replacement refuses stale defaults missing the Census entry.

---

### Task 1: Add Census Section and Generated Default Entry

**Files:**
- Modify: `shared/src/wiki.ts`
- Modify: `scripts/generate-valdren-wiki.mjs`
- Modify: `shared/src/defaultWiki.ts`
- Modify: `backend/src/db/wiki.test.ts`
- Modify: `frontend/src/pages/WikiPage.test.tsx`

- [ ] **Step 1: Write failing backend content tests**

Modify `backend/src/db/wiki.test.ts`.

In the test `supports encyclopedia sections and preserves entry images`, add:

```ts
    expect(WIKI_SECTION_IDS).toContain("censo");
```

In the test `ships the canonical public Valdren encyclopedia`, add these assertions after the existing title checks:

```ts
    expect(titles).toContain("Censo Canônico de Valdren");
    const census = DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Censo Canônico de Valdren");
    expect(census).toMatchObject({ section: "censo", order: 0 });
    expect(census?.body).toContain("aproximadamente **2.000.000 de habitantes**");
    expect(census?.body).toContain("| Casa Valerius | 395.000 | 19,75% | Asterhall |");
    expect(census?.body).toContain("Valdren consegue manter aproximadamente **28.000 a 35.000 soldados");
```

Also update the section set assertion list from:

```ts
    for (const section of ["visao-geral", "geografia", "governo", "tributos", "casas", "crise-atual"]) {
```

to:

```ts
    for (const section of ["visao-geral", "censo", "geografia", "governo", "tributos", "casas", "crise-atual"]) {
```

- [ ] **Step 2: Write failing frontend route test**

Add this test to `frontend/src/pages/WikiPage.test.tsx` inside `describe("WikiPage", ...)`:

```tsx
  it("renders the Censo section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "censo",
      title: "Censo Canônico de Valdren",
      body: "Valdren possui aproximadamente **2.000.000 de habitantes**.",
      order: 0,
    });

    await setup(client, "/valdren/censo");

    expect(await screen.findByRole("heading", { name: "Censo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Censo Canônico de Valdren" })).toBeInTheDocument();
    expect(screen.getByText("2.000.000 de habitantes").tagName.toLowerCase()).toBe("strong");
  });
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace backend -- src/db/wiki.test.ts
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected:

- Backend fails because `censo` section and default entry do not exist.
- Frontend fails because `/valdren/censo` redirects to the first known section.

- [ ] **Step 4: Add `censo` section**

Modify `shared/src/wiki.ts`.

Change:

```ts
  { id: "visao-geral", label: "Visão Geral" },
  { id: "geografia", label: "Geografia e Atlas" },
```

to:

```ts
  { id: "visao-geral", label: "Visão Geral" },
  { id: "censo", label: "Censo" },
  { id: "geografia", label: "Geografia e Atlas" },
```

- [ ] **Step 5: Add census source parsing to generator**

Modify `scripts/generate-valdren-wiki.mjs`.

Add this constant below `atlasPath`:

```js
const censusPath = "/Users/jessicarosa/Downloads/POPULACAO_E_DEMOGRAFIA_DE_VALDREN_CANONICA.md";
```

Add this helper after `extractTopLevelEntry`:

```js
function parseCensusEntry(text) {
  const body = stripFrontMatter(text)
    .replace(/^#\s+População e Demografia de Valdren\s*/i, "")
    .trim();
  return {
    section: "censo",
    title: "Censo Canônico de Valdren",
    body,
  };
}
```

Add this constant after `atlasEntries`:

```js
const censusEntry = parseCensusEntry(readFileSync(censusPath, "utf8"));
```

Add `censusEntry` to the generated entry list immediately after `Atlas de Valdren`:

```js
  censusEntry,
```

- [ ] **Step 6: Regenerate defaults**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
node scripts/generate-valdren-wiki.mjs
npm run build:shared
```

Expected:

- Generator prints `Generated 104 public wiki entries.`.
- `shared/src/defaultWiki.ts` contains `Censo Canônico de Valdren`.
- Shared package builds.

- [ ] **Step 7: Run tests to verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace backend -- src/db/wiki.test.ts
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected:

- Backend Wiki tests pass.
- Frontend WikiPage tests pass.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git add shared/src/wiki.ts scripts/generate-valdren-wiki.mjs shared/src/defaultWiki.ts backend/src/db/wiki.test.ts frontend/src/pages/WikiPage.test.tsx
git commit -m "feat: add Valdren census wiki section" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Harden Live Wiki Replacement Validation for Census

**Files:**
- Modify: `backend/scripts/replace-wiki.mjs`
- Modify: `backend/scripts/replace-wiki.test.mjs`

- [ ] **Step 1: Write failing replacement validation test**

Modify `backend/scripts/replace-wiki.test.mjs`.

In `validCanonicalEntries()`, add this entry to the overrides array:

```js
      { section: "censo", title: "Censo Canônico de Valdren", body: "População **2.000.000**.", order: 0 },
```

Add this test:

```js
  it("rejects canonical defaults missing the Valdren census entry", () => {
    const entries = validCanonicalEntries().filter((entry) => entry.title !== "Censo Canônico de Valdren");
    expect(() => validateDefaultWikiEntries(entries)).toThrow(/Censo Canônico de Valdren/);
  });
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected:

- FAIL because validation does not yet require the Census entry.

- [ ] **Step 3: Add validation check**

Modify `backend/scripts/replace-wiki.mjs`.

After the existing `A ameaça do Norte` validation block, add:

```js
  if (!entries.some((entry) => entry.title === "Censo Canônico de Valdren" && entry.section === "censo")) {
    throw new Error("Expected canonical defaults to include Censo Canônico de Valdren.");
  }
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected:

- PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git add backend/scripts/replace-wiki.mjs backend/scripts/replace-wiki.test.mjs
git commit -m "test: require census in wiki replacement" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Verify, Publish, Replace Live Wiki, and Deploy Frontend

**Files:**
- No source files should be edited in this task.

- [ ] **Step 1: Run full tests**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm test
```

Expected:

- Shared typecheck passes.
- Backend tests pass.
- Frontend tests pass.

- [ ] **Step 2: Build frontend**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build
```

Expected:

- `@ravenloft/content` builds.
- Frontend TypeScript and Vite build pass.

- [ ] **Step 3: Push main**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git push origin main
```

Expected:

- `main` is pushed to `https://github.com/tuliosoria/turnbasedrpg.git`.

- [ ] **Step 4: Replace live Wiki**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
CONFIRM_REPLACE_WIKI=yes npm run replace-wiki --workspace backend
```

Expected:

- Script builds shared first.
- Script prints deleted/inserted counts.
- Inserted count is `104`.

- [ ] **Step 5: Deploy frontend manually to Amplify**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
rm -f frontend/dist.zip
cd frontend/dist
zip -qr ../dist.zip .
cd ../..
DEPLOY_JSON=$(aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --region us-east-1)
echo "$DEPLOY_JSON" > /tmp/turnbasedrpg-amplify-deploy.json
UPLOAD_URL=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.zipUploadUrl)')
JOB_ID=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.jobId)')
curl -sS -X PUT -H 'Content-Type: application/zip' --data-binary @frontend/dist.zip "$UPLOAD_URL" >/dev/null
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1
echo "JOB_ID=$JOB_ID"
```

Expected:

- Amplify starts a deployment job.

- [ ] **Step 6: Wait for Amplify deployment**

Run:

```bash
JOB_ID=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.jobId)')
for i in {1..60}; do
  STATUS=$(aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1 --query 'job.summary.status' --output text)
  echo "status=$STATUS"
  if [ "$STATUS" = "SUCCEED" ]; then exit 0; fi
  if [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then exit 1; fi
  sleep 5
done
exit 1
```

Expected:

- Prints `status=SUCCEED`.

- [ ] **Step 7: Smoke test live Census API and route**

Run:

```bash
curl -fsS https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/wiki | node -e 'let d=""; process.stdin.on("data", c=>d+=c); process.stdin.on("end",()=>{const j=JSON.parse(d); const entries=j.entries||j; const census=entries.find(e=>e.title==="Censo Canônico de Valdren"); console.log(JSON.stringify({count:entries.length, section:census?.section, hasPopulation:/2\\.000\\.000/.test(census?.body||""), hasMilitary:/28\\.000 a 35\\.000/.test(census?.body||"")})); process.exit(entries.length===104 && census?.section==="censo" && /2\\.000\\.000/.test(census.body) && /28\\.000 a 35\\.000/.test(census.body) ? 0 : 1);})'
HTML=$(curl -fsS https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/censo)
JS=$(printf '%s' "$HTML" | sed -n 's/.*src="\([^"]*index-[^"]*\.js\)".*/\1/p' | head -1)
echo "$JS"
curl -fsS "https://main.d1emmrcvmpw55g.amplifyapp.com$JS" | grep 'Censo' >/dev/null
```

Expected:

- API reports count `104`, section `censo`, and key census values.
- Live frontend route serves the new bundle containing the `Censo` section label.

- [ ] **Step 8: Clean temporary files**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
rm -f frontend/dist.zip /tmp/turnbasedrpg-amplify-deploy.json
git status --short
```

Expected:

- Only pre-existing untracked `backups/` may remain.

---

## Self-Review

- Spec coverage:
  - New section `censo`: Task 1.
  - Canonical source file: Task 1 generator.
  - One default entry with title `Censo Canônico de Valdren`: Task 1.
  - Live Wiki replacement: Task 3.
  - Replacement safety validation: Task 2.
  - Tests for section/default/API/route: Tasks 1-3.
- Placeholder scan:
  - No placeholder markers remain.
  - All commands use concrete paths and IDs.
- Type consistency:
  - Section id is consistently `censo`.
  - Public title is consistently `Censo Canônico de Valdren`.
