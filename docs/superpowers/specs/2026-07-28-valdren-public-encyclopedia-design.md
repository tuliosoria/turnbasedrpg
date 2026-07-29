# Valdren public encyclopedia expansion design

## Goal

Replace the current public Valdren Wiki content with a richer, player-facing encyclopedia based on the canonical files:

- `/Users/jessicarosa/Downloads/VALDREN_MEGA_ENCICLOPEDIA_PUBLICA_CANONICA_V2.md`
- `/Users/jessicarosa/Downloads/ATLAS_GEOGRAFICO_DE_VALDREN_CANONICO_V2.md`
- `/Users/jessicarosa/Downloads/ChatGPT Image Jul 28, 2026, 10_54_45 PM.png`

The live Wiki should be updated now, not only future default seeds.

## Public content boundaries

The source document identifies itself as public, but the published Wiki should still remove game-facing mechanics and sensitive material. Do not publish:

- `Perfil de poder` sections.
- Tables of `Riqueza`, `Recursos`, `Soldados`, `Controle`.
- House weaknesses or mechanical attribute framing.
- GM-only explanations, if any appear.

Keep public lore, culture, geography, institutions, rumors, public politics, known crisis state, cities, peoples, religions, magic, customs and calendar.

## Wiki structure

Expand the fixed Wiki navigation so the encyclopedia is readable instead of forcing everything into the current small set of sections. Use sections like:

- `visao-geral` — Visão Geral
- `geografia` — Geografia e Atlas
- `cidades` — Cidades e Lugares
- `casas` — Casas e Facções
- `governo` — Governo
- `tributos` — Economia e Tributos
- `cosmologia` — Cosmologia
- `religioes` — Religiões
- `magia` — Magia
- `povos` — Povos de Valdren
- `costumes` — Costumes
- `calendario` — Calendário
- `brumas` — As Brumas
- `crise-atual` — Crise Atual
- Keep `mortos-vivos` if useful for existing links and threat content.

Entries should be rich but not giant dumps: many short/medium entries are preferred over a few very long pages.

## Atlas image

Publish the provided PNG as a static frontend asset and add it to the top of the Geografia/Atlas section. The Wiki model should support an optional image URL per entry so the map can render before the text.

The map entry should use the static URL `/valdren-map.png` after the image is copied into `frontend/public/`.

## Data model and admin behavior

Extend `WikiEntry` and `DefaultWikiEntry` with optional `imageUrl`. Public Wiki rendering should show the image when present. Admin Wiki editing should preserve and allow editing the optional image URL so updating the map entry does not accidentally remove it.

Backend validation should accept optional image URLs, limited to safe relative paths beginning with `/` or absolute `https://` URLs.

## Defaults and live data

Update `shared/src/defaultWiki.ts` so future seeds contain the new encyclopedia. Because `seedDefaultWiki` only acts when the Wiki is empty, also add a one-off replacement path for the live DynamoDB Wiki and execute it after verification.

The live replacement should delete existing `WIKI#` entries and insert the new defaults with stable IDs derived from section/title/order, preserving campaign turns, Houses, submissions, GM bible and World Bible.

## Testing

Add tests that prove:

- New section IDs are accepted and sorted.
- Default Wiki contains the new core sections and the map entry.
- Default Wiki does not include mechanical attribute tables or `Perfil de poder`.
- Backend parse/DB layers preserve `imageUrl`.
- Public `WikiPage` renders a Wiki image above entry text.
- Admin `WikiManager` can edit/preserve `imageUrl`.

## Deployment

After code and data verification:

1. Commit and push to `main`.
2. Manually deploy the frontend through the Amplify zip flow.
3. Redeploy backend only if backend bundle behavior changed.
4. Replace the live Wiki data in DynamoDB with the new defaults.
5. Smoke check the public Wiki at the Amplify URL.
