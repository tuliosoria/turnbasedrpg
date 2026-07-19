# Internal image prompts manager — design

Date: 2026-07-19

## Problem

The turn image panel showed a giant, editable prompt textarea (style directives + turn
text) directly in the turn interface. That mixed reusable, world-level configuration into
the per-turn workflow. The admin asked for the turn zone to hold only turn things, and for
the internal prompts (image style directives) to be managed in a dedicated Admin area.

## Decisions

1. **Scope:** only the image style directives (not the AI text premise).
2. **Turn zone UX:** a "Gerar imagem" button plus an optional small "descrição da cena"
   field (turn-specific). The style directives are applied automatically, server-side.
3. **Default content:** the image directives are pre-filled with the full "Diretrizes para
   Geração e Evolução de Imagens" text, editable afterwards.

## Architecture

- `shared`: new constant `DEFAULT_IMAGE_DIRECTIVES` — single source of truth for the default
  style prompt, used by the backend (fallback) and the frontend (manager pre-fill).
- Directives keep living on the existing World Bible item (`visualDirectives`). No new table.
  When empty, backend and frontend fall back to `DEFAULT_IMAGE_DIRECTIVES`.

## Data flow (image generation)

- Frontend sends `POST /api/admin/turn/image` with `{ kind, sceneDescription? }` (no full
  prompt).
- Backend `generateTurnImage` loads the World Bible, then `buildImagePrompt(directives, kind,
  turn, sceneDescription)` composes: style directives + the scene (scene description if given,
  otherwise the turn's public event / public result). The composed prompt goes to gpt-image-1.

## Components

- `backend/src/ai/prompts.ts`: `buildImagePrompt` — pure function, unit-tested.
- `backend/src/validation/schemas.ts`: `parseGenerateTurnImageBody` now `{ kind,
  sceneDescription?≤2000 }`.
- `frontend/src/components/TurnImagePanel.tsx`: optional scene field + generate/delete
  buttons; no style prompt shown.
- `frontend/src/pages/AdminPage.tsx`: World Bible card relabels the field to "Diretrizes de
  Imagem (prompt de estilo)"; pre-fills with the default when empty.

## Testing

- Backend: `buildImagePrompt` (scene vs fallback vs default), `generateTurnImage` composes
  from stored directives + scene and uploads.
- Frontend: existing AdminPage/mockClient image tests updated to the new signature.
