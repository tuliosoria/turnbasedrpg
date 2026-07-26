# Player House Public History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Do Ouro, Solarion, and Khazdrun to the public Valdren wiki as story-only House lore.

**Architecture:** The default public wiki lives in `shared/src/defaultWiki.ts` and is consumed by backend wiki seeding through `@ravenloft/content`. Existing live wiki data is stored in DynamoDB, so source defaults and deployed data both need updates.

**Tech Stack:** TypeScript, Vitest, DynamoDB, AWS CLI.

---

### Task 1: Protect player House lore

**Files:**
- Modify: `backend/src/db/wiki.test.ts`

- [x] **Step 1: Write the failing test**

```ts
it("includes the player house backgrounds in public lore without private mechanics", () => {
  const playerHouseTitles = ["Casa Do Ouro", "Casa Solarion", "Casa Khazdrun"];
  const entries = DEFAULT_WIKI_ENTRIES.filter((e) => playerHouseTitles.includes(e.title));

  expect(entries.map((e) => e.title)).toEqual(playerHouseTitles);
  for (const entry of entries) {
    expect(entry.section).toBe("casas");
    expect(entry.body.length).toBeGreaterThan(500);
    expect(entry.body).not.toMatch(/fraqueza|atributos|recursos|riqueza|soldados|controle|especialidade/i);
  }
  expect(entries.find((e) => e.title === "Casa Do Ouro")?.body.length).toBeGreaterThan(900);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/db/wiki.test.ts`

Expected: FAIL because `DEFAULT_WIKI_ENTRIES` does not yet include the three player House titles.

### Task 2: Add the public histories

**Files:**
- Modify: `shared/src/defaultWiki.ts`

- [x] **Step 1: Add three entries**

Add `Casa Do Ouro`, `Casa Solarion`, and `Casa Khazdrun` to the `casas` section after `Irmandade dos Corvos`. Use orders 6, 7, and 8.

- [x] **Step 2: Run the wiki test**

Run: `npm run build --workspace shared >/dev/null && npm run test --workspace backend -- src/db/wiki.test.ts`

Expected: PASS.

### Task 3: Update the live public wiki

**Files:**
- No source files.

- [x] **Step 1: Upsert the three DynamoDB wiki entries**

Use `aws dynamodb put-item` against table `ravenloft-game`, campaign key `CAMPAIGN#WINTER_DEAD`, and stable sort keys:

```bash
WIKI#player-house-do-ouro
WIKI#player-house-solarion
WIKI#player-house-khazdrun
```

- [x] **Step 2: Verify the public API**

Run: `curl -s https://<api>/api/wiki` and confirm the three titles appear in the `casas` section.

### Task 4: Commit and push

**Files:**
- `backend/src/db/wiki.test.ts`
- `shared/src/defaultWiki.ts`
- `docs/superpowers/specs/2026-07-25-player-house-public-history-design.md`
- `docs/superpowers/plans/2026-07-25-player-house-public-history.md`

- [ ] **Step 1: Commit**

```bash
git add backend/src/db/wiki.test.ts shared/src/defaultWiki.ts docs/superpowers/specs/2026-07-25-player-house-public-history-design.md docs/superpowers/plans/2026-07-25-player-house-public-history.md
git commit -m "feat: add player houses to public Valdren lore"
```

- [ ] **Step 2: Push**

```bash
git push
```
