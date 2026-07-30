# Encyclopedia Markdown Formatting Design

## Goal

Make the public Valdren encyclopedia easier to read by rendering its existing Markdown formatting instead of showing raw characters such as `**`, `-`, and heading markers.

The encyclopedia should keep rich formatting for bold text, italics, lists, links, and section headings. The source content remains Markdown so canonical lore and future Admin edits do not need to be rewritten into a custom format.

## Current State

Wiki entries store their body as plain strings. The frontend currently renders `entry.body` inside a Material UI `Typography` component with `whiteSpace: "pre-wrap"`, so Markdown is displayed literally. This makes generated entries with bullets and emphasis look inconsistent and hard to scan.

The generator already preserves public Markdown from the canonical source documents after filtering private/mechanical sections. That behavior should remain.

## Proposed Approach

Render Wiki body Markdown safely on the public Wiki page.

Supported formatting:

- Paragraphs
- Bold and italic text
- Bullet and numbered lists
- Nested text spacing where supported by the Markdown parser
- Headings rendered below the entry title
- Safe links
- Existing entry images from `imageUrl` and `imageUrls`

HTML embedded in Wiki body content must not execute or render as trusted HTML. Links should be restricted so unsafe schemes such as `javascript:` are not clickable.

## Architecture

Add a small Wiki markdown rendering component in the frontend, used by `WikiPage`.

Responsibilities:

- Accept a Markdown string.
- Render semantic HTML elements for Markdown.
- Map rendered elements to Material UI typography styles so the page remains visually consistent.
- Keep image rendering outside the Markdown body; entry images still come from `imageUrl` and `imageUrls`.
- Avoid `dangerouslySetInnerHTML`.

The backend data model and DynamoDB records stay unchanged.

## Data Flow

1. Backend returns Wiki entries with `body` as Markdown text.
2. `WikiPage` renders title and entry images as it does today.
3. `WikiPage` passes `entry.body` to the Markdown renderer.
4. The renderer outputs readable formatted content.

Admin editing remains plain Markdown text. This is acceptable because the request is about player-facing readability, not building a rich text editor.

## Safety and Error Handling

The renderer should treat unsupported or malformed Markdown as text, not as executable HTML.

If Markdown rendering fails unexpectedly, the page should still show the raw text rather than hiding the entry. This fallback should be local to the renderer and not swallow API loading errors.

Unsafe links should be disabled or rendered as plain text.

## Testing

Frontend tests should cover:

- `**bold**` is not displayed with raw asterisks and renders as emphasis.
- Bullet lists render as list items instead of raw `-` lines.
- Headings inside body render as headings smaller than the entry title.
- Unsafe HTML or `javascript:` links do not become executable/clickable HTML.
- Existing Wiki image rendering still works with `imageUrls`.

No backend migration is required. Existing backend tests should continue to pass.

## Out of Scope

- Rewriting the encyclopedia source content.
- Adding a rich text editor to Admin.
- Supporting arbitrary embedded HTML.
- Changing section structure or lore content.
