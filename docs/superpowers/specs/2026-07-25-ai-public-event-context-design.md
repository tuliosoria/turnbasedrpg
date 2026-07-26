# AI public event context design

## Goal

Improve the admin button "Rascunhar evento público com IA" so the generated event continues the campaign instead of sounding isolated.

## Current behavior

When the admin clicks the button today, the backend route `draftPublicEvent` checks that the active turn is in `DRAFT` status, then calls OpenAI with:

- the fixed campaign premise from `backend/src/ai/prompts.ts`
- the World Bible lore field, when present
- a chronicle made only from resolved turn public results
- the current House list with name, id, attributes, specialty and weakness

It does not include the full player-created House backgrounds, leaders, castles, towns, current public Wiki, private turn information, submitted player orders, private House results, discoveries, or attribute changes from recent turns.

## Desired behavior

The public event AI prompt should receive a richer context packet:

1. The campaign premise and World Bible lore.
2. Every active House in the game, including name, motto, leader, heir, castle, towns, history, specialty, weakness and attributes.
3. The current public Wiki entries for Valdren, including the newly added House histories.
4. The last 5 turns before the active draft turn, with:
   - turn id and status
   - public event
   - private information sent to each House
   - submitted player orders
   - public result
   - private House results
   - attribute changes
   - discoveries

The generated event remains a public event. The prompt must explicitly say that private information is memory for continuity only. The model must not directly reveal private information, player orders, private consequences, secrets, hidden discoveries, or GM-only truth in the public event.

## Architecture

Create a focused context builder in the backend AI layer, most likely in `backend/src/ai/prompts.ts` unless it grows too large. The builder should format the public event context as plain Portuguese sections that are easy to inspect in tests:

- `ENREDO`
- `CASAS EM JOGO`
- `WIKI PÚBLICA`
- `ÚLTIMOS 5 TURNOS`
- `REGRA DE SIGILO`

The route `draftPublicEvent` should load the same data it already loads plus Wiki entries and submissions for the recent turns. It should pass the context packet into `buildPublicEventPrompt`. The OpenAI response shape does not change: `{ "publicEvent": string }`.

## Data flow

1. Admin clicks "Rascunhar evento público com IA".
2. Frontend calls the existing admin API endpoint.
3. Backend confirms admin auth, AI availability and active `DRAFT` turn.
4. Backend loads Houses, turns, World Bible, public Wiki and submissions for the last 5 previous turns.
5. Backend builds the prompt with the richer context.
6. OpenAI returns JSON with `publicEvent`.
7. Backend returns the draft to the frontend without saving it automatically.

## Privacy and continuity rule

The prompt should let the model use private material for continuity, but not quote it as public knowledge. Good behavior:

- If a House secretly lost influence last turn, the next public event can show instability around its territory.
- If a player ordered a covert expedition, the next public event can show rumors, missing scouts or indirect signs.
- If a private discovery revealed a hidden threat, the event can foreshadow pressure without naming the secret.

Bad behavior:

- "A Casa Solarion secretly ordered..."
- "Khazdrun's private result says..."
- "The hidden discovery is..."
- Directly naming GM-only truths that players have not uncovered.

## Testing

Add tests for:

- `buildPublicEventPrompt` includes House backgrounds, public Wiki and the last 5 turn packet.
- private continuity data is labeled as private memory, not public fact.
- `draftPublicEvent` loads Wiki entries and submissions for recent turns before calling the chat function.
- only the last 5 previous turns are included.
- the response still returns `{ publicEvent }` and does not persist the draft automatically.

## Deployment

This is a backend prompt improvement. After tests pass, build and deploy the backend so the admin button uses the richer prompt in production. No frontend UI change is required.
