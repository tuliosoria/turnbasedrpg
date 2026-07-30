# Valdren Census, Wars, and Mages Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish publishing the canonical Census, then add first-class Wiki sections for `Guerras` and `Os Magos` as single canonical reading entries.

**Architecture:** The shared content package owns fixed Wiki sections and generated default entries. `scripts/generate-valdren-wiki.mjs` reads canonical local sources, renders `shared/src/defaultWiki.ts`, and the backend `replace-wiki` script safely replaces live DynamoDB Wiki records only when required canonical entries are present. The frontend Wiki page already renders section routes and Markdown bodies.

**Tech Stack:** TypeScript, React, Vitest, Node ESM scripts, `@ravenloft/content`, DynamoDB replacement script, Vite build, temporary/live deployment via existing project scripts.

---

## File Structure

- Modify `backend/scripts/replace-wiki.mjs`: centralize required canonical Wiki validation and require Censo, Guerras, and Os Magos before live replacement.
- Modify `backend/scripts/replace-wiki.test.mjs`: test that live replacement refuses incomplete canonical content.
- Modify `shared/src/wiki.ts`: add fixed `guerras` and `os-magos` sections after `censo`.
- Modify `scripts/generate-valdren-wiki.mjs`: read the wars PDF and mages Markdown source, clean content, append generated entries.
- Modify `shared/src/defaultWiki.ts`: regenerated output only; do not hand-edit.
- Modify `backend/src/db/wiki.test.ts`: assert generated entries and canonical snippets.
- Modify `frontend/src/pages/WikiPage.test.tsx`: assert `/valdren/guerras` and `/valdren/os-magos` render correctly.
- Modify `package.json` and `package-lock.json`: add `pdf-parse` as a root dev dependency so the generator can read `/Users/jessicarosa/Downloads/As Guerras de Valdren.pdf` directly.
- Create no new runtime UI components. The existing `WikiMarkdown` renderer is sufficient.

---

### Task 1: Finish Census Replacement Safety

**Files:**
- Modify: `backend/scripts/replace-wiki.mjs`
- Modify: `backend/scripts/replace-wiki.test.mjs`

- [ ] **Step 1: Write failing test for the required Census entry**

In `backend/scripts/replace-wiki.test.mjs`, update `validCanonicalEntries()` so it includes the Census entry:

```js
function validCanonicalEntries() {
  return canonicalSizedEntries([
    { section: "geografia", title: "Atlas de Valdren", body: "Mapa.", order: 0, imageUrls: ["/valdren-map.png"] },
    { section: "casas", title: "Casa Khazdrun — A Montanha e a Maré", body: "Montanha e maré.", order: 0 },
    { section: "crise-atual", title: "A ameaça do Norte", body: "Os mortos avançam.", order: 0 },
    { section: "censo", title: "Censo Canônico de Valdren", body: "2.000.000 habitantes.", order: 0 },
  ]);
}
```

Then add this test after `rejects stale default wiki content before destructive writes`:

```js
it("requires the canonical Census entry before destructive writes", () => {
  const entries = validCanonicalEntries().filter((entry) => entry.title !== "Censo Canônico de Valdren");

  expect(() => validateDefaultWikiEntries(entries)).toThrow(/Censo Canônico de Valdren/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected: FAIL because `validateDefaultWikiEntries` does not yet require `Censo Canônico de Valdren`.

- [ ] **Step 3: Implement required title validation**

In `backend/scripts/replace-wiki.mjs`, add this constant after `PK`:

```js
const REQUIRED_CANONICAL_TITLES = [
  "Atlas de Valdren",
  "Casa Khazdrun — A Montanha e a Maré",
  "A ameaça do Norte",
  "Censo Canônico de Valdren",
];
```

Replace the repeated title checks in `validateDefaultWikiEntries` with:

```js
  for (const title of REQUIRED_CANONICAL_TITLES) {
    if (!entries.some((entry) => entry.title === title)) {
      throw new Error(`Expected canonical defaults to include ${title}.`);
    }
  }
```

Keep the existing entry count check and the existing Atlas image validation.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/scripts/replace-wiki.mjs backend/scripts/replace-wiki.test.mjs
git commit -m "test: require census in wiki replacement"
```

---

### Task 2: Add Guerras and Os Magos to Generated Defaults

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `shared/src/wiki.ts`
- Modify: `scripts/generate-valdren-wiki.mjs`
- Modify: `shared/src/defaultWiki.ts`
- Modify: `backend/src/db/wiki.test.ts`

- [ ] **Step 1: Add failing backend assertions**

In `backend/src/db/wiki.test.ts`, extend `supports encyclopedia sections and preserves entry images`:

```ts
    expect(WIKI_SECTION_IDS).toContain("guerras");
    expect(WIKI_SECTION_IDS).toContain("os-magos");
```

In `ships the canonical public Valdren encyclopedia`, add these assertions after the Census assertions:

```ts
    expect(titles).toContain("As Guerras de Valdren");
    expect(titles).toContain("Os Vinte e Sete Magos da Ordem dos Três");

    const wars = DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "As Guerras de Valdren");
    expect(wars).toMatchObject({ section: "guerras", order: 0 });
    expect(wars?.body).toContain("A Guerra das Cinco Bandeiras");
    expect(wars?.body).toContain("O Inverno das Cinzas");
    expect(wars?.body).toContain("A Guerra dos Céus de Bronze");
    expect(wars?.body).toContain("A Guerra do Primeiro Refúgio");

    const mages = DEFAULT_WIKI_ENTRIES.find((entry) => entry.title === "Os Vinte e Sete Magos da Ordem dos Três");
    expect(mages).toMatchObject({ section: "os-magos", order: 0 });
    expect(mages?.body).toContain("vinte e sete magos plenamente iniciados");
    expect(mages?.body).toContain("Maelor Véspera");
    expect(mages?.body).toContain("Luz Primeira");
```

Extend the required section loop to include the new sections:

```ts
    for (const section of ["visao-geral", "censo", "guerras", "os-magos", "geografia", "governo", "tributos", "casas", "crise-atual"]) {
      expect(sections.has(section)).toBe(true);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace backend -- src/db/wiki.test.ts
```

Expected: FAIL because `guerras`, `os-magos`, and their default entries do not exist yet.

- [ ] **Step 3: Add PDF parser dependency**

Run:

```bash
npm install --save-dev pdf-parse@1.1.1
```

Expected: `package.json` root `devDependencies` includes `pdf-parse`, and `package-lock.json` updates.

- [ ] **Step 4: Add fixed Wiki sections**

In `shared/src/wiki.ts`, insert the two new sections immediately after `censo`:

```ts
  { id: "visao-geral", label: "Visão Geral" },
  { id: "censo", label: "Censo" },
  { id: "guerras", label: "Guerras" },
  { id: "os-magos", label: "Os Magos" },
  { id: "geografia", label: "Geografia e Atlas" },
```

- [ ] **Step 5: Update generator imports and source paths**

In `scripts/generate-valdren-wiki.mjs`, change the imports to:

```js
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
```

Add these source paths after `censusPath`:

```js
const warsPath = "/Users/jessicarosa/Downloads/As Guerras de Valdren.pdf";
const magesPath = "/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md";
```

- [ ] **Step 6: Add parser helpers for long-form canonical entries**

In `scripts/generate-valdren-wiki.mjs`, add these helpers after `parseCensusEntry`:

```js
const WARS_HEADING_LEVELS = new Map([
  ["Um reino construído sobre tratados", 2],
  ["Cronologia das grandes guerras", 2],
  ["A Guerra das Cinco Bandeiras", 3],
  ["O Inverno das Cinzas", 3],
  ["A Guerra dos Céus de Bronze", 3],
  ["A Guerra do Sal e do Ferro", 3],
  ["As Guerras das Estradas", 3],
  ["Povos errantes de Valdren", 4],
  ["Relação com Valdren", 4],
  ["A Guerra do Primeiro Refúgio", 3],
  ["Como essas guerras moldaram Valdren", 2],
  ["Guerra das Cinco Bandeiras", 3],
  ["Inverno das Cinzas", 3],
  ["Guerra dos Céus de Bronze", 3],
  ["Guerra do Sal e do Ferro", 3],
  ["Guerras das Estradas", 3],
  ["Guerra do Primeiro Refúgio", 3],
]);

function normalizePdfMarkdown(text, headingLevels) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+$/.test(line));
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(paragraph.join(" ").replace(/\s+/g, " ").trim());
    paragraph = [];
  }

  for (const line of lines) {
    if (line === "As Guerras de Valdren") continue;
    const headingLevel = headingLevels.get(line);
    if (headingLevel) {
      flushParagraph();
      blocks.push(`${"#".repeat(headingLevel)} ${line}`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  return blocks.join("\n\n").trim();
}

async function parseWarsEntry(buffer) {
  const parsed = await pdfParse(buffer);
  const body = normalizePdfMarkdown(parsed.text, WARS_HEADING_LEVELS);
  return {
    section: "guerras",
    title: "As Guerras de Valdren",
    body,
  };
}

function parseMagesEntry(text) {
  const body = stripFrontMatter(text)
    .replace(/^#\s+Os Vinte e Sete Magos da Ordem dos Três\s*/i, "")
    .replace(/^---\s*/m, "")
    .trim();
  return {
    section: "os-magos",
    title: "Os Vinte e Sete Magos da Ordem dos Três",
    body,
  };
}
```

- [ ] **Step 7: Make generation await the PDF parser**

Replace the bottom entry construction in `scripts/generate-valdren-wiki.mjs` with top-level awaited entries:

```js
const encyclopediaEntries = parseMarkdownEntries(readFileSync(encyclopediaPath, "utf8"));
const encyclopediaText = readFileSync(encyclopediaPath, "utf8");
const atlasEntries = parseAtlasEntries(readFileSync(atlasPath, "utf8"));
const censusEntry = parseCensusEntry(readFileSync(censusPath, "utf8"));
const warsEntry = await parseWarsEntry(readFileSync(warsPath));
const magesEntry = parseMagesEntry(readFileSync(magesPath, "utf8"));
const northernThreat = extractTopLevelEntry(
  encyclopediaText,
  /^#\s+11\.\s+A ameaça do Norte/i,
  /^#\s+12\./i,
  "crise-atual",
  "A ameaça do Norte",
);

const entries = attachHouseImages(withOrders(dedupe([
  {
    section: "geografia",
    title: "Atlas de Valdren",
    body: "Mapa público do reino-ilha de Valdren, reunindo as grandes regiões, rotas, cidades e fronteiras conhecidas pelas Casas.",
    imageUrl: "/valdren-map.png",
    imageUrls: ["/valdren-map.png"],
  },
  censusEntry,
  warsEntry,
  magesEntry,
  ...encyclopediaEntries,
  ...(northernThreat ? [northernThreat] : []),
  ...atlasEntries,
])));
```

- [ ] **Step 8: Regenerate default Wiki**

Run:

```bash
node scripts/generate-valdren-wiki.mjs
```

Expected: command prints a generated entry count greater than the current Census count. `shared/src/defaultWiki.ts` contains `As Guerras de Valdren` and `Os Vinte e Sete Magos da Ordem dos Três`.

- [ ] **Step 9: Run targeted backend test**

Run:

```bash
npm run test --workspace backend -- src/db/wiki.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add package.json package-lock.json shared/src/wiki.ts scripts/generate-valdren-wiki.mjs shared/src/defaultWiki.ts backend/src/db/wiki.test.ts frontend/public/valdren-map.png frontend/public/houses
git commit -m "feat: add Valdren wars and mages wiki sections"
```

---

### Task 3: Add Frontend Routes and Final Replacement Guards

**Files:**
- Modify: `frontend/src/pages/WikiPage.test.tsx`
- Modify: `backend/scripts/replace-wiki.mjs`
- Modify: `backend/scripts/replace-wiki.test.mjs`

- [ ] **Step 1: Add failing frontend route tests**

In `frontend/src/pages/WikiPage.test.tsx`, add these tests after `renders the Censo section route`:

```tsx
  it("renders the Guerras section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "guerras",
      title: "As Guerras de Valdren",
      body: "A Guerra das Cinco Bandeiras deixou tratados antigos.",
      order: 0,
    });

    await setup(client, "/valdren/guerras");

    expect(await screen.findByRole("heading", { name: "Guerras" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "As Guerras de Valdren" })).toBeInTheDocument();
    expect(screen.getByText(/Cinco Bandeiras/)).toBeInTheDocument();
  });

  it("renders the Os Magos section route", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "os-magos",
      title: "Os Vinte e Sete Magos da Ordem dos Três",
      body: "A Ordem mantém **vinte e sete magos** plenamente iniciados.",
      order: 0,
    });

    await setup(client, "/valdren/os-magos");

    expect(await screen.findByRole("heading", { name: "Os Magos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Os Vinte e Sete Magos da Ordem dos Três" })).toBeInTheDocument();
    expect(screen.getByText("vinte e sete magos").tagName.toLowerCase()).toBe("strong");
  });
```

- [ ] **Step 2: Run frontend tests**

Run:

```bash
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected: PASS if Task 2 section ids are present; FAIL if route labels are not wired by shared content.

- [ ] **Step 3: Extend replacement validation tests**

In `backend/scripts/replace-wiki.test.mjs`, update `validCanonicalEntries()` again:

```js
function validCanonicalEntries() {
  return canonicalSizedEntries([
    { section: "geografia", title: "Atlas de Valdren", body: "Mapa.", order: 0, imageUrls: ["/valdren-map.png"] },
    { section: "casas", title: "Casa Khazdrun — A Montanha e a Maré", body: "Montanha e maré.", order: 0 },
    { section: "crise-atual", title: "A ameaça do Norte", body: "Os mortos avançam.", order: 0 },
    { section: "censo", title: "Censo Canônico de Valdren", body: "2.000.000 habitantes.", order: 0 },
    { section: "guerras", title: "As Guerras de Valdren", body: "Cinco Bandeiras.", order: 0 },
    { section: "os-magos", title: "Os Vinte e Sete Magos da Ordem dos Três", body: "Luz Primeira.", order: 0 },
  ]);
}
```

Add this test after the Census validation test:

```js
it("requires the canonical Wars and Mages entries before destructive writes", () => {
  expect(() => validateDefaultWikiEntries(
    validCanonicalEntries().filter((entry) => entry.title !== "As Guerras de Valdren"),
  )).toThrow(/As Guerras de Valdren/);

  expect(() => validateDefaultWikiEntries(
    validCanonicalEntries().filter((entry) => entry.title !== "Os Vinte e Sete Magos da Ordem dos Três"),
  )).toThrow(/Os Vinte e Sete Magos da Ordem dos Três/);
});
```

- [ ] **Step 4: Run replacement test to verify it fails**

Run:

```bash
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected: FAIL because `REQUIRED_CANONICAL_TITLES` does not yet include Guerras and Os Magos.

- [ ] **Step 5: Implement final required title guards**

In `backend/scripts/replace-wiki.mjs`, extend `REQUIRED_CANONICAL_TITLES`:

```js
const REQUIRED_CANONICAL_TITLES = [
  "Atlas de Valdren",
  "Casa Khazdrun — A Montanha e a Maré",
  "A ameaça do Norte",
  "Censo Canônico de Valdren",
  "As Guerras de Valdren",
  "Os Vinte e Sete Magos da Ordem dos Três",
];
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
npm run test --workspace backend -- scripts/replace-wiki.test.mjs
```

Expected: both PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/pages/WikiPage.test.tsx backend/scripts/replace-wiki.mjs backend/scripts/replace-wiki.test.mjs
git commit -m "test: require wars and mages wiki publication"
```

---

### Task 4: Validate, Merge, Publish, and Smoke Test

**Files:**
- No source edits expected.
- Deployment artifacts must stay untracked and be removed before finishing.

- [ ] **Step 1: Run full validation**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 2: Commit the design and plan docs if still uncommitted**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-07-29-valdren-wars-and-mages-wiki-design.md docs/superpowers/plans/2026-07-29-valdren-census-wars-mages-wiki.md
git commit -m "docs: plan Valdren wars and mages wiki"
```

If the docs were already committed, skip this commit and record that `git status --short` had no matching uncommitted docs.

- [ ] **Step 3: Merge feature branch into main**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git status --short
git switch main
git merge --no-ff feature/valdren-census -m "merge: Valdren census wars and mages wiki"
```

Expected: merge succeeds. Do not overwrite unrelated uncommitted files; stop and ask if main has conflicting user changes.

- [ ] **Step 4: Push main**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Replace live Wiki data**

Run:

```bash
CONFIRM_REPLACE_WIKI=yes npm run replace-wiki --workspace backend
```

Expected: output includes `Inserted` with the new generated count. The count must be at least `106` because Census, Guerras, and Os Magos are all present.

- [ ] **Step 6: Deploy frontend with existing Amplify zip flow**

Run the same manual Amplify deployment flow used for the previous Wiki Markdown deployment. Use the existing Amplify app id `d1emmrcvmpw55g` and branch `main`. Create any zip artifact outside tracked source or remove it before finishing.

Expected: Amplify job succeeds for branch `main`.

- [ ] **Step 7: Smoke test API content**

Run:

```bash
curl -s https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/wiki \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const entries=JSON.parse(d); const titles=entries.map(e=>e.title); for (const title of ['Censo Canônico de Valdren','As Guerras de Valdren','Os Vinte e Sete Magos da Ordem dos Três']) { if (!titles.includes(title)) throw new Error('Missing '+title); } console.log(entries.length); });"
```

Expected: prints an entry count at least `106`.

- [ ] **Step 8: Smoke test public pages**

Run:

```bash
curl -s https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/censo | grep -E "Censo|root"
curl -s https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/guerras | grep -E "Guerras|root"
curl -s https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/os-magos | grep -E "Magos|root"
```

Expected: each route returns the app shell. If the shell does not contain route text because Vite renders client-side, fetch the current JS bundle and verify it contains `guerras` and `os-magos`.

- [ ] **Step 9: Cleanup worktree and local branch**

After merge and deploy are confirmed:

```bash
cd /Users/jessicarosa/turnbasedrpg
git worktree remove .worktrees/valdren-census
git branch -d feature/valdren-census
git status --short
```

Expected: worktree removed, local feature branch deleted, and no temporary deployment archives remain tracked or untracked except pre-existing `backups/`.

---

## Self-Review Notes

- Spec coverage: Censo safety, Guerras section, Os Magos section, generator inclusion, replacement guards, frontend routes, live replacement, and deployment are covered.
- Placeholder scan: no task uses TODO/TBD or unspecified tests.
- Type consistency: section ids are `censo`, `guerras`, and `os-magos`; titles match replacement guards and frontend/backend tests.
