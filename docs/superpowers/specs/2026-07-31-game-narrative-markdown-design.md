# Game Narrative Markdown Design

## Goal

Make the narrative blocks on `/game` easier to read by rendering Markdown formatting and encouraging newly generated turn text to use readable paragraphs, restrained bold, and restrained italics.

## Scope

This applies to the player-facing game page only:

- current turn public event;
- current turn private information;
- previous public result;
- previous private result.

The order text input remains plain editable text. Admin editing fields remain textareas and do not need a preview in this change.

## User experience

Narrative text should no longer appear as one dense block when it contains paragraph breaks or Markdown. Existing Markdown syntax like `**negrito**` and `*itálico*` should render visually instead of showing literal asterisks. Paragraphs, lists, and quotes should use the same spacing already used in the Wiki.

## Architecture

Reuse the existing `WikiMarkdown` renderer instead of creating a separate Markdown component. `GamePage` will replace plain `Typography` rendering for the four narrative fields with `WikiMarkdown`, preserving existing cards, headings, private labels, images, and the order form.

The backend prompt instructions will be updated so AI-generated public events and turn resolutions return Markdown-friendly strings inside the existing JSON contract. The JSON shape does not change.

## Prompt rules

Generated text should:

- use two or three short paragraphs when useful;
- use `**bold**` for key names, threats, locations, or consequences;
- use `*italics*` for mood, rumors, omens, or whispers;
- avoid top-level Markdown headings in game narrative blocks;
- avoid excessive decoration or unreadable symbol noise.

## Testing

Frontend tests will verify that Markdown in public events, private information, previous public results, and previous private results renders as formatted text. Backend prompt tests will verify that public event and resolution prompts mention Markdown formatting guidance while keeping strict JSON output.

