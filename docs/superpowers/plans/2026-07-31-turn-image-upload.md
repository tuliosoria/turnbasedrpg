# Turn Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual local image uploads to both turn image panels in the Admin Turnos tab.

**Architecture:** Reuse the existing turn image model: one `eventImageUrl` and one `resultImageUrl` on the active turn. The frontend posts `multipart/form-data` to a new admin endpoint; the backend parses and validates the upload, stores it in the existing S3 image bucket, and calls `setTurnImage` exactly like AI generation does.

**Tech Stack:** React 18, MUI, Vitest, TypeScript, AWS Lambda HTTP API event handling, S3 via `@aws-sdk/client-s3`, existing DynamoDB turn persistence.

---

## File Structure

- Modify `backend/src/types/domain.ts`: add `rawBody?: Buffer` to `HandlerRequest` so non-JSON requests can reach routes.
- Modify `backend/src/handler.ts`: preserve JSON behavior and pass multipart bodies as `rawBody` without trying to parse them as JSON.
- Modify `backend/src/validation/schemas.ts`: add upload validation and a small multipart parser for the `kind` and `image` fields.
- Modify `backend/src/storage/images.ts`: let turn image upload choose content type and file extension while keeping AI images as PNG by default.
- Modify `backend/src/routes/adminRoutes.ts`: add `uploadTurnImage` route handler.
- Modify `backend/src/router.ts`: register `POST /api/admin/turn/image/upload`.
- Modify `backend/src/routes/adminRoutes.test.ts`: cover the upload route behavior and validation.
- Modify `backend/src/router.test.ts`: ensure the new route dispatches.
- Modify `backend/src/storage/images.test.ts`: cover uploaded JPEG/WebP/PNG content metadata and keys.
- Modify `frontend/src/api/client.ts`: add `adminUploadTurnImage`.
- Modify `frontend/src/api/httpClient.ts`: add a FormData request helper and endpoint method.
- Modify `frontend/src/api/mockClient.ts`: add mock upload behavior for local development/tests.
- Modify `frontend/src/api/httpClient.test.ts`: cover multipart request shape.
- Modify `frontend/src/api/mockClient.test.ts`: cover mock uploaded URLs.
- Modify `frontend/src/components/TurnImagePanel.tsx`: add file picker upload button.
- Modify `frontend/src/components/admin/AdminTurnsTab.tsx`: wire event/result upload callbacks.
- Modify `frontend/src/pages/AdminPage.test.tsx`: cover upload from event and result panels.

---

### Task 1: Backend Multipart Upload Contract

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/handler.ts`
- Modify: `backend/src/validation/schemas.ts`
- Modify: `backend/src/routes/adminRoutes.test.ts`

- [ ] **Step 1: Write failing backend upload tests**

Add `uploadTurnImage` to the admin route import in `backend/src/routes/adminRoutes.test.ts`:

```ts
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPublicEvent, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, resetCampaign, generateTurnImage, uploadTurnImage, deleteTurnImage, listWiki, createWikiEntry, updateWikiEntry, removeWikiEntry, seedWiki, listGm, createGmEntry, updateGmEntry, removeGmEntry, seedGm } from "./adminRoutes";
```

Add these helpers near `authReq`:

```ts
function multipartBody(fields: Record<string, string>, file: { name: string; contentType: string; body: Buffer }, boundary = "----turn-upload-test") {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.name}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
  chunks.push(file.body);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    rawBody: Buffer.concat(chunks),
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
}
```

Add tests inside `describe("turn images", () => { ... })` after the existing generation tests:

```ts
it("uploads a manual event image and saves its url", async () => {
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
  const imageStore = {
    uploadTurnImage: vi.fn().mockResolvedValue("https://bucket/turns/004/event.jpg?v=1"),
    uploadHouseImage: vi.fn(),
  };
  const res = await uploadTurnImage(
    { ...deps, imageStore },
    authReq({
      method: "POST",
      body: undefined,
      ...multipartBody({ kind: "event" }, { name: "ponte.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg-bytes") }),
    }),
  );

  expect(imageStore.uploadTurnImage).toHaveBeenCalledWith("event", 4, Buffer.from("jpeg-bytes"), "image/jpeg");
  expect(turnsDb.setTurnImage).toHaveBeenCalledWith(deps.doc, "ravenloft-game", "winter-dead", 4, "event", "https://bucket/turns/004/event.jpg?v=1");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ imageUrl: "https://bucket/turns/004/event.jpg?v=1" });
});

it("rejects manual upload when image storage is not configured", async () => {
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
  await expect(
    uploadTurnImage(
      deps,
      authReq({
        method: "POST",
        body: undefined,
        ...multipartBody({ kind: "event" }, { name: "ponte.png", contentType: "image/png", body: Buffer.from("png") }),
      }),
    ),
  ).rejects.toMatchObject({ status: 503, code: "IMAGE_DISABLED" });
});

it("rejects unsupported manual upload file types", async () => {
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
  const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn() };
  await expect(
    uploadTurnImage(
      { ...deps, imageStore },
      authReq({
        method: "POST",
        body: undefined,
        ...multipartBody({ kind: "event" }, { name: "ponte.gif", contentType: "image/gif", body: Buffer.from("gif") }),
      }),
    ),
  ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
});

it("rejects oversized manual upload images", async () => {
  vi.mocked(turnsDb.getActiveTurn).mockResolvedValue({ ...composedTurn, turnId: 4 });
  const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn() };
  await expect(
    uploadTurnImage(
      { ...deps, imageStore },
      authReq({
        method: "POST",
        body: undefined,
        ...multipartBody({ kind: "result" }, { name: "grande.webp", contentType: "image/webp", body: Buffer.alloc(10 * 1024 * 1024 + 1) }),
      }),
    ),
  ).rejects.toMatchObject({ status: 400, code: "INVALID_BODY" });
});

it("requires admin for manual upload", async () => {
  const imageStore = { uploadTurnImage: vi.fn(), uploadHouseImage: vi.fn() };
  await expect(
    uploadTurnImage(
      { ...deps, imageStore },
      authReq({
        method: "POST",
        body: undefined,
        ...multipartBody({ kind: "event" }, { name: "ponte.png", contentType: "image/png", body: Buffer.from("png") }),
        headers: { "content-type": "multipart/form-data; boundary=----turn-upload-test" },
      }),
    ),
  ).rejects.toMatchObject({ status: 401 });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace backend -- src/routes/adminRoutes.test.ts
```

Expected: fail because `uploadTurnImage` is not exported.

- [ ] **Step 3: Implement request raw body support**

Update `backend/src/types/domain.ts`:

```ts
export interface HandlerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  rawBody?: Buffer;
  pathParams: Record<string, string>;
  sourceIp?: string;
}
```

Update the body parsing block in `backend/src/handler.ts`:

```ts
function headerValue(headers: Record<string, string | undefined>, name: string): string {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] ?? "";
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  let body: unknown;
  let rawBody: Buffer | undefined;
  if (event.body) {
    rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
    const contentType = headerValue(event.headers ?? {}, "content-type");
    if (!contentType || contentType.toLowerCase().startsWith("application/json")) {
      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ code: "INVALID_BODY", message: "JSON inválido." }) };
      }
    }
  }

  const req: HandlerRequest = {
    method,
    path: event.rawPath,
    headers: event.headers ?? {},
    body,
    rawBody,
    pathParams: {},
    sourceIp: event.requestContext.http.sourceIp,
  };
```

- [ ] **Step 4: Implement multipart validation helper**

Add to `backend/src/validation/schemas.ts` after `parseDeleteTurnImageBody`:

```ts
export const MAX_TURN_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const TURN_IMAGE_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function headerLookup(headers: Record<string, string | undefined>, name: string): string {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? "";
}

function parseBoundary(contentType: string): string {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) throw new HttpError(400, "INVALID_BODY", "Upload deve usar multipart/form-data com boundary.");
  return boundary;
}

interface MultipartPart {
  headers: Record<string, string>;
  body: Buffer;
}

function parseMultipart(rawBody: Buffer, boundary: string): MultipartPart[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const headerEndMarker = Buffer.from("\r\n\r\n");
  let cursor = rawBody.indexOf(delimiter);
  if (cursor < 0) throw new HttpError(400, "INVALID_BODY", "Multipart inválido.");
  const parts: MultipartPart[] = [];

  while (cursor >= 0) {
    cursor += delimiter.length;
    const marker = rawBody.subarray(cursor, cursor + 2).toString("utf8");
    if (marker === "--") break;
    if (marker !== "\r\n") throw new HttpError(400, "INVALID_BODY", "Multipart inválido.");
    cursor += 2;

    const headersEnd = rawBody.indexOf(headerEndMarker, cursor);
    if (headersEnd < 0) throw new HttpError(400, "INVALID_BODY", "Multipart inválido.");
    const headerText = rawBody.subarray(cursor, headersEnd).toString("utf8");
    const headers: Record<string, string> = {};
    for (const line of headerText.split("\r\n")) {
      const colon = line.indexOf(":");
      if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }

    const partStart = headersEnd + headerEndMarker.length;
    const nextDelimiter = rawBody.indexOf(Buffer.from(`\r\n--${boundary}`), partStart);
    if (nextDelimiter < 0) throw new HttpError(400, "INVALID_BODY", "Multipart inválido.");
    parts.push({ headers, body: rawBody.subarray(partStart, nextDelimiter) });
    cursor = nextDelimiter + 2;
  }

  return parts;
}

function dispositionName(part: MultipartPart): string {
  const disposition = part.headers["content-disposition"] ?? "";
  const match = /(?:^|;)\s*name="([^"]+)"/i.exec(disposition);
  return match?.[1] ?? "";
}

export function parseUploadTurnImageBody(headers: Record<string, string | undefined>, rawBody: Buffer | undefined): { kind: "event" | "result"; body: Buffer; contentType: string } {
  const contentType = headerLookup(headers, "content-type");
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(400, "INVALID_BODY", "Upload deve usar multipart/form-data.");
  }
  if (!rawBody) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem ausente.");

  const parts = parseMultipart(rawBody, parseBoundary(contentType));
  const kindPart = parts.find((part) => dispositionName(part) === "kind");
  const imagePart = parts.find((part) => dispositionName(part) === "image");
  const kind = parseImageKind({ kind: kindPart?.body.toString("utf8").trim() });
  if (!imagePart) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem ausente.");

  const imageContentType = (imagePart.headers["content-type"] ?? "").toLowerCase();
  if (!TURN_IMAGE_UPLOAD_TYPES.has(imageContentType)) {
    throw new HttpError(400, "INVALID_BODY", "Imagem deve ser PNG, JPEG ou WebP.");
  }
  if (imagePart.body.length === 0) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem vazio.");
  if (imagePart.body.length > MAX_TURN_IMAGE_UPLOAD_BYTES) {
    throw new HttpError(400, "INVALID_BODY", "Imagem deve ter no máximo 10 MB.");
  }

  return { kind, body: imagePart.body, contentType: imageContentType };
}
```

- [ ] **Step 5: Implement upload route handler**

Update the schemas import in `backend/src/routes/adminRoutes.ts`:

```ts
import { parseAdminLoginBody, parseApplyResolutionBody, parseComposeTurnBody, parseAdminCreateHouseBody, parseAdminUpdateHouseBody, parseAdminDeleteHouseBody, parseWorldBibleBody, parseGenerateTurnImageBody, parseDeleteTurnImageBody, parseUploadTurnImageBody, parseWikiCreateBody, parseWikiUpdateBody, parseWikiDeleteBody, parseGmCreateBody, parseGmUpdateBody, parseGmDeleteBody } from "../validation/schemas";
```

Add this route handler after `generateTurnImage`:

```ts
export async function uploadTurnImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  if (!deps.imageStore) {
    throw new HttpError(503, "IMAGE_DISABLED", "Upload de imagens não configurado.");
  }
  const { tableName, campaignId } = deps.config;
  const turn = await getActiveTurn(deps.doc, tableName, campaignId);
  if (!turn) throw new HttpError(409, "BAD_STATUS", "Nenhum turno ativo.");
  const { kind, body, contentType } = parseUploadTurnImageBody(req.headers, req.rawBody);
  const imageUrl = await deps.imageStore.uploadTurnImage(kind, turn.turnId, body, contentType);
  await setTurnImage(deps.doc, tableName, campaignId, turn.turnId, kind, imageUrl);
  return { status: 200, body: { imageUrl } };
}
```

- [ ] **Step 6: Run backend route tests**

Run:

```bash
npm run test --workspace backend -- src/routes/adminRoutes.test.ts
```

Expected: tests still fail because `uploadTurnImage` calls `uploadTurnImage` with four args but `ImageStore` only accepts three.

- [ ] **Step 7: Commit Task 1**

Do not commit until Task 2 passes, because Task 1 intentionally leaves the storage interface incomplete.

---

### Task 2: Storage and Router Support

**Files:**
- Modify: `backend/src/storage/images.ts`
- Modify: `backend/src/storage/images.test.ts`
- Modify: `backend/src/router.ts`
- Modify: `backend/src/router.test.ts`
- Modify: `backend/src/routes/adminRoutes.test.ts`

- [ ] **Step 1: Write failing storage and router tests**

Add to `backend/src/storage/images.test.ts`:

```ts
describe("uploadTurnImage", () => {
  it("uploads a JPEG turn image with the matching content type and extension", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadTurnImage("result", 12, Buffer.from("jpg"), "image/jpeg");
    expect(url).toMatch(/^https:\/\/cdn\.example\/turns\/012\/result\.jpg\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string; Bucket: string } };
    expect(call.input.Key).toBe("turns/012/result.jpg");
    expect(call.input.ContentType).toBe("image/jpeg");
    expect(call.input.Bucket).toBe("my-bucket");
  });

  it("keeps generated turn images as PNG by default", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadTurnImage("event", 4, Buffer.from("png"));
    expect(url).toMatch(/^https:\/\/cdn\.example\/turns\/004\/event\.png\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string } };
    expect(call.input.Key).toBe("turns/004/event.png");
    expect(call.input.ContentType).toBe("image/png");
  });
});
```

Add `/api/admin/turn/image/upload` to the admin handler dispatch list in `backend/src/router.test.ts`:

```ts
it.each([
  "/api/admin/turn/draft-private",
  "/api/admin/turn/draft-resolution",
  "/api/admin/turn/apply",
  "/api/admin/turn/image/upload",
])("dispatches POST %s to an admin handler", async (path) => {
  const res = await route(deps, req("POST", path));

  expect(res.status).toBe(401);
  expect((res.body as any).code).toBe("SESSION_EXPIRED");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace backend -- src/storage/images.test.ts src/router.test.ts src/routes/adminRoutes.test.ts
```

Expected: storage test fails because `uploadTurnImage` does not accept content type, router test fails because route is not registered.

- [ ] **Step 3: Implement content-type aware storage**

Update `backend/src/storage/images.ts`:

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { padTurn } from "../keys";
import { HttpError } from "../types/domain";

export type TurnImageKind = "event" | "result";
export type StoredImageContentType = "image/png" | "image/jpeg" | "image/webp";

function imageExtension(contentType: StoredImageContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

export interface ImageStore {
  uploadTurnImage(kind: TurnImageKind, turnId: number, body: Buffer, contentType?: StoredImageContentType): Promise<string>;
  uploadHouseImage(houseId: string, index: number, body: Buffer): Promise<string>;
}

export function makeImageStore(bucket: string, baseUrl: string, region?: string): ImageStore {
  const client = new S3Client({ region });
  return {
    async uploadTurnImage(kind, turnId, body, contentType = "image/png") {
      const key = `turns/${padTurn(turnId)}/${kind}.${imageExtension(contentType)}`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
      return `${baseUrl}/${key}?v=${Date.now()}`;
    },
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
  };
}
```

- [ ] **Step 4: Register the upload route**

Update imports in `backend/src/router.ts`:

```ts
import { adminLogin, getDashboard, composeTurn, openTurn, lockTurn, unlockTurn, createHouse, updateHouse, deleteHouse, draftPublicEvent, draftPrivateInfo, draftResolution, applyResolution, getWorldBible, putWorldBible, resetCampaign, generateTurnImage, uploadTurnImage, deleteTurnImage, listWiki, createWikiEntry, updateWikiEntry, removeWikiEntry, seedWiki, listGm, createGmEntry, updateGmEntry, removeGmEntry, seedGm } from "./routes/adminRoutes";
```

Add the route after `/api/admin/turn/image`:

```ts
r("POST", "/api/admin/turn/image/upload", uploadTurnImage),
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
npm run test --workspace backend -- src/storage/images.test.ts src/router.test.ts src/routes/adminRoutes.test.ts
```

Expected: all selected backend tests pass.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add backend/src/types/domain.ts backend/src/handler.ts backend/src/validation/schemas.ts backend/src/routes/adminRoutes.ts backend/src/routes/adminRoutes.test.ts backend/src/storage/images.ts backend/src/storage/images.test.ts backend/src/router.ts backend/src/router.test.ts
git commit -m "feat: add backend turn image upload"
```

---

### Task 3: Frontend API Upload Method

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/httpClient.ts`
- Modify: `frontend/src/api/httpClient.test.ts`
- Modify: `frontend/src/api/mockClient.ts`
- Modify: `frontend/src/api/mockClient.test.ts`

- [ ] **Step 1: Write failing frontend API tests**

Add to `frontend/src/api/httpClient.test.ts`:

```ts
it("uploads a turn image with FormData and bearer auth", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { imageUrl: "https://cdn/turns/004/event.jpg?v=1" }));
  const file = new File(["jpg"], "evento.jpg", { type: "image/jpeg" });

  await expect(new HttpApiClient(BASE).adminUploadTurnImage("admin-token", "event", file)).resolves.toEqual({
    imageUrl: "https://cdn/turns/004/event.jpg?v=1",
  });

  expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/admin/turn/image/upload`);
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer admin-token");
  expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  const body = fetchMock.mock.calls[0][1].body as FormData;
  expect(body.get("kind")).toBe("event");
  expect(body.get("image")).toBe(file);
});
```

Add to `frontend/src/api/mockClient.test.ts`:

```ts
it("uploads a mock turn image and exposes it in gallery", async () => {
  const { api, adminToken } = await loginAdmin();
  const uploaded = await api.adminUploadTurnImage(adminToken, "result", new File(["webp"], "resultado.webp", { type: "image/webp" }));

  expect(uploaded.imageUrl).toMatch(/https:\/\/mock\.images\/turns\/1\/result\.webp\?v=\d+/);
  const gallery = await api.getGallery();
  expect(gallery[0].resultImageUrl).toBe(uploaded.imageUrl);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace frontend -- src/api/httpClient.test.ts src/api/mockClient.test.ts
```

Expected: fail because `adminUploadTurnImage` is missing.

- [ ] **Step 3: Add API interface method**

Update `frontend/src/api/client.ts`:

```ts
export interface ApiClient {
  getCampaign(): Promise<CampaignSummary>;
  getHouseExample(): Promise<HouseExample>;
  getGallery(): Promise<GalleryEntry[]>;
  getWiki(): Promise<WikiEntry[]>;
  createAccountAndHouse(input: CreateHouseInput): Promise<CreateAccountResult>;
  generateHouseImage(input: { name: string; description: string; emblem: Emblem }): Promise<{ image: string }>;
  login(playerCode: string): Promise<LoginResult>;
  getGame(playerToken: string): Promise<PlayerGameView>;
  submitOrder(playerToken: string, input: SubmitOrderInput): Promise<{ submittedAt: string }>;
  adminLogin(adminCode: string): Promise<{ adminToken: string }>;
  getAdminDashboard(adminToken: string): Promise<AdminDashboard>;
  adminComposeTurn(adminToken: string, input: ComposeTurnInput): Promise<void>;
  adminOpenTurn(adminToken: string): Promise<void>;
  adminLockTurn(adminToken: string): Promise<void>;
  adminUnlockTurn(adminToken: string): Promise<void>;
  adminDraftPrivateInfo(adminToken: string): Promise<Record<string, string>>;
  adminDraftPublicEvent(adminToken: string): Promise<string>;
  adminDraftResolution(adminToken: string): Promise<TurnResult>;
  adminApplyResolution(adminToken: string, result: TurnResult): Promise<{ nextTurnId: number }>;
  adminGenerateTurnImage(adminToken: string, kind: TurnImageKind, sceneDescription?: string): Promise<{ imageUrl: string }>;
  adminUploadTurnImage(adminToken: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }>;
  adminDeleteTurnImage(adminToken: string, kind: TurnImageKind): Promise<void>;
```

- [ ] **Step 4: Add HTTP multipart helper and method**

In `frontend/src/api/httpClient.ts`, add this helper after `request<T>`:

```ts
  private async requestForm<T>(path: string, formData: FormData, token: string): Promise<T> {
    const headers: Record<string, string> = {};
    headers["Authorization"] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError("NETWORK", "Não foi possível conectar ao servidor.");
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }

    if (!res.ok) {
      const err = data as { code?: string; message?: string } | undefined;
      throw new ApiError(toApiErrorCode(err?.code), err?.message ?? "Erro inesperado.");
    }

    return data as T;
  }
```

Add the upload method after `adminGenerateTurnImage`:

```ts
  adminUploadTurnImage(adminToken: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("image", file);
    return this.requestForm<{ imageUrl: string }>("/api/admin/turn/image/upload", formData, adminToken);
  }
```

- [ ] **Step 5: Add mock upload method**

Add to `frontend/src/api/mockClient.ts` after `adminGenerateTurnImage`:

```ts
  async adminUploadTurnImage(token: string, kind: TurnImageKind, file: File): Promise<{ imageUrl: string }> {
    this.requireAdmin(token);
    const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
    const imageUrl = `https://mock.images/turns/${this.activeTurn.turnId}/${kind}.${extension}?v=${Date.now()}`;
    if (kind === "event") this.activeTurn = { ...this.activeTurn, eventImageUrl: imageUrl };
    else this.activeTurn = { ...this.activeTurn, resultImageUrl: imageUrl };
    return { imageUrl };
  }
```

- [ ] **Step 6: Run frontend API tests**

Run:

```bash
npm run test --workspace frontend -- src/api/httpClient.test.ts src/api/mockClient.test.ts
```

Expected: all selected frontend API tests pass.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/httpClient.test.ts frontend/src/api/mockClient.ts frontend/src/api/mockClient.test.ts
git commit -m "feat: add frontend turn image upload API"
```

---

### Task 4: Admin Turnos Upload UI

**Files:**
- Modify: `frontend/src/components/TurnImagePanel.tsx`
- Modify: `frontend/src/components/admin/AdminTurnsTab.tsx`
- Modify: `frontend/src/pages/AdminPage.test.tsx`

- [ ] **Step 1: Write failing UI tests**

In `frontend/src/pages/AdminPage.test.tsx`, add `adminUploadTurnImage` to `makeClient`:

```ts
adminUploadTurnImage: vi.fn().mockResolvedValue({ imageUrl: "https://img/uploaded.png" }),
```

Add these tests inside `describe("AdminPage", () => { ... })`:

```ts
it("uploads an event image from the draft turn panel", async () => {
  const client = makeClient();
  render(
    <ApiProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminPage />
      </MemoryRouter>
    </ApiProvider>,
  );

  await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

  const file = new File(["png"], "evento.png", { type: "image/png" });
  await userEvent.upload(screen.getByLabelText(/enviar imagem para imagem do evento/i), file);

  await waitFor(() => expect(client.adminUploadTurnImage).toHaveBeenCalledWith("admin-token", "event", file));
});

it("uploads a result image from the locked turn panel", async () => {
  const client = makeClient({ ...lockedDashboard, result: { publicResult: "Fim.", houseResults: {}, attributeDeltas: {}, discoveries: [] } });
  render(
    <ApiProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminPage />
      </MemoryRouter>
    </ApiProvider>,
  );

  await userEvent.type(screen.getByLabelText(/código de admin/i), "admin-secret");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

  const file = new File(["webp"], "resultado.webp", { type: "image/webp" });
  await userEvent.upload(screen.getByLabelText(/enviar imagem para imagem do resultado/i), file);

  await waitFor(() => expect(client.adminUploadTurnImage).toHaveBeenCalledWith("admin-token", "result", file));
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace frontend -- src/pages/AdminPage.test.tsx
```

Expected: fail because no accessible upload inputs exist.

- [ ] **Step 3: Add upload UI to `TurnImagePanel`**

Update `frontend/src/components/TurnImagePanel.tsx`:

```tsx
import { useId, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface TurnImagePanelProps {
  title: string;
  imageUrl?: string;
  busy: boolean;
  onGenerate: (sceneDescription: string) => void;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

export function TurnImagePanel({ title, imageUrl, busy, onGenerate, onUpload, onDelete }: TurnImagePanelProps) {
  const [scene, setScene] = useState("");
  const uploadInputId = useId();

  return (
    <Stack spacing={1.5} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
      <Typography variant="h3">{title}</Typography>
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={title}
          sx={{ width: "100%", maxWidth: 640, borderRadius: 1, display: "block" }}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Nenhuma imagem gerada ainda.
        </Typography>
      )}
      <TextField
        label="Descrição da cena (opcional)"
        value={scene}
        onChange={(event) => setScene(event.target.value)}
        multiline
        minRows={2}
        helperText="Deixe em branco para ilustrar o texto do turno. O estilo visual vem das Diretrizes de Imagem do Admin."
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" disabled={busy} onClick={() => onGenerate(scene)}>
          {imageUrl ? "Regerar imagem" : "Gerar imagem"}
        </Button>
        <Button component="label" htmlFor={uploadInputId} variant="outlined" disabled={busy}>
          Enviar imagem
          <Box
            id={uploadInputId}
            component="input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Enviar imagem para ${title}`}
            sx={{ display: "none" }}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </Button>
        {imageUrl && (
          <Button variant="text" color="error" disabled={busy} onClick={onDelete}>
            Remover imagem
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire uploads in Admin Turnos tab**

Update the event image panel in `frontend/src/components/admin/AdminTurnsTab.tsx`:

```tsx
<TurnImagePanel
  title="Imagem do evento"
  imageUrl={dashboard.eventImageUrl}
  busy={busy}
  onGenerate={(scene) =>
    runAction((adminToken) => api.adminGenerateTurnImage(adminToken, "event", scene), "Imagem gerada.")
  }
  onUpload={(file) =>
    runAction((adminToken) => api.adminUploadTurnImage(adminToken, "event", file), "Imagem enviada.")
  }
  onDelete={() =>
    runAction((adminToken) => api.adminDeleteTurnImage(adminToken, "event"), "Imagem removida.")
  }
/>
```

Update the result image panel similarly:

```tsx
<TurnImagePanel
  title="Imagem do resultado"
  imageUrl={dashboard.resultImageUrl}
  busy={busy}
  onGenerate={(scene) =>
    runAction((adminToken) => api.adminGenerateTurnImage(adminToken, "result", scene), "Imagem gerada.")
  }
  onUpload={(file) =>
    runAction((adminToken) => api.adminUploadTurnImage(adminToken, "result", file), "Imagem enviada.")
  }
  onDelete={() =>
    runAction((adminToken) => api.adminDeleteTurnImage(adminToken, "result"), "Imagem removida.")
  }
/>
```

- [ ] **Step 5: Run UI tests**

Run:

```bash
npm run test --workspace frontend -- src/pages/AdminPage.test.tsx
```

Expected: all selected UI tests pass.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add frontend/src/components/TurnImagePanel.tsx frontend/src/components/admin/AdminTurnsTab.tsx frontend/src/pages/AdminPage.test.tsx
git commit -m "feat: add admin turn image upload UI"
```

---

### Task 5: Final Verification and Deployment Prep

**Files:**
- Modify only if preceding tasks reveal integration issues.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: shared typecheck, backend tests, and frontend tests all pass.

- [ ] **Step 2: Run production builds**

Run:

```bash
npm run build && npm run build:backend
```

Expected: shared, frontend, and backend builds pass.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git status --short
git --no-pager diff --stat HEAD
```

Expected: only upload-related files and docs are changed.

- [ ] **Step 4: Commit docs if not already committed**

Run:

```bash
git add docs/superpowers/specs/2026-07-31-turn-image-upload-design.md docs/superpowers/plans/2026-07-31-turn-image-upload.md
git commit -m "docs: plan turn image upload"
```

If the docs were already committed before implementation, this command should be skipped.

- [ ] **Step 5: Merge to main and push after approval**

Run from `/Users/jessicarosa/turnbasedrpg`:

```bash
git merge --ff-only feature/turn-image-upload
git push origin main
```

Expected: main contains the feature branch commits and the remote push succeeds.

---

## Self-Review

- Spec coverage: both event and result panels are covered by Task 4; multipart upload and backend validation are covered by Tasks 1 and 2; S3 storage/content type behavior is covered by Task 2; client/mock behavior is covered by Task 3.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. Each code-changing step includes exact code or exact replacement snippets.
- Type consistency: `adminUploadTurnImage(adminToken, kind, file)` is used consistently across `ApiClient`, `HttpApiClient`, `MockApiClient`, `AdminTurnsTab`, and tests. Backend `uploadTurnImage` uses `parseUploadTurnImageBody` and `ImageStore.uploadTurnImage(kind, turnId, body, contentType)` consistently.

