# Mage Portraits Wiki Design

## Goal

Generate and publish illustrations for the twenty-seven fully initiated mages of the Ordem dos Três, using the existing Valdren visual style and the canonical mage lore.

The public Wiki should show each mage as an individual card under `Os Magos`, with a portrait and a concise canonical summary, while keeping the existing long-form entry `Os Vinte e Sete Magos da Ordem dos Três`.

## Canonical Source

Use `/Users/jessicarosa/Downloads/OS_27_MAGOS_DA_ORDEM_DOS_TRES.md` as the canonical text source.

The source contains the exact public lore for the Trino, the seven Grandes Arquimagos, and the nineteen Magos Plenos. The implementation should extract exactly twenty-seven mage identities counted by the Order. The three voices of Maelor Véspera are part of the Trino entry and should not become separate portrait entries.

## Visual Direction

Every prompt should follow the established Valdren image style:

- dark fantasy
- Ravenloft
- medieval gothic
- cinematic digital painting
- cold tones
- mist, snow, dramatic lighting
- consistent costumes, faces, architecture, and atmosphere

Each mage prompt should add mage-specific visual details from the canonical text: name, title/function, color/refraction, origin, personality, powers, habitual price, political position, and symbol when present.

The prompt must not invent biography, events, relationships, or secret lore. It may translate canonical details into visual direction.

## Generation Workflow

Use a local batch generation flow before publication:

1. Parse the canonical Markdown.
2. Build one prompt for each of the twenty-seven mages.
3. Call the OpenAI image API using the same image model family already used by the backend.
4. Save generated PNG files into a local review directory.
5. Write a manifest containing mage name, slug, source excerpt, prompt, and local image file.
6. Let the user review images and request rerolls before publication.

This review-first workflow prevents weak or incorrect portraits from being published automatically.

## Publication Workflow

After the user approves the generated images:

1. Copy approved PNG files into `frontend/public/mages`.
2. Update the Wiki generator so `Os Magos` includes:
   - the existing long-form canonical entry
   - twenty-seven additional mage portrait entries, one per mage
3. Each portrait entry should include:
   - title: mage name
   - section: `os-magos`
   - body: concise canonical summary extracted from the source
   - imageUrl: `/mages/<slug>.png`
4. Regenerate `shared/src/defaultWiki.ts`.
5. Replace the live Wiki.
6. Build and deploy the frontend.

The long-form entry remains the first entry in the section. Portrait cards follow it in source order.

## Storage

Use committed static assets under `frontend/public/mages` for approved portraits. This matches the current static image pattern used by Wiki house images and avoids requiring a new backend upload endpoint for this batch.

The local review directory should not be committed. Generated review artifacts are temporary until approved.

## Error Handling

The generation script should fail loudly when:

- the canonical source file is missing
- fewer or more than twenty-seven mage identities are extracted
- OpenAI image generation fails for a mage
- an expected approved image file is missing during Wiki generation

The script should support rerunning individual mages without regenerating all twenty-seven portraits.

## Testing

Tests should cover:

- extracting exactly twenty-seven mage identities
- not treating Serath, Ilyon, or Veyra as separate mage portrait entries
- stable slug generation for mage image filenames
- prompt content includes the global Valdren visual style and mage-specific canonical fields
- generated Wiki defaults include portrait entries under `os-magos`
- portrait entries include `/mages/*.png` image URLs
- Wiki rendering still displays entry images above Markdown body text

## Out of Scope

- Building a permanent Admin UI for mage image generation.
- Generating separate portraits for the three voices of the Trino.
- Rewriting mage lore.
- Publishing unreviewed images automatically.
- Adding captions per image beyond the entry title/body already rendered by the Wiki.
