# Admin panel tabs redesign

Date: 2026-07-19

## Problem

The admin panel is a single page (`frontend/src/pages/AdminPage.tsx`, ~700 lines) that
stacks every feature vertically in one long scroll: turn composition, order monitoring,
turn resolution, house management, the World Bible, the Wiki, the GM Bible, and the reset
danger zone. Everything is on screen at once, which is confusing and hard to navigate. The
file is also large enough that it is doing too many things to reason about safely.

## Goal

Reorganize the admin panel into tabs so each area of work has its own screen. This is a
UI reorganization only. No API or backend changes, and no behavior change inside any
individual feature.

## Scope

In scope:
- A horizontal tab bar in the admin panel.
- Moving existing feature blocks into per-tab components.
- Persisting the active tab in a URL query param.
- Disabled placeholder tabs for two features that do not exist yet.

Out of scope (future work, shown only as disabled tabs):
- Gallery management (browse/regenerate/delete arbitrary images). Today only a public
  gallery read endpoint exists plus current-turn image generate/delete.
- Password management (view/rotate player codes, change admin code). No backend exists
  for this today.

## Tab structure

A horizontal MUI `Tabs` bar sits under the existing "Painel do Turno" header, scrollable
on small screens.

| Tab       | Query value | Contents                                                                 | State    |
|-----------|-------------|--------------------------------------------------------------------------|----------|
| Turnos    | `turnos`    | Compose / monitor / resolve the turn (conditional on turn status) plus the event and resolution image panels | active |
| Casas     | `casas`     | House list, create form, edit and delete dialogs, player-code reveal dialog | active |
| Historia  | `historia`  | World Bible lore field, Wiki manager, GM Bible (GM in a clearly marked secret section) | active |
| Prompts   | `prompts`   | Global image style directive (`visualDirectives`)                        | active   |
| Galeria   | `galeria`   | none                                                                     | disabled, label `Galeria (em breve)` |
| Senhas    | `senhas`    | none                                                                     | disabled, label `Senhas (em breve)` |
| Sistema   | `sistema`   | Danger zone: reset campaign                                              | active   |

Default tab is `turnos`.

## Component breakdown

`AdminPage.tsx` becomes the shell. It keeps:
- The admin login screen and admin token handling.
- Dashboard fetch and refresh (`syncDashboard`, the single owner of dashboard state).
- Shared action helpers (`runAction`, `busy`, `error`, `notice`).
- The dialogs it already owns (reset confirm, delete house, new house code).
- The tab bar and the logic that maps the active tab to a panel.

New presentational components under `frontend/src/components/admin/`:

- `AdminTurnsTab` — compose, monitor, and resolve blocks plus the two `TurnImagePanel`s.
- `AdminHousesTab` — house list, create form, and the buttons that open the edit, delete,
  and new-code dialogs.
- `AdminLoreTab` — World Bible lore field, `WikiManager`, and `GmBibleManager`.
- `AdminPromptsTab` — the image style directive field.
- `AdminSystemTab` — the reset danger zone.

Each tab component is presentational. It receives everything it needs as props: the
relevant slice of `dashboard`, `token`, `busy`, and the callbacks it triggers (either the
generic `runAction` or specific handlers such as `onEditHouse`, `onReset`). No tab fetches
data on its own.

## Shared state note: World Bible

The World Bible is a single entity `{ lore, visualDirectives }`, saved together via
`adminPutWorldBible(token, { lore, visualDirectives })`. The lore field lives in the
Historia tab and the visual directive lives in the Prompts tab. To avoid one tab
overwriting the other's field, both tabs read from and write to the same working copy held
in `AdminPage` state. A save from either tab sends both current values.

## URL param behavior and edge cases

- The active tab is stored in `?tab=turnos|casas|historia|prompts|sistema`.
- On load, the tab is read from the query param. Missing, unknown, or a disabled value
  (`galeria`, `senhas`) falls back to `turnos`.
- Switching tabs updates the query param using a replace (no new history entry per click).
- Disabled tabs cannot be selected.

## Testing

- Update existing `AdminPage.test.tsx` cases to click into the relevant tab before
  asserting (for example click "Casas" before checking the house list, click "Historia"
  before checking World Bible or wiki content).
- Add a test that switching tabs shows the correct panel and hides the others, and that a
  disabled tab cannot be activated.
- Add a test that loading with `?tab=casas` renders the Casas tab.

## Non-goals

- No backend or API changes.
- No change to how any feature behaves once you are inside its tab.
- No new gallery or password functionality (those tabs are disabled placeholders).
