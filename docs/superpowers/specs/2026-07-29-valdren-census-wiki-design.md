# Valdren Census Wiki Design

## Goal

Add a public Wiki section for the canonical Valdren census so players can read population, cities, demographic logic, and military capacity in one dedicated page.

The public menu label will be `Censo`. The primary entry title will be `Censo Canônico de Valdren`.

## Canonical Source

Use `/Users/jessicarosa/Downloads/POPULACAO_E_DEMOGRAFIA_DE_VALDREN_CANONICA.md` as the content source.

The source file is more complete than the inline prompt and should be treated as canonical for implementation. The Wiki entry should preserve its Markdown structure: tables, headings, bullets, bold text, and explanatory sections.

## User-Facing Placement

Add a new fixed Wiki section:

- id: `censo`
- label: `Censo`
- position: near the beginning of the Wiki menu, after `Visão Geral`

This keeps census data easy to find without burying it under `Povos`, `Governo`, or `Economia e Tributos`.

## Content Shape

Add one default Wiki entry:

- section: `censo`
- title: `Censo Canônico de Valdren`
- order: `0`
- body: Markdown copied from the canonical source file, with any top-level source title removed if it would duplicate the entry title

The body should retain:

- total population of approximately `2.000.000`
- territorial distribution table
- non-territorial networks
- largest cities and settlements
- per-House demographic notes
- military capacity estimates

## Generator Behavior

Update `scripts/generate-valdren-wiki.mjs` so future regeneration appends the census entry from the canonical source file. This prevents the entry from disappearing if the Valdren encyclopedia defaults are regenerated from the main canon documents.

The generator should read the census file from its known local path and include it alongside the existing generated default entries.

## Live Data

After source defaults are updated, replace the live DynamoDB Wiki using the existing safe `replace-wiki` script. This ensures players see the new Censo section immediately.

## Rendering

No new Markdown renderer work is required. The existing Wiki Markdown renderer should display census headings, tables, lists, and bold text. If tables do not already have special styling, they may render with default Markdown HTML in this feature; table polish is out of scope unless tests reveal unreadable output.

## Testing

Tests should cover:

- `WIKI_SECTIONS` includes `censo` with label `Censo`.
- Default Wiki entries include `Censo Canônico de Valdren` in section `censo`.
- Census content includes key canonical values: `2.000.000`, `Casa Valerius`, `Asterhall`, `28.000`, and `35.000`.
- The generator output preserves the census entry after regeneration.
- The public Wiki page can render the `censo` section route.

## Out of Scope

- Recalculating demographics.
- Editing the canonical population numbers.
- Creating charts or interactive tables.
- Reorganizing existing Wiki sections beyond adding `Censo`.
