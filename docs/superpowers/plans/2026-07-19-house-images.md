# House Images on the Creation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players attach up to five optional images (uploaded or AI-generated) to their House while creating it at `/criar`, shown on the review step and the player game screen.

**Architecture:** The browser holds compressed images (data URLs) during the wizard and sends them in the create request; the backend uploads them to S3 and stores `imageUrls` on the House. AI generation is a public, IP-rate-limited endpoint that returns a data URL for preview.

**Tech Stack:** TypeScript monorepo (shared/backend/frontend), AWS Lambda + DynamoDB + S3, OpenAI `gpt-image-1`, React + MUI + Vitest.

**Deploy note (from prior features):** shared changes require rebuilding shared (`npm run build --workspace shared`) then redeploying the backend (SAM) and frontend (Amplify). Both deploys are manual. Do them only after all tasks pass.

---

## File Structure

**shared**
- Modify `shared/src/types.ts` — add `imageUrls?: string[]` to `House`.

**backend**
- Modify `backend/src/types/domain.ts` — add `sourceIp?: string` to `HandlerRequest`.
- Modify `backend/src/handler.ts` — populate `sourceIp` from the event.
- Modify `backend/src/storage/images.ts` — add `uploadHouseImage`.
- Modify `backend/src/keys.ts` — add `rateLimitPk`.
- Create `backend/src/db/rateLimit.ts` — atomic per-window counter with TTL.
- Modify `backend/src/db/houses.ts` — add `setHouseImages` (update house `imageUrls`).
- Modify `backend/src/validation/schemas.ts` — add `parseImagesField`, thread into create bodies, add `parseHouseImageGenerateBody`.
- Modify `backend/src/ai/prompts.ts` — add `buildHouseImagePrompt`.
- Modify `backend/src/routes/publicRoutes.ts` — upload images in `createAccountAndHouse`; add `generateHouseImage` endpoint with rate limiting.
- Modify `backend/src/routes/adminRoutes.ts` — upload images in `createHouse`.
- Modify `backend/src/router.ts` — register `POST /api/house-image/generate`.

**frontend**
- Modify `frontend/src/types/api.ts` — `images?` on `CreateHouseInput`, `RATE_LIMITED` error code.
- Modify `frontend/src/api/client.ts` — add `generateHouseImage` to `ApiClient`.
- Modify `frontend/src/api/httpClient.ts` — implement `generateHouseImage`, add `RATE_LIMITED` to the code set.
- Modify `frontend/src/api/mockClient.ts` — implement `generateHouseImage`, carry `imageUrls` in `makeHouse`.
- Create `frontend/src/utils/imageResize.ts` — pure `computeTargetSize` + DOM resize helpers.
- Modify `frontend/src/pages/CreateHousePage.tsx` — new "Imagens da Casa" step + review gallery.
- Modify `frontend/src/pages/GamePage.tsx` — render the House gallery.

---

## Task 1: House gains an image gallery field (shared)

**Files:**
- Modify: `shared/src/types.ts:31-45`

- [ ] **Step 1: Add the field**

In the `House` interface, after `createdAt: string;` add:

```typescript
  createdAt: string;
  imageUrls?: string[];
```

- [ ] **Step 2: Rebuild shared**

Run: `npm run build --workspace shared`
Expected: builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts shared/dist
git commit -m "feat: add optional imageUrls to House type"
```

---

## Task 2: Request carries the caller IP (backend)

**Files:**
- Modify: `backend/src/types/domain.ts` (`HandlerRequest`)
- Modify: `backend/src/handler.ts`

- [ ] **Step 1: Add sourceIp to HandlerRequest**

In `backend/src/types/domain.ts`, add to `HandlerRequest`:

```typescript
export interface HandlerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  pathParams: Record<string, string>;
  sourceIp?: string;
}
```

- [ ] **Step 2: Populate it in the handler**

In `backend/src/handler.ts`, in the `req` object literal add the field:

```typescript
  const req: HandlerRequest = {
    method,
    path: event.rawPath,
    headers: event.headers ?? {},
    body,
    pathParams: {},
    sourceIp: event.requestContext.http.sourceIp,
  };
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/types/domain.ts backend/src/handler.ts
git commit -m "feat: expose request source IP to handlers"
```

---

## Task 3: ImageStore can upload House images

**Files:**
- Modify: `backend/src/storage/images.ts`
- Test: `backend/src/storage/images.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/src/storage/images.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

import { makeImageStore } from "./images";

describe("uploadHouseImage", () => {
  it("uploads under the house key and returns a versioned url", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadHouseImage("casa-vargen-ab12", 2, Buffer.from("x"));
    expect(url).toMatch(/^https:\/\/cdn\.example\/houses\/casa-vargen-ab12\/2\.png\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; Bucket: string } };
    expect(call.input.Key).toBe("houses/casa-vargen-ab12/2.png");
    expect(call.input.Bucket).toBe("my-bucket");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/storage/images.test.ts`
Expected: FAIL (`uploadHouseImage` is not a function).

- [ ] **Step 3: Implement uploadHouseImage**

In `backend/src/storage/images.ts`, extend the interface and the returned object:

```typescript
export interface ImageStore {
  uploadTurnImage(kind: TurnImageKind, turnId: number, body: Buffer): Promise<string>;
  uploadHouseImage(houseId: string, index: number, body: Buffer): Promise<string>;
}
```

Inside `makeImageStore`'s returned object, add after `uploadTurnImage`:

```typescript
    async uploadHouseImage(houseId, index, body) {
      const key = `houses/${houseId}/${index}.png`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "image/png",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
      return `${baseUrl}/${key}?v=${Date.now()}`;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/storage/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storage/images.ts backend/src/storage/images.test.ts
git commit -m "feat: add uploadHouseImage to ImageStore"
```

---

## Task 4: Persist imageUrls on an existing house

**Files:**
- Modify: `backend/src/db/houses.ts`
- Test: `backend/src/db/houses.test.ts` (add a test)

- [ ] **Step 1: Write the failing test**

Add to `backend/src/db/houses.test.ts` (match the file's existing import/mocked-doc style; use a `send` spy). Append this describe block:

```typescript
import { setHouseImages } from "./houses";

describe("setHouseImages", () => {
  it("writes imageUrls to the house row", async () => {
    const send = vi.fn().mockResolvedValue({});
    const doc = { send } as any;
    await setHouseImages(doc, "tbl", "winter-dead", "casa-1", ["u1", "u2"]);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.UpdateExpression).toContain("imageUrls");
    expect(cmd.input.ExpressionAttributeValues[":imageUrls"]).toEqual(["u1", "u2"]);
  });
});
```

(If `houses.test.ts` already imports `vi`/`describe`, do not re-import; just add the `import { setHouseImages }` at the top with the other imports and append the describe block.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/houses.test.ts`
Expected: FAIL (`setHouseImages` is not exported).

- [ ] **Step 3: Implement setHouseImages**

In `backend/src/db/houses.ts`, add:

```typescript
export async function setHouseImages(
  doc: DynamoDBDocumentClient, tableName: string, campaignId: string, houseId: string, imageUrls: string[],
): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: campaignPk(campaignId), SK: houseSk(houseId) },
    UpdateExpression: "SET imageUrls = :imageUrls",
    ExpressionAttributeValues: { ":imageUrls": imageUrls },
  }));
}
```

Also update `toHouse` to carry the field so reads return it:

```typescript
    attributes: item.attributes as Attributes, createdAt: item.createdAt as string,
    imageUrls: (item.imageUrls as string[] | undefined),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/houses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/houses.ts backend/src/db/houses.test.ts
git commit -m "feat: persist and read House imageUrls"
```

---

## Task 5: Per-IP rate limit counter (DynamoDB)

**Files:**
- Modify: `backend/src/keys.ts`
- Create: `backend/src/db/rateLimit.ts`
- Test: `backend/src/db/rateLimit.test.ts` (create)

- [ ] **Step 1: Add the key helper**

In `backend/src/keys.ts`, add:

```typescript
export function rateLimitPk(bucketKey: string): string {
  return `RATELIMIT#${bucketKey}`;
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/db/rateLimit.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { hitRateLimit } from "./rateLimit";

describe("hitRateLimit", () => {
  it("increments the current window counter and returns the new count", async () => {
    const send = vi.fn().mockResolvedValue({ Attributes: { count: 3 } });
    const doc = { send } as any;
    const now = 1_800_000_000_000; // fixed ms
    const count = await hitRateLimit(doc, "tbl", "house-image#1.2.3.4", 3600, now);
    expect(count).toBe(3);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.UpdateExpression).toContain("ADD");
    expect(cmd.input.Key.PK).toContain("RATELIMIT#house-image#1.2.3.4");
    expect(typeof cmd.input.ExpressionAttributeValues[":ttl"]).toBe("number");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run src/db/rateLimit.test.ts`
Expected: FAIL (module/function missing).

- [ ] **Step 4: Implement rateLimit**

Create `backend/src/db/rateLimit.ts`:

```typescript
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { rateLimitPk } from "../keys";

/**
 * Atomically increments the counter for `bucketKey` in the current fixed-length
 * window and returns the resulting count. Items carry a DynamoDB `ttl` (epoch
 * seconds) so they self-expire after the window ends.
 */
export async function hitRateLimit(
  doc: DynamoDBDocumentClient,
  tableName: string,
  bucketKey: string,
  windowSeconds: number,
  nowMs: number = Date.now(),
): Promise<number> {
  const windowStart = Math.floor(nowMs / (windowSeconds * 1000));
  const ttl = (windowStart + 1) * windowSeconds;
  const res = await doc.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: rateLimitPk(bucketKey), SK: `W#${windowStart}` },
    UpdateExpression: "ADD #count :one SET #ttl = :ttl",
    ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
    ExpressionAttributeValues: { ":one": 1, ":ttl": ttl },
    ReturnValues: "UPDATED_NEW",
  }));
  return (res.Attributes?.count as number | undefined) ?? 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run src/db/rateLimit.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/keys.ts backend/src/db/rateLimit.ts backend/src/db/rateLimit.test.ts
git commit -m "feat: DynamoDB per-window rate limit counter"
```

---

## Task 6: Validation for images and the generate body

**Files:**
- Modify: `backend/src/validation/schemas.ts`
- Test: `backend/src/validation/schemas.test.ts` (add tests if the file exists; otherwise create)

- [ ] **Step 1: Write the failing test**

Create/append `backend/src/validation/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseImagesField, parseHouseImageGenerateBody } from "./schemas";

const dataUrl = (n: number) => "data:image/png;base64," + "A".repeat(n);

describe("parseImagesField", () => {
  it("returns [] when absent", () => {
    expect(parseImagesField({})).toEqual([]);
  });
  it("accepts up to 5 valid data urls", () => {
    const imgs = [dataUrl(10), dataUrl(10)];
    expect(parseImagesField({ images: imgs })).toEqual(imgs);
  });
  it("rejects more than 5", () => {
    expect(() => parseImagesField({ images: Array(6).fill(dataUrl(10)) })).toThrow();
  });
  it("rejects non-image or oversized entries", () => {
    expect(() => parseImagesField({ images: ["notadataurl"] })).toThrow();
    expect(() => parseImagesField({ images: [dataUrl(3_000_000)] })).toThrow();
  });
});

describe("parseHouseImageGenerateBody", () => {
  it("parses name, description, emblem", () => {
    const out = parseHouseImageGenerateBody({
      name: "Casa Vargen", description: "Uma casa antiga do norte.",
      emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" },
    });
    expect(out.name).toBe("Casa Vargen");
    expect(out.emblem.icon).toBe("lobo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/validation/schemas.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement the validators**

In `backend/src/validation/schemas.ts`, add (the `parseEmblem` helper already exists in this file; reuse it):

```typescript
const MAX_IMAGE_CHARS = 2_800_000; // ~2MB after base64 inflation
const MAX_IMAGES = 5;

export function parseImagesField(o: Record<string, unknown>): string[] {
  const raw = o.images;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "INVALID_BODY", "images deve ser uma lista.");
  if (raw.length > MAX_IMAGES) throw new HttpError(400, "INVALID_BODY", "Máximo de 5 imagens.");
  return raw.map((v) => {
    if (typeof v !== "string" || !v.startsWith("data:image/")) {
      throw new HttpError(400, "INVALID_BODY", "Imagem inválida.");
    }
    if (v.length > MAX_IMAGE_CHARS) throw new HttpError(400, "INVALID_BODY", "Imagem muito grande.");
    return v;
  });
}

export function parseHouseImageGenerateBody(body: unknown): { name: string; description: string; emblem: Emblem } {
  const o = asObject(body);
  return {
    name: str(o, "name", 60),
    description: str(o, "description", 2000, false),
    emblem: parseEmblem(o.emblem),
  };
}
```

Then thread `images` into the two create parsers. In `parseCreateHouseBody`, add to the returned object:

```typescript
    specialty: str(o, "specialty", 500), weakness: str(o, "weakness", 500), attributes: parseAttributes(o.attributes),
    images: parseImagesField(o),
```

In `parseAdminCreateHouseBody`, add:

```typescript
  return {
    displayName: str(o, "displayName", 40),
    ...parseHouseFields(o),
    attributes: parseAdminAttributes(o.attributes),
    images: parseImagesField(o),
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/validation/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/validation/schemas.test.ts
git commit -m "feat: validate house images and generate body"
```

---

## Task 7: House image prompt builder

**Files:**
- Modify: `backend/src/ai/prompts.ts`
- Test: `backend/src/ai/prompts.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

Append to `backend/src/ai/prompts.test.ts`:

```typescript
import { buildHouseImagePrompt } from "./prompts";

describe("buildHouseImagePrompt", () => {
  const emblem = { icon: "lobo" as const, color1: "#3f3f46", color2: "#1e3a5f" };
  it("includes the house name, emblem icon and description", () => {
    const prompt = buildHouseImagePrompt("Casa Vargen", "Guardiões do norte gelado.", emblem);
    expect(prompt).toContain("Casa Vargen");
    expect(prompt.toLowerCase()).toContain("lobo");
    expect(prompt).toContain("Guardiões do norte gelado.");
  });
  it("works without a description", () => {
    const prompt = buildHouseImagePrompt("Casa Sem Texto", "", emblem);
    expect(prompt).toContain("Casa Sem Texto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/ai/prompts.test.ts`
Expected: FAIL (`buildHouseImagePrompt` missing).

- [ ] **Step 3: Implement the builder**

In `backend/src/ai/prompts.ts`, add an import at the top (extend the existing `@ravenloft/content` import) for `emblemColorName`, then add the function. The file already imports `DEFAULT_IMAGE_DIRECTIVES`.

```typescript
import { emblemColorName, type Emblem } from "@ravenloft/content";

export function buildHouseImagePrompt(name: string, description: string, emblem: Emblem): string {
  const colors = `${emblemColorName(emblem.color1)} e ${emblemColorName(emblem.color2)}`;
  const desc = description.trim();
  return [
    "DIRETRIZES DE ESTILO (siga rigorosamente):",
    DEFAULT_IMAGE_DIRECTIVES,
    "",
    "CENA A ILUSTRAR (brasão/retrato heráldico de uma Grande Casa de Valdren):",
    `Casa: ${name}`,
    `Emblema: ${emblem.icon}, cores ${colors}.`,
    desc ? `Descrição: ${desc}` : "Sem descrição fornecida.",
    "Componha uma ilustração sombria e cinematográfica que represente a identidade desta Casa.",
  ].join("\n");
}
```

Note: if `Emblem` or `emblemColorName` is already imported in this file, merge into the existing import instead of adding a duplicate line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/ai/prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/prompts.ts backend/src/ai/prompts.test.ts
git commit -m "feat: buildHouseImagePrompt for House heraldry"
```

---

## Task 8: Upload images on house creation + public generate endpoint

**Files:**
- Modify: `backend/src/routes/publicRoutes.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Test: `backend/src/routes/publicRoutes.test.ts`

Helper first, then wiring. The create parsers now return `images: string[]`. On create we (a) create the house as today, (b) if `images.length` and `imageStore` present, decode each data URL and upload, (c) `setHouseImages`.

- [ ] **Step 1: Write the failing test (create with images)**

In `backend/src/routes/publicRoutes.test.ts`, extend the mock for `../db/houses` to also export `setHouseImages: vi.fn()`, then add a test. Update the `vi.mock("../db/houses", ...)`:

```typescript
vi.mock("../db/houses", () => ({
  createAccountAndHouse: vi.fn(),
  setHouseImages: vi.fn(),
}));
vi.mock("../db/rateLimit", () => ({ hitRateLimit: vi.fn() }));
```

Add:

```typescript
import * as rateLimitDb from "../db/rateLimit";

describe("createAccountAndHouse with images", () => {
  it("uploads each image and stores the urls", async () => {
    (housesDb.createAccountAndHouse as any).mockResolvedValue({ houseId: "casa-1" });
    const uploadHouseImage = vi.fn()
      .mockResolvedValueOnce("https://cdn/houses/casa-1/0.png")
      .mockResolvedValueOnce("https://cdn/houses/casa-1/1.png");
    const depsImg = { ...deps, imageStore: { uploadHouseImage } as any, image: vi.fn() };
    const body = { ...createBody, images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"] };
    await createAccountAndHouse(depsImg, req({ method: "POST", path: "/api/create-account", body }) as any);
    expect(uploadHouseImage).toHaveBeenCalledTimes(2);
    expect(housesDb.setHouseImages).toHaveBeenCalledWith(
      expect.anything(), "ravenloft-game", "winter-dead", "casa-1",
      ["https://cdn/houses/casa-1/0.png", "https://cdn/houses/casa-1/1.png"],
    );
  });

  it("skips images when imageStore is absent", async () => {
    (housesDb.createAccountAndHouse as any).mockResolvedValue({ houseId: "casa-2" });
    const body = { ...createBody, images: ["data:image/png;base64,AAA"] };
    await createAccountAndHouse(deps, req({ method: "POST", path: "/api/create-account", body }) as any);
    expect(housesDb.setHouseImages).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/publicRoutes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the upload helper + wiring**

In `backend/src/routes/publicRoutes.ts`, add imports:

```typescript
import { createAccountAndHouse as dbCreateAccountAndHouse, setHouseImages } from "../db/houses";
import { hitRateLimit } from "../db/rateLimit";
import { buildHouseImagePrompt } from "../ai/prompts";
import { parseCreateHouseBody, parseLoginBody, parseHouseImageGenerateBody } from "../validation/schemas";
```

Add a shared decode/upload helper (also used by admin route — export it):

```typescript
function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

export async function uploadHouseImages(deps: Deps, houseId: string, images: string[]): Promise<void> {
  if (!deps.imageStore || images.length === 0) return;
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    urls.push(await deps.imageStore.uploadHouseImage(houseId, i, dataUrlToBuffer(images[i])));
  }
  await setHouseImages(deps.doc, deps.config.tableName, deps.config.campaignId, houseId, urls);
}
```

In `createAccountAndHouse`, after `const { houseId } = await dbCreateAccountAndHouse(...)` and before building the token, add:

```typescript
  await uploadHouseImages(deps, houseId, input.images);
```

Add the generate endpoint at the end of the file:

```typescript
const HOUSE_IMAGE_LIMIT = 5;
const HOUSE_IMAGE_WINDOW_SECONDS = 3600;

export async function generateHouseImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  if (!deps.image) throw new HttpError(503, "IMAGE_DISABLED", "Geração de imagens não configurada.");
  const ip = req.sourceIp || "unknown";
  const count = await hitRateLimit(deps.doc, deps.config.tableName, `house-image#${ip}`, HOUSE_IMAGE_WINDOW_SECONDS);
  if (count > HOUSE_IMAGE_LIMIT) {
    throw new HttpError(429, "RATE_LIMITED", "Limite de gerações por hora atingido. Tente novamente mais tarde.");
  }
  const { name, description, emblem } = parseHouseImageGenerateBody(req.body);
  const prompt = buildHouseImagePrompt(name, description, emblem);
  const buffer = await deps.image(prompt);
  return { status: 200, body: { image: `data:image/png;base64,${buffer.toString("base64")}` } };
}
```

- [ ] **Step 4: Wire admin createHouse**

In `backend/src/routes/adminRoutes.ts`, find `createHouse`. The admin create parser now returns `images`. After the house is created and its `houseId` known, call the shared helper. Add import:

```typescript
import { uploadHouseImages } from "./publicRoutes";
```

and after the house creation line inside `createHouse` add:

```typescript
  await uploadHouseImages(deps, houseId, body.images);
```

(Use the actual variable name the function uses for the created id and the parsed body; if the parsed body variable is named `body`, `body.images` is correct.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/publicRoutes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/publicRoutes.ts backend/src/routes/adminRoutes.ts backend/src/routes/publicRoutes.test.ts
git commit -m "feat: upload House images on create + public generate endpoint"
```

---

## Task 9: Register the generate route + rate-limit/disabled tests

**Files:**
- Modify: `backend/src/router.ts`
- Test: `backend/src/routes/publicRoutes.test.ts`

- [ ] **Step 1: Write failing tests for the endpoint states**

Append to `backend/src/routes/publicRoutes.test.ts`:

```typescript
import { generateHouseImage } from "./publicRoutes";

describe("generateHouseImage", () => {
  const genBody = { name: "Casa Vargen", description: "Norte.", emblem: createBody.emblem };

  it("returns IMAGE_DISABLED when no image fn", async () => {
    await expect(generateHouseImage(deps, req({ method: "POST", body: genBody }) as any))
      .rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
  });

  it("returns a data url on success", async () => {
    (rateLimitDb.hitRateLimit as any).mockResolvedValue(1);
    const image = vi.fn().mockResolvedValue(Buffer.from("img"));
    const d = { ...deps, image };
    const res = await generateHouseImage(d, req({ method: "POST", body: genBody, sourceIp: "1.2.3.4" }) as any);
    expect(res.status).toBe(200);
    expect((res.body as any).image).toMatch(/^data:image\/png;base64,/);
  });

  it("returns RATE_LIMITED after the limit", async () => {
    (rateLimitDb.hitRateLimit as any).mockResolvedValue(6);
    const d = { ...deps, image: vi.fn() };
    await expect(generateHouseImage(d, req({ method: "POST", body: genBody, sourceIp: "1.2.3.4" }) as any))
      .rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes appropriately**

Run: `cd backend && npx vitest run src/routes/publicRoutes.test.ts`
Expected: PASS (handler already implemented in Task 8). If any fail, fix the handler.

- [ ] **Step 3: Register the route**

In `backend/src/router.ts`, import `generateHouseImage` from `./routes/publicRoutes` (extend the existing publicRoutes import) and add to `routes`:

```typescript
  r("POST", "/api/house-image/generate", generateHouseImage),
```

- [ ] **Step 4: Typecheck + full backend tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/router.ts backend/src/routes/publicRoutes.test.ts
git commit -m "feat: register public house-image generate route"
```

---

## Task 10: Frontend types + error code

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/httpClient.ts`

- [ ] **Step 1: Add images to CreateHouseInput and the new error code**

In `frontend/src/types/api.ts`, add to `CreateHouseInput` after `attributes: Attributes;`:

```typescript
  attributes: Attributes;
  images?: string[];
```

In the `ApiErrorCode` union add `"RATE_LIMITED"` (e.g. after `"IMAGE_ERROR"`):

```typescript
  | "IMAGE_ERROR"
  | "RATE_LIMITED"
```

- [ ] **Step 2: Add to httpClient code set**

In `frontend/src/api/httpClient.ts`, add `"RATE_LIMITED"` to the `API_ERROR_CODES` set (after `"IMAGE_ERROR"`).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/api/httpClient.ts
git commit -m "feat: frontend types for house images and RATE_LIMITED"
```

---

## Task 11: API client generateHouseImage (interface + http + mock)

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/httpClient.ts`
- Modify: `frontend/src/api/mockClient.ts`
- Test: `frontend/src/api/httpClient.test.ts`, `frontend/src/api/mockClient.test.ts`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/api/httpClient.test.ts`, add a test that stubs `fetch` and asserts the call. Match the file's existing fetch-mock pattern; a representative test:

```typescript
it("generateHouseImage posts to the endpoint and returns the data url", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ image: "data:image/png;base64,ZZ" }), { status: 200 }),
  );
  const client = new HttpApiClient("https://api.test");
  const out = await client.generateHouseImage({ name: "Casa", description: "d", emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" } });
  expect(out.image).toBe("data:image/png;base64,ZZ");
  expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/house-image/generate", expect.objectContaining({ method: "POST" }));
});
```

In `frontend/src/api/mockClient.test.ts`, add:

```typescript
it("generateHouseImage returns a data url", async () => {
  const client = new MockApiClient();
  const out = await client.generateHouseImage({ name: "Casa", description: "d", emblem: { icon: "lobo", color1: "#3f3f46", color2: "#1e3a5f" } });
  expect(out.image).toMatch(/^data:image\//);
});
```

(Use the actual mock client constructor/name from the file. If the mock is exported as a different symbol, match it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts src/api/mockClient.test.ts`
Expected: FAIL (`generateHouseImage` missing).

- [ ] **Step 3: Add to the interface**

In `frontend/src/api/client.ts`, import `Emblem` type (extend the `@ravenloft/content` import or import from `../types/api`), and add to `ApiClient`:

```typescript
  generateHouseImage(input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }>;
```

- [ ] **Step 4: Implement in httpClient**

In `frontend/src/api/httpClient.ts` add the method:

```typescript
  generateHouseImage(input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }> {
    return this.request<{ image: string }>("/api/house-image/generate", {
      method: "POST",
      body: input,
    });
  }
```

(Import `Emblem` from `../types/api`.)

- [ ] **Step 5: Implement in mockClient**

In `frontend/src/api/mockClient.ts`:
- In `makeHouse`, add `imageUrls: input.images ?? []` to the returned object.
- Add the method (a tiny 1x1 transparent PNG data URL constant):

```typescript
  async generateHouseImage(_input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }> {
    return { image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
  }
```

(Import `Emblem` from `../types/api` if not already imported. `makeHouse`'s `input` is `Omit<CreateHouseInput,"displayName">`, which now includes optional `images`.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/api/httpClient.test.ts src/api/mockClient.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/httpClient.test.ts frontend/src/api/mockClient.test.ts
git commit -m "feat: generateHouseImage across ApiClient implementations"
```

---

## Task 12: Client-side image resize utility

**Files:**
- Create: `frontend/src/utils/imageResize.ts`
- Test: `frontend/src/utils/imageResize.test.ts` (create)

The pure sizing math is unit-tested; the canvas/DOM part is a thin wrapper (not unit-tested under jsdom).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/imageResize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeTargetSize } from "./imageResize";

describe("computeTargetSize", () => {
  it("leaves small images unchanged", () => {
    expect(computeTargetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it("scales down by the long edge, preserving aspect ratio", () => {
    expect(computeTargetSize(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });
  it("handles portrait", () => {
    expect(computeTargetSize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/imageResize.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the utility**

Create `frontend/src/utils/imageResize.ts`:

```typescript
export interface Size { width: number; height: number; }

export function computeTargetSize(width: number, height: number, maxEdge: number): Size {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const MAX_EDGE = 1024;
const QUALITY = 0.82;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    img.src = src;
  });
}

async function resizeDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const { width, height } = computeTargetSize(img.naturalWidth, img.naturalHeight, MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export async function resizeImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
  return resizeDataUrl(dataUrl);
}

export { resizeDataUrl };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/imageResize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/imageResize.ts frontend/src/utils/imageResize.test.ts
git commit -m "feat: client-side image resize utility"
```

---

## Task 13: Image gallery step in the creation wizard

**Files:**
- Modify: `frontend/src/pages/CreateHousePage.tsx`
- Test: `frontend/src/pages/CreateHousePage.test.tsx` (create if absent; otherwise extend)

The step is inserted after "Identidade da Casa". Images are held in state as data URLs and passed to `createHouse`.

- [ ] **Step 1: Write the failing test**

Create/extend `frontend/src/pages/CreateHousePage.test.tsx`. Representative tests (adapt the render harness to the repo's existing page-test pattern: wrap in `ThemeProvider` + `MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` and an `ApiProvider` with a mock client). At minimum assert:
- The stepper shows an "Imagens da Casa" step label.
- Clicking "Gerar com IA" calls `api.generateHouseImage` and adds a thumbnail.

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { theme } from "../theme";
import { ApiProvider } from "../api/ApiProvider";
import { CreateHousePage } from "./CreateHousePage";
import type { ApiClient } from "../api/client";

function renderPage(client: Partial<ApiClient>) {
  const full = {
    getHouseExample: vi.fn().mockResolvedValue(null),
    generateHouseImage: vi.fn().mockResolvedValue({ image: "data:image/png;base64,ZZ" }),
    createAccountAndHouse: vi.fn(),
    ...client,
  } as unknown as ApiClient;
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ApiProvider client={full}>
          <CreateHousePage />
        </ApiProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
  return full;
}

describe("CreateHousePage images step", () => {
  it("shows the Imagens da Casa step", () => {
    renderPage({});
    expect(screen.getAllByText("Imagens da Casa").length).toBeGreaterThan(0);
  });
});
```

(If the repo already has a `CreateHousePage.test.tsx`, follow its exact harness helpers instead of the above and just add the new assertions. Confirm the `theme` import path and `ApiProvider` prop name by reading a sibling page test such as `GamePage.test.tsx`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/CreateHousePage.test.tsx`
Expected: FAIL (no "Imagens da Casa" step yet).

- [ ] **Step 3: Implement the step**

In `frontend/src/pages/CreateHousePage.tsx`:

1. Add imports:

```typescript
import { resizeImageFile, resizeDataUrl } from "../utils/imageResize";
```

2. Change the steps array:

```typescript
const steps = ["Conta", "Identidade da Casa", "Imagens da Casa", "Atributos", "Revisão"];
```

3. Add state near the other `useState` calls:

```typescript
  const [images, setImages] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
```

4. Add handlers inside the component:

```typescript
  const MAX_IMAGES = 5;

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    setImageError(null);
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    try {
      const resized = await Promise.all(picked.map(resizeImageFile));
      setImages((prev) => [...prev, ...resized].slice(0, MAX_IMAGES));
    } catch {
      setImageError("Não foi possível processar a imagem.");
    }
  }

  async function onGenerate() {
    if (images.length >= MAX_IMAGES) return;
    setGenLoading(true);
    setImageError(null);
    try {
      const { image } = await api.generateHouseImage({
        name: form.name,
        description: form.historyText,
        emblem: form.emblem,
      });
      const resized = await resizeDataUrl(image);
      setImages((prev) => [...prev, resized].slice(0, MAX_IMAGES));
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Não foi possível gerar a imagem.");
    } finally {
      setGenLoading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }
```

5. Renumber the step conditionals. Because the new step is index 2, shift Atributos to index 3 and Revisão to index 4. Update `canAdvance`:

```typescript
  const canAdvance =
    (activeStep === 0 && displayName.trim().length > 0 && displayName.trim().length <= 40) ||
    (activeStep === 1 && identityValid) ||
    activeStep === 2 ||
    (activeStep === 3 && attributesValidation.valid) ||
    activeStep === 4;
```

6. Update `activeStep === 2` (was Atributos) to `activeStep === 3`, and `activeStep === 3` (was Revisão) to `activeStep === 4`.

7. Insert the new step block between the Identidade block (`activeStep === 1`) and the Atributos block:

```tsx
      {activeStep === 2 && (
        <Stack spacing={2}>
          <Typography>Adicione até cinco imagens para a sua Casa. Esta etapa é opcional.</Typography>
          {imageError && <Alert severity="warning">{imageError}</Alert>}
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" component="label" disabled={images.length >= MAX_IMAGES}>
              Enviar imagens
              <input hidden type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e.target.files)} />
            </Button>
            <Button variant="outlined" disabled={genLoading || images.length >= MAX_IMAGES} onClick={onGenerate}>
              {genLoading ? "Gerando..." : "Gerar com IA"}
            </Button>
          </Stack>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {images.map((src, i) => (
              <Box key={i} sx={{ position: "relative" }}>
                <Box component="img" src={src} alt={`Imagem ${i + 1} da Casa`} sx={{ width: 120, height: 80, objectFit: "cover", borderRadius: 1, display: "block" }} />
                <Button size="small" onClick={() => removeImage(i)} sx={{ position: "absolute", top: 0, right: 0, minWidth: 0, px: 1 }}>x</Button>
              </Box>
            ))}
          </Box>
        </Stack>
      )}
```

8. In the review step, render the gallery (after the Crest block) and pass images to the create call. Update `createHouse`:

```typescript
      setResult(await api.createAccountAndHouse({ ...form, displayName: displayName.trim(), images }));
```

Add to the review step, after the name/motto `Box`:

```tsx
          {images.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {images.map((src, i) => (
                <Box key={i} component="img" src={src} alt={`Imagem ${i + 1} da Casa`} sx={{ width: 120, height: 80, objectFit: "cover", borderRadius: 1, display: "block" }} />
              ))}
            </Box>
          )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/CreateHousePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CreateHousePage.tsx frontend/src/pages/CreateHousePage.test.tsx
git commit -m "feat: image gallery step in house creation wizard"
```

---

## Task 14: Show the gallery on the game screen

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx`
- Test: `frontend/src/pages/GamePage.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/pages/GamePage.test.tsx`, extend the existing game view fixture's `house` with `imageUrls: ["https://cdn/houses/x/0.png"]` and assert an `img` with that src renders. Representative assertion:

```typescript
expect(await screen.findByAltText("Imagem 1 da Casa")).toBeInTheDocument();
```

(Add `imageUrls` to whichever mock `PlayerGameView.house` object the test builds.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: FAIL (no gallery rendered).

- [ ] **Step 3: Render the gallery**

In `frontend/src/pages/GamePage.tsx`, inside the "Sua Casa" `CardContent`, after the `Stack` that holds the Crest/attributes, add:

```tsx
            {game.house.imageUrls && game.house.imageUrls.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                {game.house.imageUrls.map((src, i) => (
                  <Box
                    key={i}
                    component="img"
                    src={src}
                    alt={`Imagem ${i + 1} da Casa`}
                    sx={{ width: 140, height: 94, objectFit: "cover", borderRadius: 1, display: "block" }}
                  />
                ))}
              </Box>
            )}
```

(Ensure `Box` is already imported in this file; it is used elsewhere for images.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/GamePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/GamePage.tsx frontend/src/pages/GamePage.test.tsx
git commit -m "feat: render House gallery on the game screen"
```

---

## Task 15: Full verification, humanizer check, deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Backend suite + typecheck**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 2: Frontend suite + typecheck + build**

Run: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass; no type errors; build succeeds.

- [ ] **Step 3: Humanizer dash check (hard constraint)**

Run: `grep -rn $'\u2014\|\u2013' frontend/src/pages/CreateHousePage.tsx frontend/src/pages/GamePage.tsx backend/src/routes/publicRoutes.ts backend/src/ai/prompts.ts`
Expected: no matches in the lines you added. (Do not introduce em/en dashes in any new user-facing text.)

- [ ] **Step 4: Deploy backend (shared changed, so redeploy required)**

Run the backend deploy sequence from the project notes:

```bash
cd backend && npm run build && source .deploy.env && rm -rf .aws-sam && sam deploy --template-file template.yaml --stack-name ravenloft-winter --region us-east-1 --no-confirm-changeset --no-fail-on-empty-changeset --resolve-s3 --capabilities CAPABILITY_IAM --parameter-overrides AdminCodeHash="$ADMIN_CODE_HASH" TokenSigningSecret="$TOKEN_SIGNING_SECRET" AllowedOrigin="https://main.d1emmrcvmpw55g.amplifyapp.com" OpenAiApiKey="$OPENAI_API_KEY" OpenAiModel="gpt-4o-mini" && rm -rf .aws-sam
```

- [ ] **Step 5: Deploy frontend (Amplify manual, next job = 27)**

Follow the frontend deploy sequence (build → zip dist → create-deployment → upload → start-deployment → poll until SUCCEED).

- [ ] **Step 6: Smoke test**

Verify at `https://main.d1emmrcvmpw55g.amplifyapp.com/criar` that the "Imagens da Casa" step appears, upload adds a thumbnail, "Gerar com IA" returns an image (and enforces the 5/hour limit), and the gallery shows on the game screen after founding.

- [ ] **Step 7: Final commit + push**

```bash
git add -A
git commit -m "chore: house images feature verification"
git push
```

---

## Notes for the implementer

- Rate-limit state lives in the same `ravenloft-game` DynamoDB table. Confirm the table has TTL enabled on the `ttl` attribute; if not, the counters still work but will not auto-expire (a follow-up can enable TTL in `template.yaml`). This does not block the feature.
- The AI generate endpoint returns a data URL so the client treats uploaded and generated images identically. Both are re-compressed client-side before being held/sent, keeping the create payload small.
- Every new user-facing string is Portuguese and must contain no em dashes (`—`) or en dashes (`–`).
