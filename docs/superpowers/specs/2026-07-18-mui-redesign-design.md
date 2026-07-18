# Material UI Redesign — Design

**Date:** 2026-07-18
**Status:** Approved by user to implement autonomously ("go ahead and implement"), design-approval gate waived by the user.

## Goal
Make the Ravenloft: O Inverno dos Mortos site more beautiful and improve UX by adopting Material UI (MUI v6), while preserving all existing behavior, the ApiClient contract, and the 35 passing frontend tests.

## Scope
Frontend only (`frontend/src`). No backend, API, or content changes. No test-contract-breaking changes: all button labels, ARIA labels, headings, and value strings the tests assert on are preserved verbatim.

## Approach
Introduce a custom MUI dark "gothic" theme derived from the existing CSS-variable palette, wrap the app in `ThemeProvider` + `CssBaseline`, add a shared `Layout` (AppBar + centered Container), and rebuild each page/component with MUI primitives. Delete the hand-rolled `theme.css` once components no longer depend on it.

### Theme (`src/theme.ts`)
- `mode: "dark"`, `background.default #0c0d10`, `background.paper #16181d`.
- `primary #38506e` (accent-blue), `error/secondary #7c2b2b` (accent-red), `warning #b3541e` (danger).
- `text.primary #e8e4d8`, `text.secondary #9aa0ab`.
- Headings use a serif stack (Georgia); body uses system-ui.
- Rounded corners, subtle borders, comfortable spacing; min 44px touch targets retained.

### Components → MUI mapping
- **LoadingState** → centered `CircularProgress` + label, keeps `role="status"`.
- **KingdomStats** → `Card` with a list of stats, each a `LinearProgress` (value/10) + a right-aligned `"{n} / 10"` text (string preserved for tests). "Avanço dos Mortos" and "Conhecimento sobre o Inimigo" use a warning/red color.
- **HouseCard** → `Card` + `CardContent` + `CardActions`; button label stays `"Disponível — escolher"` / `"Escolhida"`; category-free; disabled when taken.
- **CardChoice** → `Card` with selectable/elevated style, category `Chip`s, `"Escolher esta carta"` button, and `"✓ Carta escolhida"` when selected.
- **PrivatePanel** → `Card` with a red left border + `Chip`/heading; keeps `aria-label={title}`.
- **AdminChoiceTable** → MUI `Table`; status/choice `Chip`s; keeps house name text and `"—"` placeholders.

### Pages → MUI
- **Layout**: `AppBar` (title + atmospheric subtitle) + `Container maxWidth="md"`.
- **Landing**: hero with title, intro paragraphs, two CTA buttons (contained + outlined).
- **Claim**: house grid (`Grid`), inline confirm view with `TextField` for display name, code reveal.
- **Login**: centered `TextField` (`aria-label="Código do jogador"`) + submit.
- **Game**: header (house name/subtitle/player + Sair), stats, event `Card`s, private panel, card grid, choice confirmation with timestamp.
- **Admin**: password `TextField` (`label="Código de admin"`), status `Chip`, stats, choices table, lock/unlock + copy-summary with a `Snackbar` for "Copiado!".

## Testing
`npm test` must stay green (backend 51 + frontend 35 + content validation). MUI `Button` renders a `<button>` (role/name preserved) and `TextField` with `label`/`aria-label` supports `getByLabelText`, so existing queries continue to work. Run the frontend suite after each area; run the full gate before deploy.

## Deploy
Rebuild the frontend against the live API and redeploy to Amplify (same app `d1emmrcvmpw55g`), then smoke-check the site loads.
