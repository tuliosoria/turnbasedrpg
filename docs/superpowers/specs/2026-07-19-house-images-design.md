# House images on the creation page (/criar)

## Goal

Let players give their House a small gallery of images while they create it at
`/criar`. Players can add images two ways: upload files from their computer, or
generate images with AI derived from the House they are building. The gallery
holds up to five images and is entirely optional (a House can be founded with
none). The gallery is shown on the creation review step and on the player's own
game screen.

## Decisions

- Gallery cap: up to 5 images, all optional.
- Upload flow: the browser holds compressed images in memory during the wizard
  (from both file uploads and AI generation) and sends them in the create
  request. The backend uploads them to S3 and stores the URLs on the House.
- AI prompt: auto-derived from the House being built (name, description,
  emblem). One button, no typing.
- Rate limit for AI generation: 5 generations per hour per IP.
- Display locations: creation review step and the player's own game screen.
  Not shown in the admin panel or to other players.

## Data model (shared)

- Add `imageUrls?: string[]` to the `House` type. Optional, backward compatible
  with existing DynamoDB rows.
- `CreateHouseInput` gains `images?: string[]`: up to 5 base64 data strings
  (the compressed images the browser holds). Validation: at most 5 entries,
  each within a byte cap (reject oversized payloads).

## Backend

### Image storage

- Add `uploadHouseImage(houseId, index, body)` to `ImageStore`
  (`backend/src/storage/images.ts`). S3 key `houses/{houseId}/{index}.png`,
  ContentType `image/png`, immutable cache. Returns the public URL
  (`{baseUrl}/{key}?v={Date.now()}`), same shape as `uploadTurnImage`.

### Create house with images

- In `createAccountAndHouse` (public, `backend/src/routes/publicRoutes.ts`) and
  admin `createHouse` (`backend/src/routes/adminRoutes.ts`): after the House row
  exists and has an id, decode each base64 entry in `input.images`, upload each
  via `uploadHouseImage`, collect the URLs into `house.imageUrls`, then persist.
- If image dependencies are missing (`deps.imageStore` undefined), images are
  skipped and the House is still created normally. Founding never fails because
  of images.
- Validate the `images` array (count and per-item size) before uploading.

### AI generation endpoint

- New public endpoint `POST /api/house-image/generate`.
- Body: `{ name, description, emblem }`.
- Builds the prompt with a new `buildHouseImagePrompt(name, description, emblem)`
  helper (heraldic/House portrait framing, Valdren tone). Calls the existing
  `gpt-image-1` image function (`backend/src/ai/images.ts`).
- Returns `{ image: <base64> }` for client-side preview. The client resizes it
  and holds it like an uploaded image; it is only persisted if the House is
  founded.
- Returns `IMAGE_DISABLED` (503) if the image function is not configured.

### Rate limiting

- Per-IP counter stored in DynamoDB (the existing `ravenloft-game` table).
- Item key scheme: partition on a rate-limit namespace, e.g.
  `ratelimit#house-image#{ip}` for the current hour window, with an integer
  `count` and a DynamoDB `ttl` set to the end of the window so items expire
  automatically.
- On each generate call: increment the counter for the caller's IP; if the
  count exceeds 5 within the hour, return `RATE_LIMITED` (429) without calling
  the image API.
- IP is taken from the API Gateway request context source IP.
- In-memory counters are not used because they do not survive across Lambda
  instances.

## Frontend

### Wizard step

- Add a step "Imagens da Casa" to the `/criar` wizard
  (`frontend/src/pages/CreateHousePage.tsx`), after the Identidade step.
- The step is optional: the player can continue with zero images.
- File picker: multi-select, images only. Each selected file is resized and
  compressed in the browser via a canvas helper (max ~1024px on the long edge)
  and added to an in-memory gallery as a data string.
- "Gerar com IA" button: posts the current name, description, and emblem to the
  generate endpoint, resizes the returned image with the same canvas helper, and
  adds it to the gallery. The button is disabled while a generation is in
  flight. Rate-limit and disabled errors are shown inline near the button.
- Gallery preview grid: each thumbnail has a remove (x) control. The cap of 5 is
  enforced: when the gallery is full, both the file picker and the generate
  button are disabled.

### Create request

- On "Fundar a Casa", the held images are sent in the create request as
  `images`. No separate upload round trip.

### Display

- Render the gallery on the creation review step and on the player's own House
  section of the game screen. Not shown in the admin panel or to other players.

### API client wiring

- Add a `generateHouseImage({ name, description, emblem })` method to the
  `ApiClient` interface (`frontend/src/api/client.ts`), implemented in
  `httpClient` and `mockClient`.
- Extend the create-house call to carry `images`.

## Testing

### Backend

- `uploadHouseImage` produces the expected S3 key and returns the public URL.
- `createAccountAndHouse` and admin `createHouse` with images: images uploaded,
  `imageUrls` set on the House; with no images: `imageUrls` empty/undefined;
  with `imageStore` missing: images skipped, House still created.
- Image array validation: rejects more than 5 images and oversized items.
- Generate endpoint: success returns base64; returns `RATE_LIMITED` after the
  6th call within the window for the same IP; returns `IMAGE_DISABLED` when the
  image function is absent.
- `buildHouseImagePrompt` includes the House name and reflects emblem/tone.

### Frontend

- Canvas resize helper caps dimensions and returns a data string.
- Gallery add, remove, and cap enforcement (picker and generate disabled at 5).
- AI-generate button disabled state while generating and inline error on
  `RATE_LIMITED` / `IMAGE_DISABLED`.
- Create request includes the held images.
- `mockClient`, `httpClient`, and the `ApiClient` interface expose
  `generateHouseImage`.
- Gallery renders on the review step and on the player game screen.

## Out of scope

- Editing a House gallery after founding.
- Showing the gallery in the admin panel or to other players.
- Presigned S3 uploads and bucket CORS changes.
- Reordering images.
