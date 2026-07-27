# Private Result Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the player's previous-turn private result above the result image and label it clearly as "Informação Privada".

**Architecture:** This is a frontend-only rendering change in `GamePage`. The existing `previousResult.privateResult` API data stays unchanged; only the order and label in the previous-result card change.

**Tech Stack:** React, TypeScript, Material UI, Vitest, Testing Library.

---

### Task 1: Add UI regression for private result placement

**Files:**
- Modify: `frontend/src/pages/GamePage.test.tsx`

- [x] **Step 1: Write the failing test**

Add a test that uses the real `MockApiClient` flow to create a previous result with a private house result and generated result image. Assert the DOM order is public result, "Informação Privada", private result text, then result image.

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test --workspace frontend -- src/pages/GamePage.test.tsx
```

Expected: FAIL because "Informação Privada" is not rendered before the image.

### Task 2: Move and label previous private result

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx`

- [x] **Step 1: Implement the minimal rendering change**

Render `game.previousResult.privateResult` immediately after the public result text, inside a small block titled "Informação Privada". Keep the existing secondary text style for the private result body. Render the result image after that block.

- [x] **Step 2: Run the focused frontend test**

Run:

```bash
npm run test --workspace frontend -- src/pages/GamePage.test.tsx
```

Expected: all tests in `GamePage.test.tsx` pass.

- [x] **Step 3: Run full validation**

Run:

```bash
npm test
```

Expected: shared, backend, and frontend tests pass.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx docs/superpowers/plans/2026-07-26-private-result-label.md
git commit -m "fix: label private previous result"
git push origin main
```

Use this commit body:

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Pushing to `main` triggers the frontend deployment.

---

## Self-review

- Spec coverage: covered rendering order, label text, frontend-only data flow, and UI test.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: uses existing `GamePage`, `MockApiClient`, and `previousResult` fields.
