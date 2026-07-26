# Player House Public History Design

## Goal

Add the three player-created Houses to the public Valdren wiki as readable lore.

## Scope

The public wiki gains three entries in the `casas` section:

- `Casa Do Ouro`
- `Casa Solarion`
- `Casa Khazdrun`

Each entry uses the player-submitted history as source material, then rewrites it into clearer public lore. The entries must not expose private mechanics, including weaknesses, attributes, resources, numeric values, or strategic limits. The Casa Do Ouro entry receives extra history because the submitted version only said that miners, jewelers, and smiths made fortunes there.

## Implementation

Update `shared/src/defaultWiki.ts` so future wiki seeds include the three Houses. Add a regression test in `backend/src/db/wiki.test.ts` because the backend imports the shared content package during wiki seeding. After the source content is correct, update the live DynamoDB wiki so the already deployed campaign shows the entries now.

## Acceptance criteria

The public wiki contains the three player House backgrounds in the `casas` section. The text reads like story, not a character sheet. No public entry mentions weaknesses, attributes, resources, wealth score, soldier score, control score, or specialty labels.
