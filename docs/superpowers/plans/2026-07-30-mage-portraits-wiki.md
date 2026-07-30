# Mage Portraits Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate reviewable OpenAI portraits for the twenty-seven mages of the Ordem dos Três, then publish approved portraits as individual `Os Magos` Wiki entries.

**Architecture:** Add a focused parser/prompt module for mage portrait metadata, a local batch script that uses the OpenAI image API and writes review artifacts outside tracked source, and a publication path that copies approved static PNGs into `frontend/public/mages` and includes one generated Wiki entry per mage. The existing Wiki image renderer and `replace-wiki` deployment flow will publish the images after approval.

**Tech Stack:** Node ESM scripts, Vitest, OpenAI `gpt-image-1`, TypeScript shared content, React Wiki renderer, static assets in `frontend/public/mages`, existing `replace-wiki` script and Amplify deployment.

---

## File Structure

- Create `scripts/mage-portraits.mjs`: pure helper module for extracting mage identities, slugging filenames, building prompts, rendering review manifests, and building Wiki portrait entries.
- Create `backend/scripts/mage-portraits.test.mjs`: Vitest coverage for extraction, slugs, prompt content, and Wiki entry generation.
- Create `scripts/generate-mage-portraits.mjs`: local batch generator that calls OpenAI, writes PNGs and manifest JSON under `tmp/mage-portraits-review`, and supports `--only <slug>`.
- Modify `scripts/generate-valdren-wiki.mjs`: import portrait helpers and append approved mage portrait entries when `frontend/public/mages/*.png` exists.
- Modify `backend/src/db/wiki.test.ts`: assert portrait entries and image URLs after approved images are added.
- Add generated assets under `frontend/public/mages/*.png` only after user approval.
- Do not commit `tmp/`, local review manifests, or rejected/reroll images.

---

### Task 1: Mage Parser and Prompt Helpers

**Files:**
- Create: `scripts/mage-portraits.mjs`
- Create: `backend/scripts/mage-portraits.test.mjs`

- [ ] **Step 1: Write failing parser and prompt tests**

Create `backend/scripts/mage-portraits.test.mjs`:

```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMagePortraitPrompt,
  buildMageWikiEntries,
  extractMagePortraits,
  mageSlug,
} from "../../scripts/mage-portraits.mjs";

const sourcePath = "/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md";
const source = readFileSync(sourcePath, "utf8");

describe("mage portrait helpers", () => {
  it("extracts exactly the twenty-seven initiated mages", () => {
    const mages = extractMagePortraits(source);

    expect(mages).toHaveLength(27);
    expect(mages.map((mage) => mage.name).slice(0, 8)).toEqual([
      "Maelor Véspera",
      "Maera Vhal",
      "Oren Caldris",
      "Solenne Arct",
      "Edran Folha-Pálida",
      "Cassia Mareth",
      "Nymor Sahr",
      "Vaelis Morcant",
    ]);
    expect(mages.map((mage) => mage.name).slice(-3)).toEqual([
      "Madre Isolde Venn",
      "Kael Brumante",
      "Nereza Último-Fio",
    ]);
    expect(mages.map((mage) => mage.name)).not.toContain("Serath");
    expect(mages.map((mage) => mage.name)).not.toContain("Ilyon");
    expect(mages.map((mage) => mage.name)).not.toContain("Veyra");
  });

  it("builds stable ASCII slugs for mage image filenames", () => {
    expect(mageSlug("Maelor Véspera")).toBe("maelor-vespera");
    expect(mageSlug("Edran Folha-Pálida")).toBe("edran-folha-palida");
    expect(mageSlug("Brakk Filho de Ninguém")).toBe("brakk-filho-de-ninguem");
    expect(mageSlug("Nereza Último-Fio")).toBe("nereza-ultimo-fio");
  });

  it("builds prompts with Valdren visual style and mage-specific lore", () => {
    const [maelor] = extractMagePortraits(source);
    const prompt = buildMagePortraitPrompt(maelor);

    expect(prompt).toContain("Dark Fantasy");
    expect(prompt).toContain("Ravenloft");
    expect(prompt).toContain("gótico medieval");
    expect(prompt).toContain("pintura digital cinematográfica");
    expect(prompt).toContain("Maelor Véspera");
    expect(prompt).toContain("O Trino");
    expect(prompt).toContain("Serath");
    expect(prompt).toContain("Ilyon");
    expect(prompt).toContain("Veyra");
    expect(prompt).toContain("Não invente biografia");
  });

  it("builds wiki entries with image URLs for approved mage portraits", () => {
    const mages = extractMagePortraits(source);
    const entries = buildMageWikiEntries(mages, (slug) => `/mages/${slug}.png`);

    expect(entries).toHaveLength(27);
    expect(entries[0]).toMatchObject({
      section: "os-magos",
      title: "Maelor Véspera",
      imageUrl: "/mages/maelor-vespera.png",
    });
    expect(entries[0].body).toContain("O Trino");
    expect(entries[26]).toMatchObject({
      section: "os-magos",
      title: "Nereza Último-Fio",
      imageUrl: "/mages/nereza-ultimo-fio.png",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test --workspace backend -- scripts/mage-portraits.test.mjs
```

Expected: FAIL because `scripts/mage-portraits.mjs` does not exist.

- [ ] **Step 3: Implement helper module**

Create `scripts/mage-portraits.mjs`:

```js
import { DEFAULT_IMAGE_DIRECTIVES } from "../shared/dist/index.js";

const MAGE_SOURCE_START = /^##\s+Maelor Véspera\s*$/;
const MAGE_SOURCE_END = /^##\s+Distribuição por Refração\s*$/;
const MAGE_HEADING = /^##\s+(?:(\d+)\.\s+)?(.+?)\s*$/;
const NON_MAGE_HEADINGS = new Set(["O significado das sete cores", "Distribuição por Refração", "Bloco da Preservação", "Bloco da Verdade", "Bloco da Transformação", "O Trino"]);
const EXPECTED_MAGE_COUNT = 27;

export function mageSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function trimBlank(lines) {
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines;
}

function roleFor(index) {
  if (index === 1) return "O Trino";
  if (index >= 2 && index <= 8) return "Grande Arquimago";
  return "Mago Pleno";
}

function summaryFromBody(body, maxChars = 900) {
  const cleaned = body
    .replace(/^###\s+/gm, "#### ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}...`;
}

export function extractMagePortraits(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => MAGE_SOURCE_START.test(line));
  const end = lines.findIndex((line, index) => index > start && MAGE_SOURCE_END.test(line));
  if (start === -1 || end === -1) {
    throw new Error("Could not locate the canonical mage list in OS_27_MAGOS_DA_ORDEM_DOS_TRES.md.");
  }

  const mages = [];
  let current = null;

  function flush() {
    if (!current) return;
    current.lines = trimBlank(current.lines);
    const body = current.lines.join("\n").trim();
    mages.push({
      index: mages.length + 1,
      name: current.name,
      slug: mageSlug(current.name),
      role: roleFor(mages.length + 1),
      source: body,
      summary: summaryFromBody(body),
    });
    current = null;
  }

  for (const line of lines.slice(start, end)) {
    const heading = MAGE_HEADING.exec(line);
    if (heading && !NON_MAGE_HEADINGS.has(heading[2])) {
      flush();
      current = { name: heading[2], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  if (mages.length !== EXPECTED_MAGE_COUNT) {
    throw new Error(`Expected ${EXPECTED_MAGE_COUNT} mage portraits, extracted ${mages.length}.`);
  }
  return mages;
}

export function buildMagePortraitPrompt(mage) {
  return [
    "DIRETRIZES DE ESTILO (siga rigorosamente):",
    DEFAULT_IMAGE_DIRECTIVES,
    "",
    "CENA A ILUSTRAR (retrato canônico de um mago da Ordem dos Três):",
    `Nome: ${mage.name}`,
    `Função na Ordem: ${mage.role}`,
    "",
    "LORE CANÔNICO DO MAGO:",
    mage.source,
    "",
    "INSTRUÇÕES VISUAIS:",
    "Crie um retrato vertical dramático, busto ou meio-corpo, com foco no rosto, postura, vestes, símbolo e atmosfera mágica.",
    "Use a cor/refração, preço habitual, símbolo, origem e posição política descritos no lore como direção visual quando existirem.",
    "A imagem deve parecer uma página ilustrada de uma crônica medieval de Valdren, não uma fotografia moderna.",
    "Não inclua texto, letras, assinatura, logotipo, moldura com palavras ou interface.",
    "Não invente biografia, eventos, relações, segredos ou poderes que não estejam no lore canônico.",
  ].join("\n");
}

export function buildMageManifest(mages, outputDir) {
  return mages.map((mage) => ({
    index: mage.index,
    name: mage.name,
    slug: mage.slug,
    role: mage.role,
    prompt: buildMagePortraitPrompt(mage),
    imagePath: `${outputDir}/${mage.slug}.png`,
  }));
}

export function buildMageWikiEntries(mages, imageUrlForSlug) {
  return mages.map((mage) => ({
    section: "os-magos",
    title: mage.name,
    body: [`**${mage.role}.**`, "", mage.summary].join("\n"),
    imageUrl: imageUrlForSlug(mage.slug),
  }));
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm run build:shared
npm run test --workspace backend -- scripts/mage-portraits.test.mjs
```

Expected: PASS. The shared build is required because the helper imports `DEFAULT_IMAGE_DIRECTIVES` from `shared/dist`.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/mage-portraits.mjs backend/scripts/mage-portraits.test.mjs
git commit -m "feat: add mage portrait helpers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Local OpenAI Batch Generation Script

**Files:**
- Create: `scripts/generate-mage-portraits.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing import smoke test**

Append to `backend/scripts/mage-portraits.test.mjs`:

```js
import { execFileSync } from "node:child_process";

it("loads the batch generation script help without calling OpenAI", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/generate-mage-portraits.mjs", "--help"],
    { cwd: resolve(import.meta.dirname, "../.."), encoding: "utf8" },
  );

  expect(output).toContain("Usage: npm run generate:mage-portraits");
  expect(output).toContain("--only <slug>");
  expect(output).toContain("--out <dir>");
});
```

If `import.meta.dirname` is unavailable, define:

```js
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
```

and use `{ cwd: repoRoot, encoding: "utf8" }`.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm run test --workspace backend -- scripts/mage-portraits.test.mjs
```

Expected: FAIL because `scripts/generate-mage-portraits.mjs` does not exist.

- [ ] **Step 3: Add npm script**

In root `package.json`, add:

```json
"generate:mage-portraits": "npm run build:shared && node scripts/generate-mage-portraits.mjs"
```

Place it near the other root scripts.

- [ ] **Step 4: Implement batch generation script**

Create `scripts/generate-mage-portraits.mjs`:

```js
import OpenAI from "openai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMageManifest, extractMagePortraits } from "./mage-portraits.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = "/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md";
const defaultOutDir = resolve(root, "tmp/mage-portraits-review");
const imageModel = "gpt-image-1";
const imageSize = "1536x1024";
const imageQuality = "medium";

function usage() {
  return [
    "Usage: npm run generate:mage-portraits -- [--only <slug>] [--out <dir>] [--dry-run]",
    "",
    "Generates review PNGs for the 27 mages of the Ordem dos Três.",
    "Options:",
    "  --only <slug>  Generate or regenerate only one mage, e.g. maelor-vespera.",
    "  --out <dir>    Review output directory. Default: tmp/mage-portraits-review.",
    "  --dry-run      Write manifest only; do not call OpenAI.",
    "  --help         Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { only: "", outDir: defaultOutDir, dryRun: false, help: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--only") args.only = argv[++index] ?? "";
    else if (arg === "--out") args.outDir = resolve(root, argv[++index] ?? "");
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function generateImage(client, prompt) {
  const response = await client.images.generate({
    model: imageModel,
    prompt,
    size: imageSize,
    quality: imageQuality,
    n: 1,
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI did not return image data.");
  return Buffer.from(b64, "base64");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const markdown = readFileSync(sourcePath, "utf8");
  const allMages = extractMagePortraits(markdown);
  const mages = args.only ? allMages.filter((mage) => mage.slug === args.only) : allMages;
  if (args.only && mages.length !== 1) throw new Error(`No mage found for --only ${args.only}.`);

  mkdirSync(args.outDir, { recursive: true });
  const manifest = buildMageManifest(mages, args.outDir);
  writeFileSync(resolve(args.outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  if (args.dryRun) {
    console.log(`Wrote dry-run manifest for ${manifest.length} mage portrait(s) to ${args.outDir}.`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to generate mage portraits.");
  const client = new OpenAI({ apiKey, timeout: 120000, maxRetries: 0 });

  for (const item of manifest) {
    if (existsSync(item.imagePath)) {
      console.log(`Skipping existing ${item.slug}: ${item.imagePath}`);
      continue;
    }
    console.log(`Generating ${item.index}. ${item.name} (${item.slug})...`);
    const image = await generateImage(client, item.prompt);
    writeFileSync(item.imagePath, image);
  }
  console.log(`Generated review images in ${args.outDir}. Review them before publishing.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
```

- [ ] **Step 5: Run script smoke tests**

Run:

```bash
npm run build:shared
npm run test --workspace backend -- scripts/mage-portraits.test.mjs
npm run generate:mage-portraits -- --dry-run --out tmp/mage-portraits-review
```

Expected:

- tests PASS
- dry run prints `Wrote dry-run manifest for 27 mage portrait(s)`
- `tmp/mage-portraits-review/manifest.json` exists
- no PNGs are required in dry run

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json scripts/generate-mage-portraits.mjs backend/scripts/mage-portraits.test.mjs
git commit -m "feat: add mage portrait generation script" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Generate Review Images

**Files:**
- Create local untracked review artifacts under `tmp/mage-portraits-review`
- No committed source changes expected unless generation script needs a bug fix

- [ ] **Step 1: Generate the 27 review portraits**

Run:

```bash
OPENAI_API_KEY="$OPENAI_API_KEY" npm run generate:mage-portraits -- --out tmp/mage-portraits-review
```

Expected:

- the command generates 27 PNGs under `tmp/mage-portraits-review`
- `tmp/mage-portraits-review/manifest.json` lists 27 entries
- no files under `tmp/` are staged or committed

- [ ] **Step 2: Verify generation count**

Run:

```bash
find tmp/mage-portraits-review -maxdepth 1 -name '*.png' | wc -l
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('tmp/mage-portraits-review/manifest.json','utf8')); console.log(m.length); if (m.length !== 27) process.exit(1);"
```

Expected:

- first command prints `27`
- second command prints `27`

- [ ] **Step 3: Provide review handoff to user**

Tell the user:

```text
Generated 27 review portraits in `tmp/mage-portraits-review`. Please review the PNGs. If any need rerolling, tell me the mage name or slug; I can rerun only that one with `npm run generate:mage-portraits -- --only <slug> --out tmp/mage-portraits-review`.
```

Stop here until the user approves the generated images or asks for rerolls. Do not publish unreviewed images.

---

### Task 4: Publish Approved Mage Portraits to Wiki Defaults

**Files:**
- Modify: `scripts/generate-valdren-wiki.mjs`
- Modify: `shared/src/defaultWiki.ts`
- Modify: `backend/scripts/generate-valdren-wiki.test.mjs`
- Modify: `backend/src/db/wiki.test.ts`
- Create: `frontend/public/mages/*.png`

- [ ] **Step 1: Copy approved images into public assets**

After user approval, run:

```bash
mkdir -p frontend/public/mages
cp tmp/mage-portraits-review/*.png frontend/public/mages/
find frontend/public/mages -maxdepth 1 -name '*.png' | wc -l
```

Expected: prints `27`.

- [ ] **Step 2: Add failing generator tests for mage portrait entries**

Append to `backend/scripts/generate-valdren-wiki.test.mjs`:

```js
import { buildMagePortraitEntriesForWiki, extractMagePortraits } from "../../scripts/mage-portraits.mjs";
import { readFileSync } from "node:fs";

it("builds twenty-seven approved mage portrait wiki entries", () => {
  const source = readFileSync("/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md", "utf8");
  const entries = buildMagePortraitEntriesForWiki(extractMagePortraits(source), (slug) => `/mages/${slug}.png`);

  expect(entries).toHaveLength(27);
  expect(entries[0]).toMatchObject({
    section: "os-magos",
    title: "Maelor Véspera",
    order: 1,
    imageUrl: "/mages/maelor-vespera.png",
  });
  expect(entries[26]).toMatchObject({
    section: "os-magos",
    title: "Nereza Último-Fio",
    order: 27,
    imageUrl: "/mages/nereza-ultimo-fio.png",
  });
});
```

- [ ] **Step 3: Run test to verify RED**

Run:

```bash
npm run test --workspace backend -- scripts/generate-valdren-wiki.test.mjs
```

Expected: FAIL because `buildMagePortraitEntriesForWiki` does not exist.

- [ ] **Step 4: Add ordered Wiki entry helper**

In `scripts/mage-portraits.mjs`, add:

```js
export function buildMagePortraitEntriesForWiki(mages, imageUrlForSlug) {
  return buildMageWikiEntries(mages, imageUrlForSlug).map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
}
```

- [ ] **Step 5: Wire portraits into the Wiki generator**

In `scripts/generate-valdren-wiki.mjs`, add imports at the top:

```js
import { existsSync } from "node:fs";
import { buildMagePortraitEntriesForWiki, extractMagePortraits } from "./mage-portraits.mjs";
```

If keeping the existing `node:fs` import, merge `existsSync` into it:

```js
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
```

Add helper near `parseMagesEntry`:

```js
function parseMagePortraitEntries(text) {
  const entries = buildMagePortraitEntriesForWiki(extractMagePortraits(text), (slug) => `/mages/${slug}.png`);
  for (const entry of entries) {
    const fileName = entry.imageUrl.replace("/mages/", "");
    const imagePath = resolve(root, "frontend/public/mages", fileName);
    if (!existsSync(imagePath)) {
      throw new Error(`Missing approved mage portrait image: ${imagePath}`);
    }
  }
  return entries;
}
```

In `main()`, change:

```js
const magesEntry = parseMagesEntry(readFileSync(magesPath, "utf8"));
```

to:

```js
const magesText = readFileSync(magesPath, "utf8");
const magesEntry = parseMagesEntry(magesText);
const magePortraitEntries = parseMagePortraitEntries(magesText);
```

Then include portraits after `magesEntry`:

```js
  magesEntry,
  ...magePortraitEntries,
  expeditionEntry,
```

- [ ] **Step 6: Add default Wiki assertions**

In `backend/src/db/wiki.test.ts`, after the existing `mages` assertions, add:

```ts
    const magePortraitEntries = DEFAULT_WIKI_ENTRIES.filter((entry) =>
      entry.section === "os-magos" &&
      entry.title !== "Os Vinte e Sete Magos da Ordem dos Três"
    );
    expect(magePortraitEntries).toHaveLength(27);
    expect(magePortraitEntries[0]).toMatchObject({
      title: "Maelor Véspera",
      order: 1,
      imageUrl: "/mages/maelor-vespera.png",
    });
    expect(magePortraitEntries[26]).toMatchObject({
      title: "Nereza Último-Fio",
      order: 27,
      imageUrl: "/mages/nereza-ultimo-fio.png",
    });
```

- [ ] **Step 7: Regenerate default Wiki**

Run:

```bash
node scripts/generate-valdren-wiki.mjs
```

Expected:

- generated entry count increases from `107` to `134`
- `shared/src/defaultWiki.ts` includes `/mages/maelor-vespera.png`

- [ ] **Step 8: Run targeted tests**

Run:

```bash
npm run test --workspace backend -- scripts/generate-valdren-wiki.test.mjs src/db/wiki.test.ts
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add scripts/mage-portraits.mjs scripts/generate-valdren-wiki.mjs backend/scripts/generate-valdren-wiki.test.mjs backend/src/db/wiki.test.ts shared/src/defaultWiki.ts frontend/public/mages
git commit -m "feat: publish mage portraits in wiki" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Validate and Publish Live Site

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full validation**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 2: Push main**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Replace live Wiki**

Run:

```bash
CONFIRM_REPLACE_WIKI=yes npm run replace-wiki --workspace backend
```

Expected: inserted count is `134` or greater if other entries were added.

- [ ] **Step 4: Deploy frontend**

Run the existing manual Amplify deployment flow for app `d1emmrcvmpw55g`, branch `main`:

```bash
rm -f /tmp/turnbasedrpg-frontend.zip /tmp/turnbasedrpg-amplify-deploy.json /tmp/turnbasedrpg-amplify-upload.out
cd frontend/dist
zip -qr /tmp/turnbasedrpg-frontend.zip .
cd ../..
DEPLOY_JSON=$(aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --output json)
echo "$DEPLOY_JSON" > /tmp/turnbasedrpg-amplify-deploy.json
JOB_ID=$(node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('/tmp/turnbasedrpg-amplify-deploy.json','utf8')); console.log(d.jobId)")
UPLOAD_URL=$(node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('/tmp/turnbasedrpg-amplify-deploy.json','utf8')); console.log(d.zipUploadUrl)")
curl -sS -X PUT -H 'Content-Type: application/zip' --upload-file /tmp/turnbasedrpg-frontend.zip "$UPLOAD_URL" >/tmp/turnbasedrpg-amplify-upload.out
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --output json
```

Then wait:

```bash
for i in $(seq 1 60); do
  STATUS=$(aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --query 'job.summary.status' --output text)
  echo "status=$STATUS"
  case "$STATUS" in SUCCEED|FAILED|CANCELLED) break;; esac
  sleep 5
done
test "$STATUS" = "SUCCEED"
```

Expected: deployment status `SUCCEED`.

- [ ] **Step 5: Smoke test live Wiki API and assets**

Run:

```bash
curl -s https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com/api/wiki | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const json=JSON.parse(d); const entries=Array.isArray(json)?json:json.entries; const portraits=entries.filter(e=>e.section==='os-magos' && e.imageUrl && e.imageUrl.startsWith('/mages/')); if (portraits.length !== 27) throw new Error('Expected 27 mage portraits, found '+portraits.length); console.log('mage portraits '+portraits.length); });"
curl -I https://main.d1emmrcvmpw55g.amplifyapp.com/mages/maelor-vespera.png
curl -I https://main.d1emmrcvmpw55g.amplifyapp.com/mages/nereza-ultimo-fio.png
```

Expected:

- API prints `mage portraits 27`
- both asset requests return HTTP `200`

- [ ] **Step 6: Cleanup temporary artifacts**

Run:

```bash
rm -f /tmp/turnbasedrpg-frontend.zip /tmp/turnbasedrpg-amplify-deploy.json /tmp/turnbasedrpg-amplify-upload.out
git status --short
```

Expected: only pre-existing untracked `backups/` may remain.

---

## Self-Review Notes

- Spec coverage: extraction, prompt style, OpenAI generation, review-first workflow, static asset publication, Wiki cards, tests, and deployment are covered.
- Scope check: this is one feature with a deliberate review gate; permanent Admin UI remains out of scope.
- Placeholder scan: no steps contain TBD/TODO or unspecified tests.
- Type consistency: mage identity fields are `index`, `name`, `slug`, `role`, `source`, `summary`; Wiki entries use existing `section`, `title`, `body`, `order`, `imageUrl`.
