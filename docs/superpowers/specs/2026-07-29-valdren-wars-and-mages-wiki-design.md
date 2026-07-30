# Valdren Wars and Mages Wiki Design

## Goal

After the Census is published, add two new public Valdren Wiki sections:

- `Guerras`, with one entry: `As Guerras de Valdren`
- `Os Magos`, with one entry: `Os Vinte e Sete Magos da Ordem dos Três`

Both entries should preserve canonical lore in a readable Markdown format and appear as first-class sections in the Wiki menu.

## Canonical Sources

Use these local files as canonical content sources:

- `/Users/jessicarosa/Downloads/As Guerras de Valdren.pdf`
- `/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md`

The PDF source should be extracted into clean Markdown. Remove PDF artifacts such as page breaks, orphan page numbers, duplicated headers, and broken list formatting. Do not invent new lore or change the canonical meaning.

The mages Markdown source is already structured. Preserve its headings, lists, bold text, and character sections. Remove only duplicate title text or formatting artifacts that would make the Wiki entry harder to read.

## User-Facing Placement

Add two fixed Wiki sections near the beginning of the menu, after `Censo`:

- id: `guerras`, label: `Guerras`
- id: `os-magos`, label: `Os Magos`

This keeps major historical conflicts and the twenty-seven initiated mages easy for players to find without burying them under `Histórias Antigas` or `Magia`.

## Content Shape

Add one default Wiki entry for each section:

1. `As Guerras de Valdren`
   - section: `guerras`
   - order: `0`
   - body: Markdown cleaned from the canonical PDF

2. `Os Vinte e Sete Magos da Ordem dos Três`
   - section: `os-magos`
   - order: `0`
   - body: Markdown from the canonical source file, with the top-level source title removed if it duplicates the entry title

The entries should remain long-form canonical reading pages rather than being split into many smaller entries.

## Generator Behavior

Update `scripts/generate-valdren-wiki.mjs` so future regeneration includes both entries from their canonical sources. This prevents the new sections from disappearing when default Wiki data is regenerated.

The generator should append the entries alongside the existing generated default entries. It should preserve Markdown formatting and fail loudly if a required canonical source is missing.

## Live Data

Publish these sections only after the Census section is already included in the generated defaults. The live Wiki replacement should publish Censo, Guerras, and Os Magos together in one safe DynamoDB replacement.

Update `backend/scripts/replace-wiki.mjs` so it refuses to replace the live Wiki unless all required canonical entries are present:

- `Censo Canônico de Valdren`
- `As Guerras de Valdren`
- `Os Vinte e Sete Magos da Ordem dos Três`

## Rendering

No new renderer architecture is required. The existing safe Wiki Markdown renderer should handle headings, lists, bold text, blockquotes, and tables.

The PDF extraction may require light Markdown cleanup so the `Guerras` page does not show broken line wrapping or page artifacts.

## Testing

Tests should cover:

- `WIKI_SECTIONS` includes `guerras` and `os-magos` in the expected order after `censo`.
- Default Wiki entries include `As Guerras de Valdren` in section `guerras`.
- Default Wiki entries include `Os Vinte e Sete Magos da Ordem dos Três` in section `os-magos`.
- The wars entry includes canonical war names from the PDF.
- The mages entry includes canonical values such as `27`, `Maelor Véspera`, and `Luz Primeira`.
- Public routes `/valdren/guerras` and `/valdren/os-magos` render the expected entries.
- `replace-wiki` refuses to run when any required canonical entry is missing.

## Out of Scope

- Splitting wars into one entry per war.
- Splitting mages into one entry per character.
- Inventing additional war chronology, mage powers, or character lore.
- Adding images or custom visual layouts for these sections.
- Reorganizing unrelated Wiki sections.
