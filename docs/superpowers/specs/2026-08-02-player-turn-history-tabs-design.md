# Player Turn History Tabs — Design

**Date:** 2026-08-02
**Status:** Approved

## Problem

On the `/game` page, players can only see a single previous turn result (the
`previousResult` card, which shows the last RESOLVED turn). There is no way for
a player to review the results of earlier turns. Players want to browse all past
turns via tabs (Turno 1, Turno 2, …).

## Goal

Replace the single "Resultado anterior" card with a "Histórico de turnos" card
containing horizontal tabs, one per RESOLVED turn. Each tab shows the same
content the current card shows: public result + this house's private result +
result image.

## Scope

**In scope:**
- Backend: expose an array of resolved past turns to the player (`turnHistory`).
- Frontend: tabbed history card on `/game`.
- Mock API parity + tests.

**Out of scope:**
- Showing the open/locked current turn inside the history (it keeps its own
  sections: "Evento público", "Informação privada", order submission).
- Showing past public events, past private information, or past submitted orders
  in the history (only results, matching today's card).
- Pagination/lazy-loading of turns (campaign turn counts are small).

## Visibility Rules (unchanged intent)

- Only turns with `status === "RESOLVED"` **and** a `result` appear in history.
- DRAFT / OPEN / LOCKED turns never appear in history.
- Private result per tab is `result.houseResults[houseId]` for the requesting
  player's house only.

## Approach (A: replace `previousResult` with `turnHistory`)

### Data model

New entry type (frontend `frontend/src/types/api.ts`):

```ts
export interface TurnHistoryEntry {
  turnId: number;
  publicResult?: string;
  privateResult?: string;
  discoveries: string[];
  resultImageUrl?: string;
}
```

`PlayerGameView` change:
- Remove `previousResult: PreviousResult | null;`
- Add `turnHistory: TurnHistoryEntry[];` (empty array when no resolved turns).

The `PreviousResult` interface is removed (no longer used).

### Backend (`backend/src/routes/playerRoutes.ts`, `getGame`)

- Always call `listTurns(...)` (currently only called for the DRAFT branch).
- Build `turnHistory` = all turns where `status === "RESOLVED" && result`,
  sorted ascending by `turnId`, mapped to:
  ```ts
  {
    turnId: t.turnId,
    publicResult: t.result.publicResult,
    privateResult: t.result.houseResults[houseId],
    discoveries: t.result.discoveries ?? [],
    resultImageUrl: t.resultImageUrl,
  }
  ```
- Return `turnHistory` in the response body instead of `previousResult`.
- The special DRAFT-branch logic that computed `previousResult` from the last
  resolved turn is removed — `turnHistory` already covers all resolved turns
  regardless of the active turn's status.

### Mock API (`frontend/src/api/mockClient.ts`, `getGame`)

- Build `turnHistory` from the mock's resolved turns / `galleryEntries` so it
  mirrors the backend shape and ordering.
- Remove the `previousResult` construction.

### Frontend (`frontend/src/pages/GamePage.tsx`)

- Remove the `game.previousResult` card.
- Add a "Histórico de turnos" card rendered only when `turnHistory.length > 0`:
  - MUI `Tabs` (`variant="scrollable"`, `scrollButtons="auto"`) with one tab per
    entry, labelled `Turno {turnId}`.
  - Default selected tab = last (most recent) entry.
  - Selected tab index held in local `useState`, initialized to the last index
    and re-synced when `turnHistory` length changes (e.g., after refresh).
  - The active tab panel renders: public result (`WikiMarkdown`), private result
    under an "Informação Privada" heading (`WikiMarkdown`), and the result image
    — identical markup to today's card, just driven by the selected entry.
- The current open/locked turn sections and the order submission form are
  unchanged.

## Testing

**Backend (`playerRoutes` / handler tests):**
- `getGame` returns `turnHistory` with multiple resolved turns in ascending
  `turnId` order.
- Non-resolved turns (DRAFT/OPEN/LOCKED) are excluded from `turnHistory`.
- `privateResult` reflects the requesting house's `houseResults` entry only.
- Empty `turnHistory` (`[]`) when there are no resolved turns.

**Frontend (`GamePage.test.tsx`):**
- Tabs render one per resolved turn; most recent selected by default.
- Switching tabs shows the corresponding turn's public/private result + image.
- No history card when `turnHistory` is empty.

## Rollout

Worktree `.worktrees/player-turn-history-tabs`, branch
`feature/player-turn-history-tabs`. Implement via subagent-driven-development
with spec-compliance + code-quality reviews per task. Merge to `main`, push,
deploy frontend (manual Amplify zip flow) + backend (SAM). Smoke test `/game`.
