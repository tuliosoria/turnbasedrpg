# Adicionar Canônico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que jogadores proponham cânone novo (texto + imagem opcional) que, após aprovação do Mestre, vira verbete da Enciclopédia e entidade visual — passando automaticamente a alimentar todos os prompts de IA do jogo.

**Architecture:** Uma submissão (`CanonSubmission`) é gravada no DynamoDB single-table sob `CANONSUB#<id>`. A IA normaliza o texto livre do jogador em uma `CanonProposal` estruturada (título, seção da wiki, corpo, resumo, tipo de entidade visual) e emite uma `CanonReview` com riscos/conflitos — mas nunca publica. O Mestre revisa na aba Admin e aprova; a publicação é um pipeline retomável de 3 passos (WikiEntry → VisualEntity → VisualAsset) que grava o id de cada passo na submissão antes de seguir, de modo que reaprovar após falha parcial não duplica nada.

**Tech Stack:** TypeScript 5, npm workspaces (`shared`/`backend`/`frontend`), AWS Lambda + API Gateway (SAM), DynamoDB DocumentClient, S3 para imagens, OpenAI (`generateJson`), React 18 + MUI 6 + Vite, Vitest.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/canon/models.ts` (novo) | Tipos `CanonSubmission`, `CanonProposal`, `CanonReview`, limites de tamanho, `newCanonSubmission` |
| `backend/src/keys.ts` (alterado) | `canonSubmissionSk` / `canonSubmissionPrefix` |
| `backend/src/db/canonSubmissions.ts` (novo) | put/get/list de submissões |
| `backend/src/validation/schemas.ts` (alterado) | Parsers dos corpos das rotas de cânone |
| `backend/src/ai/canonPrompts.ts` (novo) | Prompts + parsers de `CanonProposal` e `CanonReview` |
| `backend/src/canon/publish.ts` (novo) | Pipeline retomável de publicação |
| `backend/src/storage/images.ts` (alterado) | `uploadCanonImage` |
| `backend/src/routes/canonRoutes.ts` (novo) | Handlers de jogador e de admin |
| `backend/src/router.ts` (alterado) | Registro das 7 rotas |
| `frontend/src/api/client.ts` / `httpClient.ts` / `mockClient.ts` (alterados) | 7 métodos novos |
| `frontend/src/components/CanonSubmitForm.tsx` (novo) | Formulário do jogador |
| `frontend/src/pages/CanonicoPage.tsx` (novo) | Página `/canonico` |
| `frontend/src/components/admin/AdminCanonTab.tsx` (novo) | Fila de revisão do Mestre |
| `frontend/src/App.tsx`, `navigation.ts`, `pages/AdminPage.tsx` (alterados) | Rota, link e aba |
| `frontend/src/pages/enciclopedia/EstudioTab.tsx` (alterado) | Renomear opção colidente |

---

## Task 1: Tipos compartilhados do cânone

**Files:**
- Create: `shared/src/canon/models.ts`
- Create: `shared/src/canon/models.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `shared/src/canon/models.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { newCanonSubmission, CANON_TITLE_MAX, CANON_BODY_MAX, CANON_SUMMARY_MAX, isCanonSubmissionStatus } from "./models";

describe("newCanonSubmission", () => {
  it("starts pending with no published ids", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "  Quero criar Sera, a batedora.  ",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "Sera de Vargen",
        section: "casas",
        body: "Batedora das fronteiras.",
        summary: "Batedora.",
        entityType: "CHARACTER",
        canonicalName: "Sera de Vargen",
        immutableTraits: ["cicatriz no queixo"],
        houseId: "vargen",
      },
    });
    expect(sub.status).toBe("PENDING_GM");
    expect(sub.rawText).toBe("Quero criar Sera, a batedora.");
    expect(sub.review).toBeNull();
    expect(sub.gmNote).toBe("");
    expect(sub.wikiEntryId).toBeNull();
    expect(sub.visualEntityId).toBeNull();
    expect(sub.visualAssetId).toBeNull();
    expect(sub.resolvedAt).toBeNull();
    expect(sub.createdAt).toBe(sub.updatedAt);
  });

  it("clamps proposal text to the documented limits", () => {
    const sub = newCanonSubmission({
      id: "abc",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "x",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: {
        title: "T".repeat(CANON_TITLE_MAX + 50),
        section: "casas",
        body: "B".repeat(CANON_BODY_MAX + 50),
        summary: "S".repeat(CANON_SUMMARY_MAX + 50),
        entityType: null,
        canonicalName: "Sera",
        immutableTraits: [],
        houseId: null,
      },
    });
    expect(sub.proposal.title.length).toBe(CANON_TITLE_MAX);
    expect(sub.proposal.body.length).toBe(CANON_BODY_MAX);
    expect(sub.proposal.summary.length).toBe(CANON_SUMMARY_MAX);
  });
});

describe("isCanonSubmissionStatus", () => {
  it("accepts only the three states", () => {
    expect(isCanonSubmissionStatus("PENDING_GM")).toBe(true);
    expect(isCanonSubmissionStatus("APPROVED")).toBe(true);
    expect(isCanonSubmissionStatus("REJECTED")).toBe(true);
    expect(isCanonSubmissionStatus("ACTIVE")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w shared -- canon/models`
Expected: FAIL — `Failed to resolve import "./models"`.

- [ ] **Step 3: Write minimal implementation**

Create `shared/src/canon/models.ts`:

```ts
import { clampText } from "../projects.js";
import type { VisualEntityType } from "../visual/models.js";

export const CANON_RAW_TEXT_MAX = 4000;
export const CANON_TITLE_MAX = 120;
export const CANON_BODY_MAX = 8000;
export const CANON_SUMMARY_MAX = 400;
export const CANON_TRAIT_MAX = 120;
export const CANON_MAX_TRAITS = 8;
export const CANON_GM_NOTE_MAX = 1000;

export const CANON_SUBMISSION_STATUSES = ["PENDING_GM", "APPROVED", "REJECTED"] as const;
export type CanonSubmissionStatus = (typeof CANON_SUBMISSION_STATUSES)[number];

export function isCanonSubmissionStatus(v: unknown): v is CanonSubmissionStatus {
  return typeof v === "string" && (CANON_SUBMISSION_STATUSES as readonly string[]).includes(v);
}

/** O texto livre do jogador depois de a IA transformá-lo em verbete. */
export interface CanonProposal {
  title: string;
  /** Id de seção da Enciclopédia (ver WIKI_SECTION_IDS). */
  section: string;
  body: string;
  summary: string;
  /** Null quando a proposta não merece entidade visual própria. */
  entityType: VisualEntityType | null;
  canonicalName: string;
  immutableTraits: string[];
  houseId: string | null;
}

export const CANON_FLAG_SEVERITIES = ["INFO", "WARN", "BLOCK"] as const;
export type CanonFlagSeverity = (typeof CANON_FLAG_SEVERITIES)[number];

export interface CanonReviewFlag {
  severity: CanonFlagSeverity;
  message: string;
}

export const CANON_VERDICTS = ["OK", "NEEDS_WORK", "CONFLICT"] as const;
export type CanonVerdict = (typeof CANON_VERDICTS)[number];

/** Parecer da IA. Informa o Mestre; nunca decide nada sozinho. */
export interface CanonReview {
  verdict: CanonVerdict;
  flags: CanonReviewFlag[];
  conflictingEntryIds: string[];
}

export interface CanonSubmission {
  id: string;
  campaignId: string;
  houseId: string;
  authorName: string;
  rawText: string;
  rawImageUrl: string | null;
  /** Chave S3 da imagem enviada. Necessária para montar o VisualAsset na publicação. */
  rawImageKey: string | null;
  proposal: CanonProposal;
  review: CanonReview | null;
  status: CanonSubmissionStatus;
  gmNote: string;
  wikiEntryId: string | null;
  visualEntityId: string | null;
  visualAssetId: string | null;
  /** Preenchido quando o Mestre aprova ou recusa. Null enquanto pendente. */
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function clampCanonProposal(p: CanonProposal): CanonProposal {
  return {
    title: clampText(p.title, CANON_TITLE_MAX),
    section: p.section,
    body: clampText(p.body, CANON_BODY_MAX),
    summary: clampText(p.summary, CANON_SUMMARY_MAX),
    entityType: p.entityType,
    canonicalName: clampText(p.canonicalName, CANON_TITLE_MAX),
    immutableTraits: p.immutableTraits.slice(0, CANON_MAX_TRAITS).map((t) => clampText(t, CANON_TRAIT_MAX)),
    houseId: p.houseId,
  };
}

export interface NewCanonSubmissionInput {
  id: string;
  campaignId: string;
  houseId: string;
  authorName: string;
  rawText: string;
  rawImageUrl: string | null;
  rawImageKey: string | null;
  proposal: CanonProposal;
}

export function newCanonSubmission(input: NewCanonSubmissionInput): CanonSubmission {
  const now = new Date().toISOString();
  return {
    id: input.id,
    campaignId: input.campaignId,
    houseId: input.houseId,
    authorName: input.authorName,
    rawText: clampText(input.rawText, CANON_RAW_TEXT_MAX),
    rawImageUrl: input.rawImageUrl,
    rawImageKey: input.rawImageKey,
    proposal: clampCanonProposal(input.proposal),
    review: null,
    status: "PENDING_GM",
    gmNote: "",
    wikiEntryId: null,
    visualEntityId: null,
    visualAssetId: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
```

Nota sobre `clampText`: ele corta em `max - 1` e acrescenta `…`, então o resultado tem exatamente `max` caracteres. É por isso que o teste espera `.length === CANON_TITLE_MAX`.

- [ ] **Step 4: Export the module**

Adicione em `shared/src/index.ts`, logo depois da linha `export * from "./visual/models.js";`:

```ts
export * from "./canon/models.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w shared -- canon/models`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add shared/src/canon/models.ts shared/src/canon/models.test.ts shared/src/index.ts
git commit -m "feat(canônico): tipos compartilhados de submissão de cânone"
```

---

## Task 2: Chaves e repositório DynamoDB

**Files:**
- Modify: `backend/src/keys.ts`
- Create: `backend/src/db/canonSubmissions.ts`
- Create: `backend/src/db/canonSubmissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/db/canonSubmissions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { putCanonSubmission, getCanonSubmission, listCanonSubmissions } from "./canonSubmissions";
import { newCanonSubmission, type CanonSubmission } from "@ravenloft/content";

const TABLE = "ravenloft-game";
const CAMPAIGN = "winter-dead";

function docReturning(value: unknown) {
  return { send: vi.fn().mockResolvedValue(value) };
}

function submission(id: string, createdAt: string): CanonSubmission {
  const sub = newCanonSubmission({
    id,
    campaignId: CAMPAIGN,
    houseId: "vargen",
    authorName: "Casa Vargen",
    rawText: "texto",
    rawImageUrl: null,
    rawImageKey: null,
    proposal: {
      title: "Sera",
      section: "casas",
      body: "corpo",
      summary: "resumo",
      entityType: "CHARACTER",
      canonicalName: "Sera",
      immutableTraits: [],
      houseId: "vargen",
    },
  });
  return { ...sub, createdAt, updatedAt: createdAt };
}

describe("canonSubmissions db", () => {
  it("writes under a CANONSUB# sort key in the campaign partition", async () => {
    const doc = docReturning({});
    await putCanonSubmission(doc as never, TABLE, CAMPAIGN, submission("abc", "2026-01-01T00:00:00.000Z"));
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.PK).toBe("CAMPAIGN#WINTER_DEAD");
    expect(cmd.input.Item.SK).toBe("CANONSUB#abc");
    expect(cmd.input.Item.id).toBe("abc");
  });

  it("gets one submission by id and returns null when missing", async () => {
    const found = docReturning({ Item: submission("abc", "2026-01-01T00:00:00.000Z") });
    expect(await getCanonSubmission(found as never, TABLE, CAMPAIGN, "abc")).not.toBeNull();
    const cmd = found.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(GetCommand);
    expect(cmd.input.Key.SK).toBe("CANONSUB#abc");

    const missing = docReturning({});
    expect(await getCanonSubmission(missing as never, TABLE, CAMPAIGN, "abc")).toBeNull();
  });

  it("lists newest first and can filter by house", async () => {
    const doc = docReturning({
      Items: [
        submission("old", "2026-01-01T00:00:00.000Z"),
        submission("new", "2026-03-01T00:00:00.000Z"),
      ],
    });
    const all = await listCanonSubmissions(doc as never, TABLE, CAMPAIGN);
    expect(all.map((s) => s.id)).toEqual(["new", "old"]);
    const cmd = doc.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("CANONSUB#");

    const other = docReturning({
      Items: [
        { ...submission("mine", "2026-01-01T00:00:00.000Z"), houseId: "vargen" },
        { ...submission("theirs", "2026-02-01T00:00:00.000Z"), houseId: "auremont" },
      ],
    });
    const mine = await listCanonSubmissions(other as never, TABLE, CAMPAIGN, "vargen");
    expect(mine.map((s) => s.id)).toEqual(["mine"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- canonSubmissions`
Expected: FAIL — `Failed to resolve import "./canonSubmissions"`.

- [ ] **Step 3: Add the keys**

Em `backend/src/keys.ts`, logo depois de `campaignFactPrefix()`, acrescente:

```ts
/** Propostas de cânone feitas por jogadores, aguardando ou já julgadas pelo Mestre. */
export function canonSubmissionSk(submissionId: string): string {
  return `CANONSUB#${submissionId}`;
}
export function canonSubmissionPrefix(): string {
  return "CANONSUB#";
}
```

- [ ] **Step 4: Write minimal implementation**

Create `backend/src/db/canonSubmissions.ts`:

```ts
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, canonSubmissionSk, canonSubmissionPrefix } from "../keys";
import type { CanonSubmission } from "@ravenloft/content";

export async function putCanonSubmission(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  submission: CanonSubmission,
): Promise<CanonSubmission> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: canonSubmissionSk(submission.id), ...submission },
    }),
  );
  return submission;
}

export async function getCanonSubmission(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  submissionId: string,
): Promise<CanonSubmission | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: campaignPk(campaignId), SK: canonSubmissionSk(submissionId) },
    }),
  );
  return (res.Item as CanonSubmission | undefined) ?? null;
}

/** Mais recentes primeiro. `houseId` filtra a fila do jogador. */
export async function listCanonSubmissions(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  houseId?: string,
): Promise<CanonSubmission[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": canonSubmissionPrefix() },
    }),
  );
  const items = (res.Items ?? []) as CanonSubmission[];
  const filtered = houseId ? items.filter((s) => s.houseId === houseId) : items;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w backend -- canonSubmissions`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/keys.ts backend/src/db/canonSubmissions.ts backend/src/db/canonSubmissions.test.ts
git commit -m "feat(canônico): chaves e repositório de submissões"
```

---

## Task 3: Validação dos corpos das rotas

**Files:**
- Modify: `backend/src/validation/schemas.ts` (acrescentar no fim do arquivo)
- Modify: `backend/src/validation/schemas.test.ts`

Os helpers privados `asObject`, `str`, `headerLookup`, `parseBoundary`, `parseMultipart`, `dispositionName`, `TURN_IMAGE_UPLOAD_TYPES` e `MAX_TURN_IMAGE_UPLOAD_BYTES` já existem neste mesmo arquivo — reuse-os, não duplique.

- [ ] **Step 1: Write the failing test**

Acrescente ao final de `backend/src/validation/schemas.test.ts`:

```ts
import { parseCanonPreviewBody, parseCanonSubmitBody, parseCanonApproveBody, parseCanonRejectBody, parseUploadCanonImageBody } from "./schemas";

describe("canon schemas", () => {
  const proposal = {
    title: "Sera de Vargen",
    section: "casas",
    body: "Batedora das fronteiras do norte.",
    summary: "Batedora de Vargen.",
    entityType: "CHARACTER",
    canonicalName: "Sera de Vargen",
    immutableTraits: ["cicatriz no queixo"],
    houseId: "vargen",
  };

  it("parses a preview body", () => {
    expect(parseCanonPreviewBody({ rawText: " Quero criar Sera. " })).toEqual({ rawText: "Quero criar Sera." });
  });

  it("rejects an empty preview body", () => {
    expect(() => parseCanonPreviewBody({ rawText: "   " })).toThrow(/Descreva/);
  });

  it("parses a submit body with an optional image", () => {
    const parsed = parseCanonSubmitBody({ rawText: "Quero criar Sera.", rawImageUrl: "https://cdn/x.png", rawImageKey: "canon/x/original.png", proposal });
    expect(parsed.rawImageUrl).toBe("https://cdn/x.png");
    expect(parsed.rawImageKey).toBe("canon/x/original.png");
    expect(parsed.proposal.entityType).toBe("CHARACTER");
    expect(parseCanonSubmitBody({ rawText: "x", proposal }).rawImageUrl).toBeNull();
  });

  it("rejects an unknown wiki section", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, section: "inexistente" } })).toThrow(/Seção/);
  });

  it("rejects a non-canon wiki section", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, section: "campanha-dnd" } })).toThrow(/regras/);
  });

  it("rejects an unknown entity type but allows null", () => {
    expect(() => parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, entityType: "DRAGAO" } })).toThrow(/Tipo/);
    expect(parseCanonSubmitBody({ rawText: "x", proposal: { ...proposal, entityType: null } }).proposal.entityType).toBeNull();
  });

  it("parses admin approve and reject bodies", () => {
    expect(parseCanonApproveBody({ submissionId: "abc", proposal }).submissionId).toBe("abc");
    expect(parseCanonApproveBody({ submissionId: "abc" }).proposal).toBeNull();
    expect(parseCanonRejectBody({ submissionId: "abc", note: "Conflita." })).toEqual({ submissionId: "abc", note: "Conflita." });
  });

  it("parses a multipart canon image upload", () => {
    const boundary = "----x";
    const raw = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      Buffer.from([1, 2, 3]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const parsed = parseUploadCanonImageBody({ "content-type": `multipart/form-data; boundary=${boundary}` }, raw);
    expect(parsed.contentType).toBe("image/png");
    expect(parsed.body.length).toBe(3);
  });

  it("rejects a canon image upload that is not multipart", () => {
    expect(() => parseUploadCanonImageBody({ "content-type": "application/json" }, Buffer.from("{}"))).toThrow(/multipart/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- schemas`
Expected: FAIL — `parseCanonPreviewBody is not a function` (ou erro de export ausente).

- [ ] **Step 3: Write minimal implementation**

Acrescente ao final de `backend/src/validation/schemas.ts`:

```ts
function parseCanonSection(o: Record<string, unknown>): string {
  const section = str(o, "section", 40);
  if (!WIKI_SECTION_IDS.includes(section)) throw new HttpError(400, "INVALID_BODY", "Seção desconhecida.");
  if (!isCanonWikiSection(section)) {
    throw new HttpError(400, "INVALID_BODY", "Essa seção guarda regras de mesa, não cânone do mundo.");
  }
  return section;
}

function parseCanonTraits(o: Record<string, unknown>): string[] {
  const raw = o.immutableTraits;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "INVALID_BODY", "immutableTraits deve ser uma lista.");
  if (raw.length > CANON_MAX_TRAITS) throw new HttpError(400, "INVALID_BODY", `Máximo de ${CANON_MAX_TRAITS} traços.`);
  return raw.map((t) => {
    if (typeof t !== "string") throw new HttpError(400, "INVALID_BODY", "Traço inválido.");
    return clampText(t, CANON_TRAIT_MAX);
  });
}

export function parseCanonProposal(raw: unknown): CanonProposal {
  const o = asObject(raw);
  const entityTypeRaw = o.entityType;
  let entityType: CanonProposal["entityType"] = null;
  if (entityTypeRaw !== undefined && entityTypeRaw !== null && entityTypeRaw !== "") {
    if (!isVisualEntityType(entityTypeRaw)) throw new HttpError(400, "INVALID_BODY", "Tipo de entidade desconhecido.");
    entityType = entityTypeRaw;
  }
  const title = clampText(str(o, "title", CANON_TITLE_MAX * 2), CANON_TITLE_MAX);
  return clampCanonProposal({
    title,
    section: parseCanonSection(o),
    body: str(o, "body", CANON_BODY_MAX * 2),
    summary: str(o, "summary", CANON_SUMMARY_MAX * 2, false),
    entityType,
    canonicalName: str(o, "canonicalName", CANON_TITLE_MAX * 2, false) || title,
    immutableTraits: parseCanonTraits(o),
    houseId: str(o, "houseId", 60, false) || null,
  });
}

export function parseCanonPreviewBody(body: unknown): { rawText: string } {
  const o = asObject(body);
  const rawText = str(o, "rawText", CANON_RAW_TEXT_MAX).trim();
  if (!rawText) throw new HttpError(400, "INVALID_BODY", "Descreva o que você quer tornar canônico.");
  return { rawText };
}

export function parseCanonSubmitBody(body: unknown): { rawText: string; rawImageUrl: string | null; rawImageKey: string | null; proposal: CanonProposal } {
  const o = asObject(body);
  const { rawText } = parseCanonPreviewBody(o);
  const rawImageUrl = str(o, "rawImageUrl", 500, false).trim();
  if (rawImageUrl && !rawImageUrl.startsWith("/") && !rawImageUrl.startsWith("https://")) {
    throw new HttpError(400, "INVALID_BODY", "rawImageUrl deve começar com / ou https://.");
  }
  const rawImageKey = str(o, "rawImageKey", 500, false).trim();
  return { rawText, rawImageUrl: rawImageUrl || null, rawImageKey: rawImageKey || null, proposal: parseCanonProposal(o.proposal) };
}

export function parseCanonApproveBody(body: unknown): { submissionId: string; proposal: CanonProposal | null } {
  const o = asObject(body);
  return {
    submissionId: str(o, "submissionId", 60),
    proposal: o.proposal === undefined || o.proposal === null ? null : parseCanonProposal(o.proposal),
  };
}

export function parseCanonRejectBody(body: unknown): { submissionId: string; note: string } {
  const o = asObject(body);
  return { submissionId: str(o, "submissionId", 60), note: str(o, "note", CANON_GM_NOTE_MAX, false).trim() };
}

export function parseUploadCanonImageBody(
  headers: Record<string, string | undefined>,
  rawBody: Buffer | undefined,
): { body: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" } {
  const contentType = headerLookup(headers, "content-type");
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(400, "INVALID_BODY", "Upload deve usar multipart/form-data.");
  }
  if (!rawBody) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem ausente.");

  const parts = parseMultipart(rawBody, parseBoundary(contentType));
  const imagePart = parts.find((part) => dispositionName(part) === "image");
  if (!imagePart) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem ausente.");

  const imageContentType = (imagePart.headers["content-type"] ?? "").toLowerCase();
  if (!TURN_IMAGE_UPLOAD_TYPES.has(imageContentType)) {
    throw new HttpError(400, "INVALID_BODY", "Imagem deve ser PNG, JPEG ou WebP.");
  }
  if (imagePart.body.length === 0) throw new HttpError(400, "INVALID_BODY", "Arquivo de imagem vazio.");
  if (imagePart.body.length > MAX_TURN_IMAGE_UPLOAD_BYTES) {
    throw new HttpError(400, "INVALID_BODY", "Imagem deve ter no máximo 10 MB.");
  }

  return { body: imagePart.body, contentType: imageContentType as "image/png" | "image/jpeg" | "image/webp" };
}
```

- [ ] **Step 4: Extend the existing import**

A primeira linha de `backend/src/validation/schemas.ts` já importa de `@ravenloft/content`. Acrescente a ela os símbolos novos:

`isCanonWikiSection`, `isVisualEntityType`, `clampCanonProposal`, `CANON_RAW_TEXT_MAX`, `CANON_TITLE_MAX`, `CANON_BODY_MAX`, `CANON_SUMMARY_MAX`, `CANON_TRAIT_MAX`, `CANON_MAX_TRAITS`, `CANON_GM_NOTE_MAX`, `type CanonProposal`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w backend -- schemas`
Expected: PASS (todos os testes de schema, incluindo os 8 novos).

- [ ] **Step 6: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/validation/schemas.test.ts
git commit -m "feat(canônico): validação dos corpos das rotas de cânone"
```

---

## Task 4: Prompts de IA — proposta e parecer

**Files:**
- Create: `backend/src/ai/canonPrompts.ts`
- Create: `backend/src/ai/canonPrompts.test.ts`

A IA faz duas coisas e só duas: transforma texto livre em verbete estruturado (`CanonProposal`) e aponta riscos/conflitos (`CanonReview`). Ela nunca publica.

- [ ] **Step 1: Write the failing test**

Create `backend/src/ai/canonPrompts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCanonProposalPrompt, parseCanonProposalJson, buildCanonReviewPrompt, parseCanonReviewJson, buildCanonContext } from "./canonPrompts";
import type { WikiEntry } from "@ravenloft/content";

const wiki: WikiEntry[] = [
  { entryId: "w1", section: "casas", title: "Casa Vargen", body: "Guarda a fronteira norte.", order: 0, updatedAt: "" },
  { entryId: "w2", section: "campanha-dnd", title: "Fireball", body: "Slot de nível 3.", order: 0, updatedAt: "" },
];

describe("buildCanonContext", () => {
  it("leaves table rules out of the canon fed to the model", () => {
    const ctx = buildCanonContext(wiki);
    expect(ctx).toContain("Casa Vargen");
    expect(ctx).not.toContain("Fireball");
  });
});

describe("buildCanonProposalPrompt", () => {
  it("names the house, the sections and the player text", () => {
    const { system, user } = buildCanonProposalPrompt("Casa Vargen", buildCanonContext(wiki), "Quero criar Sera, batedora.");
    expect(system).toContain("Valdren");
    expect(system).toContain("JSON");
    expect(user).toContain("Casa Vargen");
    expect(user).toContain("Quero criar Sera");
    expect(user).toContain("casas");
    expect(user).not.toContain("campanha-dnd");
  });
});

describe("parseCanonProposalJson", () => {
  it("accepts a well-formed proposal", () => {
    const p = parseCanonProposalJson(JSON.stringify({
      title: "Sera de Vargen", section: "casas", body: "Batedora.", summary: "Batedora.",
      entityType: "CHARACTER", canonicalName: "Sera de Vargen", immutableTraits: ["cicatriz"], houseId: "vargen",
    }));
    expect(p.title).toBe("Sera de Vargen");
    expect(p.entityType).toBe("CHARACTER");
  });

  it("falls back to a safe section and null entity type", () => {
    const p = parseCanonProposalJson(JSON.stringify({ title: "X", section: "inventada", body: "Y", entityType: "DRAGAO" }));
    expect(p.section).toBe("visao-geral");
    expect(p.entityType).toBeNull();
  });

  it("throws AI_PARSE on garbage so generateJson retries", () => {
    expect(() => parseCanonProposalJson("não é json")).toThrow(/AI_PARSE|JSON/);
  });

  it("throws when the body is empty", () => {
    expect(() => parseCanonProposalJson(JSON.stringify({ title: "X", section: "visao-geral", body: "" }))).toThrow();
  });
});

describe("parseCanonReviewJson", () => {
  it("accepts a review and normalises unknown severities", () => {
    const r = parseCanonReviewJson(JSON.stringify({
      verdict: "CONFLICT",
      flags: [{ severity: "BLOCK", message: "Contradiz o cerco." }, { severity: "???", message: "Nome parecido." }],
      conflictingEntryIds: ["w1", 7],
    }));
    expect(r.verdict).toBe("CONFLICT");
    expect(r.flags.map((f) => f.severity)).toEqual(["BLOCK", "INFO"]);
    expect(r.conflictingEntryIds).toEqual(["w1"]);
  });

  it("defaults to OK with no flags when the model omits them", () => {
    const r = parseCanonReviewJson(JSON.stringify({}));
    expect(r).toEqual({ verdict: "OK", flags: [], conflictingEntryIds: [] });
  });
});

describe("buildCanonReviewPrompt", () => {
  it("includes the proposal and the canon", () => {
    const { user } = buildCanonReviewPrompt(buildCanonContext(wiki), {
      title: "Sera de Vargen", section: "casas", body: "Batedora.", summary: "Batedora.",
      entityType: "CHARACTER", canonicalName: "Sera de Vargen", immutableTraits: [], houseId: "vargen",
    });
    expect(user).toContain("Sera de Vargen");
    expect(user).toContain("Casa Vargen");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- canonPrompts`
Expected: FAIL — `Failed to resolve import "./canonPrompts"`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/ai/canonPrompts.ts`:

```ts
import { WIKI_SECTIONS, isCanonWikiSection, isVisualEntityType, clampCanonProposal, CANON_MAX_TRAITS, CANON_TRAIT_MAX, clampText, type WikiEntry, type CanonProposal, type CanonReview, type CanonReviewFlag, type CanonFlagSeverity, type CanonVerdict } from "@ravenloft/content";
import { HttpError } from "../types/domain";

const FALLBACK_SECTION = "visao-geral";

function canonSections(): { id: string; label: string }[] {
  return WIKI_SECTIONS.filter((s) => isCanonWikiSection(s.id)).map((s) => ({ id: s.id, label: s.label }));
}

/** Só o mundo. Regra de mesa nunca entra num prompt de ficção. */
export function buildCanonContext(wiki: WikiEntry[]): string {
  return wiki
    .filter((e) => isCanonWikiSection(e.section))
    .map((e) => `[${e.entryId}] (${e.section}) ${e.title}\n${clampText(e.body, 700)}`)
    .join("\n\n");
}

function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "A IA não devolveu JSON válido.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(502, "AI_PARSE", "A IA não devolveu um objeto.");
  }
  return value as Record<string, unknown>;
}

function text(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v.trim() : "";
}

export function buildCanonProposalPrompt(houseName: string, canon: string, rawText: string): { system: string; user: string } {
  const sections = canonSections().map((s) => `- ${s.id}: ${s.label}`).join("\n");
  const system = [
    "Você é o arquivista de Valdren, uma ilha cercada pelas Brumas em uma campanha de fantasia política e horror sobrenatural.",
    "Transforme o pedido do jogador em um verbete de enciclopédia coerente com o cânone recebido.",
    "Escreva em português do Brasil, em prosa sóbria, sem números de regra e sem mecânica de mesa.",
    "Nunca invente eventos de escala continental nem mate personagens existentes: proponha apenas o que o jogador pediu.",
    "Responda SOMENTE com JSON no formato: {\"title\":string,\"section\":string,\"body\":string,\"summary\":string,\"entityType\":string|null,\"canonicalName\":string,\"immutableTraits\":string[],\"houseId\":string|null}.",
  ].join(" ");
  const user = [
    `Casa autora: ${houseName}`,
    "",
    "Seções disponíveis:",
    sections,
    "",
    "Cânone atual:",
    canon || "(a enciclopédia ainda está vazia)",
    "",
    "Pedido do jogador:",
    rawText,
    "",
    `Devolva no máximo ${CANON_MAX_TRAITS} traços imutáveis, cada um com até ${CANON_TRAIT_MAX} caracteres, descrevendo apenas o que é visualmente permanente.`,
    "Use entityType apenas quando a proposta descreve algo que pode ser desenhado (personagem, lugar, objeto). Caso contrário, null.",
  ].join("\n");
  return { system, user };
}

export function parseCanonProposalJson(raw: string): CanonProposal {
  const o = parseJsonObject(raw);
  const title = text(o, "title");
  const body = text(o, "body");
  if (!title) throw new HttpError(502, "AI_PARSE", "A IA não devolveu um título.");
  if (!body) throw new HttpError(502, "AI_PARSE", "A IA não devolveu um corpo de verbete.");

  const sectionRaw = text(o, "section");
  const section = canonSections().some((s) => s.id === sectionRaw) ? sectionRaw : FALLBACK_SECTION;

  const traitsRaw = Array.isArray(o.immutableTraits) ? o.immutableTraits : [];
  const immutableTraits = traitsRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  return clampCanonProposal({
    title,
    section,
    body,
    summary: text(o, "summary") || body,
    entityType: isVisualEntityType(o.entityType) ? o.entityType : null,
    canonicalName: text(o, "canonicalName") || title,
    immutableTraits,
    houseId: text(o, "houseId") || null,
  });
}

export function buildCanonReviewPrompt(canon: string, proposal: CanonProposal): { system: string; user: string } {
  const system = [
    "Você é o revisor de continuidade de Valdren.",
    "Aponte contradições, repetições e riscos de poder do verbete proposto em relação ao cânone recebido.",
    "Você não aprova nem rejeita nada: o Mestre decide. Seja específico e curto.",
    "Responda SOMENTE com JSON no formato: {\"verdict\":\"OK\"|\"NEEDS_WORK\"|\"CONFLICT\",\"flags\":[{\"severity\":\"INFO\"|\"WARN\"|\"BLOCK\",\"message\":string}],\"conflictingEntryIds\":string[]}.",
  ].join(" ");
  const user = [
    "Cânone atual (o id entre colchetes identifica o verbete):",
    canon || "(a enciclopédia ainda está vazia)",
    "",
    "Verbete proposto:",
    `Seção: ${proposal.section}`,
    `Título: ${proposal.title}`,
    proposal.body,
    "",
    "Use BLOCK só quando publicar quebraria o cânone existente.",
  ].join("\n");
  return { system, user };
}

function severity(v: unknown): CanonFlagSeverity {
  return v === "BLOCK" || v === "WARN" || v === "INFO" ? v : "INFO";
}

export function parseCanonReviewJson(raw: string): CanonReview {
  const o = parseJsonObject(raw);
  const verdictRaw = o.verdict;
  const verdict: CanonVerdict = verdictRaw === "CONFLICT" || verdictRaw === "NEEDS_WORK" ? verdictRaw : "OK";
  const flagsRaw = Array.isArray(o.flags) ? o.flags : [];
  const flags: CanonReviewFlag[] = flagsRaw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null && !Array.isArray(f))
    .map((f) => ({ severity: severity(f.severity), message: clampText(typeof f.message === "string" ? f.message : "", 300) }))
    .filter((f) => f.message.length > 0);
  const idsRaw = Array.isArray(o.conflictingEntryIds) ? o.conflictingEntryIds : [];
  return { verdict, flags, conflictingEntryIds: idsRaw.filter((id): id is string => typeof id === "string") };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- canonPrompts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/canonPrompts.ts backend/src/ai/canonPrompts.test.ts
git commit -m "feat(canônico): prompts de proposta e parecer de continuidade"
```

---

## Task 5: Pipeline de publicação retomável

**Files:**
- Create: `backend/src/canon/publish.ts`
- Create: `backend/src/canon/publish.test.ts`

Publicar são três escritas independentes: verbete da Enciclopédia, entidade visual e imagem canônica. Não há transação entre elas. Se a segunda falhar e o Mestre clicar em Aprovar de novo, uma implementação ingênua criaria um segundo verbete. Por isso cada passo grava o id que produziu **antes** de o próximo começar, e é pulado se o id já existir. `status` só vira `APPROVED` quando os três terminam.

- [ ] **Step 1: Write the failing test**

Create `backend/src/canon/publish.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishCanonSubmission } from "./publish";
import { newCanonSubmission, type CanonSubmission } from "@ravenloft/content";

vi.mock("../db/wiki", () => ({ putWikiEntry: vi.fn(async (_d, _t, _c, e) => e), generateWikiId: vi.fn(() => "wiki01") }));
vi.mock("../db/visual/entities", () => ({ putEntity: vi.fn(), listEntities: vi.fn(async () => []) }));
vi.mock("../db/visual/assets", () => ({ putAsset: vi.fn() }));

import * as wikiDb from "../db/wiki";
import * as entitiesDb from "../db/visual/entities";
import * as assetsDb from "../db/visual/assets";

function submission(over: Partial<CanonSubmission> = {}): CanonSubmission {
  return {
    ...newCanonSubmission({
      id: "sub1",
      campaignId: "winter-dead",
      houseId: "vargen",
      authorName: "Casa Vargen",
      rawText: "Quero criar Sera.",
      rawImageUrl: "https://cdn/canon/img1/original.png",
      rawImageKey: "canon/img1/original.png",
      proposal: {
        title: "Sera de Vargen",
        section: "casas",
        body: "Batedora das fronteiras.",
        summary: "Batedora.",
        entityType: "CHARACTER",
        canonicalName: "Sera de Vargen",
        immutableTraits: ["cicatriz no queixo"],
        houseId: "vargen",
      },
    }),
    ...over,
  };
}

let ids = 0;
const deps = () => ({
  doc: {} as never,
  tableName: "ravenloft-game",
  campaignId: "winter-dead",
  newId: () => `id${++ids}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  ids = 0;
});

describe("publishCanonSubmission", () => {
  it("creates wiki entry, entity and asset, then marks it approved", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const result = await publishCanonSubmission(deps(), submission(), save);

    expect(result.status).toBe("APPROVED");
    expect(result.resolvedAt).not.toBeNull();
    expect(result.wikiEntryId).toBe("wiki01");
    expect(result.visualEntityId).toBe("id1");
    expect(result.visualAssetId).toBe("id2");

    const entry = vi.mocked(wikiDb.putWikiEntry).mock.calls[0][3];
    expect(entry.section).toBe("casas");
    expect(entry.title).toBe("Sera de Vargen");
    expect(entry.imageUrl).toBe("https://cdn/canon/img1/original.png");

    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.entityType).toBe("CHARACTER");
    expect(entity.slug).toBe("sera-de-vargen");
    expect(entity.wikiEntryId).toBe("wiki01");
    expect(entity.status).toBe("CANONICAL");
    expect(entity.immutableTraits.length).toBe(1);
    expect(entity.canonicalAssetIds).toEqual(["id2"]);

    const asset = vi.mocked(assetsDb.putAsset).mock.calls[0][3];
    expect(asset.entityId).toBe("id1");
    expect(asset.canonicalLevel).toBe("CANONICAL");
    expect(asset.storageKey).toBe("canon/img1/original.png");

    // salva depois de cada passo e no fim
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("skips steps whose id is already recorded", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const partial = submission({ wikiEntryId: "wiki-antigo", visualEntityId: "ent-antiga" });
    const result = await publishCanonSubmission(deps(), partial, save);

    expect(wikiDb.putWikiEntry).not.toHaveBeenCalled();
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
    expect(assetsDb.putAsset).toHaveBeenCalledTimes(1);
    expect(result.wikiEntryId).toBe("wiki-antigo");
    expect(result.visualEntityId).toBe("ent-antiga");
    expect(result.status).toBe("APPROVED");
  });

  it("leaves the submission pending when a step throws, keeping earlier ids", async () => {
    vi.mocked(entitiesDb.putEntity).mockRejectedValueOnce(new Error("dynamo down"));
    const save = vi.fn(async (s: CanonSubmission) => s);
    await expect(publishCanonSubmission(deps(), submission(), save)).rejects.toThrow("dynamo down");

    const lastSaved = save.mock.calls[save.mock.calls.length - 1][0];
    expect(lastSaved.wikiEntryId).toBe("wiki01");
    expect(lastSaved.visualEntityId).toBeNull();
    expect(lastSaved.status).toBe("PENDING_GM");
  });

  it("skips entity and asset when the proposal has no entity type", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const sub = submission();
    const result = await publishCanonSubmission(deps(), { ...sub, proposal: { ...sub.proposal, entityType: null } }, save);
    expect(entitiesDb.putEntity).not.toHaveBeenCalled();
    expect(assetsDb.putAsset).not.toHaveBeenCalled();
    expect(result.status).toBe("APPROVED");
    expect(result.visualEntityId).toBeNull();
  });

  it("skips the asset when there is no uploaded image", async () => {
    const save = vi.fn(async (s: CanonSubmission) => s);
    const result = await publishCanonSubmission(deps(), submission({ rawImageUrl: null, rawImageKey: null }), save);
    expect(entitiesDb.putEntity).toHaveBeenCalledTimes(1);
    expect(assetsDb.putAsset).not.toHaveBeenCalled();
    expect(result.visualAssetId).toBeNull();
    expect(result.status).toBe("APPROVED");
  });

  it("disambiguates a slug that is already taken", async () => {
    vi.mocked(entitiesDb.listEntities).mockResolvedValueOnce([{ slug: "sera-de-vargen" } as never]);
    const save = vi.fn(async (s: CanonSubmission) => s);
    await publishCanonSubmission(deps(), submission(), save);
    const entity = vi.mocked(entitiesDb.putEntity).mock.calls[0][3];
    expect(entity.slug).not.toBe("sera-de-vargen");
    expect(entity.slug.startsWith("sera-de-vargen-")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- canon/publish`
Expected: FAIL — `Failed to resolve import "./publish"`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/canon/publish.ts`:

```ts
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { newVisualEntity, type CanonSubmission, type VisualAsset, type WikiEntry } from "@ravenloft/content";
import { putWikiEntry, generateWikiId } from "../db/wiki";
import { putEntity, listEntities } from "../db/visual/entities";
import { putAsset } from "../db/visual/assets";
import { slugify } from "../validation/visualSchemas";

export interface PublishDeps {
  doc: DynamoDBDocumentClient;
  tableName: string;
  campaignId: string;
  newId: () => string;
}

export type SaveSubmission = (submission: CanonSubmission) => Promise<CanonSubmission>;

function guessMimeType(key: string): string {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * Aprova e publica uma submissão em três passos independentes.
 *
 * Não existe transação entre uma escrita e a próxima. Cada passo grava o id que
 * produziu antes de o seguinte começar, e é pulado quando esse id já existe —
 * assim reaprovar depois de uma falha no meio retoma de onde parou em vez de
 * criar um segundo verbete.
 */
export async function publishCanonSubmission(
  deps: PublishDeps,
  submission: CanonSubmission,
  save: SaveSubmission,
): Promise<CanonSubmission> {
  const { doc, tableName, campaignId } = deps;
  let current: CanonSubmission = { ...submission };
  const touch = async () => {
    current = { ...current, updatedAt: new Date().toISOString() };
    await save(current);
  };

  if (!current.wikiEntryId) {
    const entry: WikiEntry = {
      entryId: generateWikiId(),
      section: current.proposal.section,
      title: current.proposal.title,
      body: current.proposal.body,
      order: 999,
      updatedAt: new Date().toISOString(),
      ...(current.rawImageUrl ? { imageUrl: current.rawImageUrl, imageUrls: [current.rawImageUrl] } : {}),
    };
    await putWikiEntry(doc, tableName, campaignId, entry);
    current = { ...current, wikiEntryId: entry.entryId };
    await touch();
  }

  const wantsEntity = current.proposal.entityType !== null;

  if (wantsEntity && !current.visualEntityId) {
    const existing = await listEntities(doc, tableName, campaignId);
    let slug = slugify(current.proposal.canonicalName);
    if (existing.some((e) => e.slug === slug)) slug = `${slug}-${deps.newId().slice(0, 4)}`;
    const entity = newVisualEntity({
      id: deps.newId(),
      campaignId,
      entityType: current.proposal.entityType!,
      canonicalName: current.proposal.canonicalName,
      slug,
      publicDescription: current.proposal.summary,
      immutableTraits: current.proposal.immutableTraits,
      wikiEntryId: current.wikiEntryId,
      houseId: current.proposal.houseId,
    });
    entity.status = "CANONICAL";
    await putEntity(doc, tableName, campaignId, entity);
    current = { ...current, visualEntityId: entity.id };
    await touch();
  }

  if (wantsEntity && current.visualEntityId && current.rawImageKey && current.rawImageUrl && !current.visualAssetId) {
    const now = new Date().toISOString();
    const asset: VisualAsset = {
      id: deps.newId(),
      campaignId,
      entityId: current.visualEntityId,
      assetType: "PORTRAIT",
      storageKey: current.rawImageKey,
      storageUrl: current.rawImageUrl,
      thumbnailStorageKey: null,
      thumbnailUrl: null,
      mimeType: guessMimeType(current.rawImageKey),
      // Enviada pelo jogador, não gerada: não passamos por decodificação de
      // imagem, então dimensões e checksum ficam vazios de propósito.
      width: 0,
      height: 0,
      aspectRatio: "",
      checksum: "",
      status: "READY",
      canonicalLevel: "CANONICAL",
      styleBibleVersion: 0,
      entityVersion: 1,
      generationId: null,
      parentAssetIds: [],
      referenceRoles: [],
      cameraAngle: "",
      viewType: "",
      description: current.proposal.summary,
      extractedVisualDescription: "",
      consistencyScore: null,
      consistencyReport: null,
      tags: ["canon-submission"],
      createdAt: now,
    };
    await putAsset(doc, tableName, campaignId, asset);
    const entity = await listEntities(doc, tableName, campaignId).then((all) => all.find((e) => e.id === current.visualEntityId));
    if (entity) {
      await putEntity(doc, tableName, campaignId, { ...entity, canonicalAssetIds: [asset.id], updatedAt: now });
    }
    current = { ...current, visualAssetId: asset.id };
    await touch();
  }

  current = { ...current, status: "APPROVED", resolvedAt: new Date().toISOString() };
  await touch();
  return current;
}
```

Nota: `newVisualEntity` aceita `immutableTraits`, `wikiEntryId` e `houseId` no input (`NewVisualEntityInput`); ele mesmo faz o clamp e preenche o resto com padrões. `entityVersion: 1` casa com o `version: 1` que `newVisualEntity` devolve. Se `PORTRAIT` não estiver em `VISUAL_ASSET_TYPES`, use o primeiro valor da lista que descreva uma imagem única — confira `shared/src/visual/models.ts:11`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- canon/publish`
Expected: PASS (6 testes).

Se o teste "creates wiki entry, entity and asset" falhar em `canonicalAssetIds`, é porque o mock de `listEntities` devolve `[]` na segunda chamada. Nesse caso ajuste o teste para mockar `listEntities` devolvendo `[]` na primeira chamada e a entidade criada na segunda:

```ts
vi.mocked(entitiesDb.listEntities)
  .mockResolvedValueOnce([])
  .mockResolvedValueOnce([{ id: "id1", slug: "sera-de-vargen", canonicalAssetIds: [] } as never]);
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/canon/publish.ts backend/src/canon/publish.test.ts
git commit -m "feat(canônico): publicação retomável de verbete, entidade e imagem"
```

---

## Task 6: Upload da imagem para o S3

**Files:**
- Modify: `backend/src/storage/images.ts`
- Modify: `backend/src/storage/images.test.ts`

- [ ] **Step 1: Write the failing test**

Acrescente ao final de `backend/src/storage/images.test.ts` (dentro do `describe` existente de `makeImageStore`, ou em um novo):

```ts
describe("uploadCanonImage", () => {
  it("stores under canon/<id>/original.<ext> and returns key and url", async () => {
    const send = vi.fn().mockResolvedValue({});
    vi.mocked(S3Client).mockImplementation(() => ({ send }) as never);
    const store = makeImageStore("bucket", "https://cdn.exemplo", "us-east-1");
    const result = await store.uploadCanonImage("img1", Buffer.from([1, 2]), "image/jpeg");
    expect(result.key).toBe("canon/img1/original.jpg");
    expect(result.url.startsWith("https://cdn.exemplo/canon/img1/original.jpg?v=")).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
```

Siga exatamente o modo como o arquivo de teste existente mocka o `S3Client` — não invente um mock novo; copie o padrão do teste de `uploadTurnImage`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- storage/images`
Expected: FAIL — `store.uploadCanonImage is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `backend/src/storage/images.ts`, acrescente à interface `ImageStore`:

```ts
  uploadCanonImage(
    imageId: string,
    body: Buffer,
    contentType?: StoredImageContentType,
  ): Promise<{ key: string; url: string }>;
```

E ao objeto devolvido por `makeImageStore`, depois de `uploadVisualAsset`:

```ts
    async uploadCanonImage(imageId, body, contentType = "image/png") {
      const key = `canon/${imageId}/original.${imageExtension(contentType)}`;
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
      return { key, url: `${baseUrl}/${key}?v=${Date.now()}` };
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- storage/images`
Expected: PASS.

Se outros arquivos implementarem `ImageStore` à mão (fakes em testes), o compilador vai acusar. Rode `npm run build -w backend` e acrescente `uploadCanonImage: async () => ({ key: "", url: "" })` a cada fake que quebrar.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storage/images.ts backend/src/storage/images.test.ts
git commit -m "feat(canônico): upload de imagem de submissão para o S3"
```

---

## Task 7: Rotas do jogador

**Files:**
- Create: `backend/src/routes/canonRoutes.ts`
- Create: `backend/src/routes/canonRoutes.test.ts`

Quatro rotas: prévia com IA, upload de imagem, envio da submissão e listagem das próprias submissões.

- [ ] **Step 1: Write the failing test**

Create `backend/src/routes/canonRoutes.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonPreview, canonUploadImage, canonSubmit, canonListMine } from "./canonRoutes";
import { signToken } from "../auth/tokens";
import type { Config, HandlerRequest } from "../types/domain";
import { HttpError } from "../types/domain";

vi.mock("../db/wiki", () => ({ listCanonWikiEntries: vi.fn(async () => []) }));
vi.mock("../db/canonSubmissions", () => ({
  putCanonSubmission: vi.fn(async (_d, _t, _c, s) => s),
  listCanonSubmissions: vi.fn(async () => []),
}));
vi.mock("../db/rateLimit", () => ({ hitRateLimit: vi.fn(async () => 1) }));

import * as canonDb from "../db/canonSubmissions";
import * as rateLimitDb from "../db/rateLimit";

const config = {
  campaignId: "winter-dead",
  tableName: "ravenloft-game",
  tokenSigningSecret: "segredo",
  tokenTtlSeconds: 3600,
} as unknown as Config;

function playerReq(over: Partial<HandlerRequest> = {}): HandlerRequest {
  const token = signToken(
    { type: "player", campaignId: "winter-dead", houseId: "vargen", displayName: "Casa Vargen", exp: Date.now() + 60_000 },
    "segredo",
  );
  return {
    method: "POST",
    path: "/api/player/canonico",
    headers: { authorization: `Bearer ${token}` },
    query: {},
    pathParams: {},
    body: {},
    ...over,
  } as HandlerRequest;
}

const proposal = {
  title: "Sera de Vargen",
  section: "casas",
  body: "Batedora das fronteiras.",
  summary: "Batedora.",
  entityType: "CHARACTER",
  canonicalName: "Sera de Vargen",
  immutableTraits: [],
  houseId: "vargen",
};

const chat = vi.fn();
const deps = () => ({ doc: {} as never, config, chat }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimitDb.hitRateLimit).mockResolvedValue(1);
});

describe("canonPreview", () => {
  it("returns a proposal and a review", async () => {
    chat
      .mockResolvedValueOnce(JSON.stringify(proposal))
      .mockResolvedValueOnce(JSON.stringify({ verdict: "OK", flags: [], conflictingEntryIds: [] }));
    const res = await canonPreview(deps(), playerReq({ body: { rawText: "Quero criar Sera." } }));
    expect(res.status).toBe(200);
    expect((res.body as { proposal: { title: string } }).proposal.title).toBe("Sera de Vargen");
    expect((res.body as { review: { verdict: string } }).review.verdict).toBe("OK");
  });

  it("refuses when the AI is not configured", async () => {
    await expect(
      canonPreview({ doc: {} as never, config } as never, playerReq({ body: { rawText: "x" } })),
    ).rejects.toMatchObject({ code: "AI_DISABLED" });
  });

  it("refuses past the hourly quota", async () => {
    vi.mocked(rateLimitDb.hitRateLimit).mockResolvedValue(11);
    await expect(canonPreview(deps(), playerReq({ body: { rawText: "x" } }))).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("canonSubmit", () => {
  it("stores a pending submission owned by the player's house", async () => {
    const res = await canonSubmit(deps(), playerReq({ body: { rawText: "Quero criar Sera.", proposal } }));
    expect(res.status).toBe(200);
    const saved = vi.mocked(canonDb.putCanonSubmission).mock.calls[0][3];
    expect(saved.houseId).toBe("vargen");
    expect(saved.authorName).toBe("Casa Vargen");
    expect(saved.status).toBe("PENDING_GM");
  });

  it("refuses more than five pending submissions", async () => {
    vi.mocked(canonDb.listCanonSubmissions).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, status: "PENDING_GM" })) as never,
    );
    await expect(canonSubmit(deps(), playerReq({ body: { rawText: "x", proposal } }))).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      canonSubmit(deps(), { ...playerReq(), headers: {} } as HandlerRequest),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe("canonListMine", () => {
  it("lists only this house's submissions", async () => {
    await canonListMine(deps(), playerReq({ method: "GET" }));
    expect(vi.mocked(canonDb.listCanonSubmissions).mock.calls[0][3]).toBe("vargen");
  });
});

describe("canonUploadImage", () => {
  it("refuses when the image store is not configured", async () => {
    await expect(canonUploadImage(deps(), playerReq())).rejects.toMatchObject({ code: "IMAGE_DISABLED" });
  });

  it("uploads and returns url and key", async () => {
    const uploadCanonImage = vi.fn(async () => ({ key: "canon/x/original.png", url: "https://cdn/x.png" }));
    const boundary = "----x";
    const raw = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      Buffer.from([1, 2, 3]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await canonUploadImage(
      { doc: {} as never, config, imageStore: { uploadCanonImage } } as never,
      playerReq({ headers: { ...playerReq().headers, "content-type": `multipart/form-data; boundary=${boundary}` }, rawBody: raw } as never),
    );
    expect(res.body).toEqual({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- canonRoutes`
Expected: FAIL — `Failed to resolve import "./canonRoutes"`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/routes/canonRoutes.ts`:

```ts
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import type { Deps } from "./publicRoutes";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { listCanonWikiEntries } from "../db/wiki";
import { putCanonSubmission, getCanonSubmission, listCanonSubmissions } from "../db/canonSubmissions";
import { hitRateLimit } from "../db/rateLimit";
import { generateJson } from "../ai/openai";
import { buildCanonContext, buildCanonProposalPrompt, parseCanonProposalJson, buildCanonReviewPrompt, parseCanonReviewJson } from "../ai/canonPrompts";
import { parseCanonPreviewBody, parseCanonSubmitBody, parseCanonApproveBody, parseCanonRejectBody, parseUploadCanonImageBody } from "../validation/schemas";
import { publishCanonSubmission } from "../canon/publish";
import { newCanonSubmission, CANON_GM_NOTE_MAX, clampText } from "@ravenloft/content";

/** Dez prévias de IA por hora por Casa: a chamada é cara e o texto é curto. */
const PREVIEW_LIMIT = 10;
const PREVIEW_WINDOW_SECONDS = 3600;
/** Uma fila de revisão que não acaba nunca não é uma fila. */
const MAX_PENDING_PER_HOUSE = 5;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function canonPreview(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  if (!deps.chat) throw new HttpError(503, "AI_DISABLED", "A IA não está configurada.");
  const { rawText } = parseCanonPreviewBody(req.body);

  const hits = await hitRateLimit(deps.doc, deps.config.tableName, `canon-preview:${player.houseId}`, PREVIEW_WINDOW_SECONDS);
  if (hits > PREVIEW_LIMIT) {
    throw new HttpError(429, "RATE_LIMITED", "Limite de prévias por hora atingido. Tente mais tarde.");
  }

  const wiki = await listCanonWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId);
  const canon = buildCanonContext(wiki);

  const proposalPrompt = buildCanonProposalPrompt(player.displayName, canon, rawText);
  const proposal = await generateJson(deps.chat, proposalPrompt.system, proposalPrompt.user, parseCanonProposalJson, 2, 1600);

  const reviewPrompt = buildCanonReviewPrompt(canon, proposal);
  const review = await generateJson(deps.chat, reviewPrompt.system, reviewPrompt.user, parseCanonReviewJson, 2, 800);

  return { status: 200, body: { proposal, review } };
}

export async function canonUploadImage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requirePlayer(deps.config, req);
  if (!deps.imageStore) throw new HttpError(503, "IMAGE_DISABLED", "Upload de imagens não configurado.");
  const { body, contentType } = parseUploadCanonImageBody(req.headers, req.rawBody);
  const { key, url } = await deps.imageStore.uploadCanonImage(newId(), body, contentType);
  return { status: 200, body: { imageUrl: url, imageKey: key } };
}

export async function canonSubmit(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const input = parseCanonSubmitBody(req.body);

  const mine = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (mine.filter((s) => s.status === "PENDING_GM").length >= MAX_PENDING_PER_HOUSE) {
    throw new HttpError(409, "BAD_STATUS", "Você já tem cinco propostas aguardando o Mestre.");
  }

  const submission = newCanonSubmission({
    id: newId(),
    campaignId: deps.config.campaignId,
    houseId: player.houseId,
    authorName: player.displayName,
    rawText: input.rawText,
    rawImageUrl: input.rawImageUrl,
    rawImageKey: input.rawImageKey,
    proposal: input.proposal,
  });
  await putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, submission);
  return { status: 200, body: submission };
}

export async function canonListMine(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const submissions = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  return { status: 200, body: submissions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- canonRoutes`
Expected: PASS (8 testes). Os imports de `requireAdmin`, `getCanonSubmission`, `parseCanonApproveBody`, `parseCanonRejectBody`, `publishCanonSubmission`, `CANON_GM_NOTE_MAX` e `clampText` ainda não são usados — a Task 8 os consome. Se o lint reclamar de import não usado, adicione-os só na Task 8.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/canonRoutes.ts backend/src/routes/canonRoutes.test.ts
git commit -m "feat(canônico): rotas de prévia, upload e envio do jogador"
```

---

## Task 8: Rotas do Mestre

**Files:**
- Modify: `backend/src/routes/canonRoutes.ts`
- Modify: `backend/src/routes/canonRoutes.test.ts`

- [ ] **Step 1: Write the failing test**

Acrescente ao final de `backend/src/routes/canonRoutes.test.ts`:

```ts
import { adminCanonList, adminCanonApprove, adminCanonReject } from "./canonRoutes";
import { getCanonSubmission } from "../db/canonSubmissions";
import { publishCanonSubmission } from "../canon/publish";

vi.mock("../canon/publish", () => ({ publishCanonSubmission: vi.fn(async (_d, s) => ({ ...s, status: "APPROVED" })) }));

function adminReq(over: Partial<HandlerRequest> = {}): HandlerRequest {
  const token = signToken({ type: "admin", campaignId: "winter-dead", exp: Date.now() + 60_000 }, "segredo");
  return { ...playerReq(over), headers: { authorization: `Bearer ${token}`, ...(over.headers ?? {}) } } as HandlerRequest;
}

const pending = {
  id: "sub1",
  campaignId: "winter-dead",
  houseId: "vargen",
  authorName: "Casa Vargen",
  rawText: "Quero criar Sera.",
  rawImageUrl: null,
  rawImageKey: null,
  proposal,
  review: null,
  status: "PENDING_GM",
  gmNote: "",
  wikiEntryId: null,
  visualEntityId: null,
  visualAssetId: null,
  resolvedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("admin canon routes", () => {
  it("lists every submission in the campaign", async () => {
    await adminCanonList(deps(), adminReq({ method: "GET" }));
    expect(vi.mocked(canonDb.listCanonSubmissions).mock.calls[0][3]).toBeUndefined();
  });

  it("rejects a non-admin caller", async () => {
    await expect(adminCanonList(deps(), playerReq({ method: "GET" }))).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("approves using the GM's edited proposal", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(pending as never);
    const edited = { ...proposal, title: "Sera, a Batedora" };
    const res = await adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1", proposal: edited } }));
    expect(res.status).toBe(200);
    const passed = vi.mocked(publishCanonSubmission).mock.calls[0][1];
    expect(passed.proposal.title).toBe("Sera, a Batedora");
  });

  it("refuses to approve a submission that is not pending", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue({ ...pending, status: "APPROVED" } as never);
    await expect(
      adminCanonApprove(deps(), adminReq({ body: { submissionId: "sub1" } })),
    ).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("404s on an unknown submission", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(null);
    await expect(
      adminCanonApprove(deps(), adminReq({ body: { submissionId: "nope" } })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects with a note and publishes nothing", async () => {
    vi.mocked(getCanonSubmission).mockResolvedValue(pending as never);
    const res = await adminCanonReject(deps(), adminReq({ body: { submissionId: "sub1", note: "Conflita com o cerco." } }));
    expect((res.body as { status: string; gmNote: string }).status).toBe("REJECTED");
    expect((res.body as { gmNote: string }).gmNote).toBe("Conflita com o cerco.");
    expect(publishCanonSubmission).not.toHaveBeenCalled();
  });
});
```

Ajuste o `vi.mock("../db/canonSubmissions", ...)` do topo do arquivo para também expor `getCanonSubmission: vi.fn()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- canonRoutes`
Expected: FAIL — `adminCanonList is not a function`.

- [ ] **Step 3: Write minimal implementation**

Acrescente ao final de `backend/src/routes/canonRoutes.ts`:

```ts
async function loadPending(deps: Deps, submissionId: string) {
  const submission = await getCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, submissionId);
  if (!submission) throw new HttpError(404, "NOT_FOUND", "Proposta não encontrada.");
  if (submission.status !== "PENDING_GM") throw new HttpError(409, "BAD_STATUS", "Proposta já foi julgada.");
  return submission;
}

export async function adminCanonList(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const submissions = await listCanonSubmissions(deps.doc, deps.config.tableName, deps.config.campaignId);
  return { status: 200, body: submissions };
}

export async function adminCanonApprove(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { submissionId, proposal } = parseCanonApproveBody(req.body);
  const submission = await loadPending(deps, submissionId);
  // O Mestre pode reescrever o verbete antes de publicar; o que ele mandou é
  // o que vira cânone.
  const toPublish = proposal ? { ...submission, proposal } : submission;
  const published = await publishCanonSubmission(
    { doc: deps.doc, tableName: deps.config.tableName, campaignId: deps.config.campaignId, newId },
    toPublish,
    (s) => putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, s),
  );
  return { status: 200, body: published };
}

export async function adminCanonReject(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const { submissionId, note } = parseCanonRejectBody(req.body);
  const submission = await loadPending(deps, submissionId);
  const rejected = {
    ...submission,
    status: "REJECTED" as const,
    gmNote: clampText(note, CANON_GM_NOTE_MAX),
    resolvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putCanonSubmission(deps.doc, deps.config.tableName, deps.config.campaignId, rejected);
  return { status: 200, body: rejected };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- canonRoutes`
Expected: PASS (14 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/canonRoutes.ts backend/src/routes/canonRoutes.test.ts
git commit -m "feat(canônico): fila de revisão do Mestre com aprovar e rejeitar"
```

---

## Task 9: Registrar as rotas

**Files:**
- Modify: `backend/src/router.ts`
- Modify: `backend/src/router.test.ts`

- [ ] **Step 1: Write the failing test**

Acrescente ao final de `backend/src/router.test.ts` (siga o padrão de asserção já usado no arquivo; se ele testa `matchRoute`/`handle`, use o mesmo):

```ts
describe("canon routes", () => {
  it("routes every canon path", async () => {
    for (const [method, path] of [
      ["POST", "/api/player/canonico/preview"],
      ["POST", "/api/player/canonico/imagem"],
      ["POST", "/api/player/canonico"],
      ["GET", "/api/player/canonico"],
      ["GET", "/api/admin/canonico"],
      ["POST", "/api/admin/canonico/approve"],
      ["POST", "/api/admin/canonico/reject"],
    ] as const) {
      const res = await route({ doc: {} as never, config } as never, {
        method, path, headers: {}, query: {}, pathParams: {}, body: {},
      } as never);
      expect(res.status).not.toBe(404);
    }
  });
});
```

Sem sessão, cada uma deve responder 401 — o que importa é que nenhuma responda 404.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- router`
Expected: FAIL — as sete rotas respondem 404.

- [ ] **Step 3: Write minimal implementation**

Em `backend/src/router.ts`, acrescente o import:

```ts
import { canonPreview, canonUploadImage, canonSubmit, canonListMine, adminCanonList, adminCanonApprove, adminCanonReject } from "./routes/canonRoutes";
```

E, dentro do array `routes`, logo depois da linha `r("PUT", "/api/player/order", submitOrder),`:

```ts
  r("POST", "/api/player/canonico/preview", canonPreview),
  r("POST", "/api/player/canonico/imagem", canonUploadImage),
  r("POST", "/api/player/canonico", canonSubmit),
  r("GET", "/api/player/canonico", canonListMine),
  r("GET", "/api/admin/canonico", adminCanonList),
  r("POST", "/api/admin/canonico/approve", adminCanonApprove),
  r("POST", "/api/admin/canonico/reject", adminCanonReject),
```

A ordem importa: `/api/player/canonico/preview` precisa vir antes de `/api/player/canonico` só se algum padrão for prefixo do outro — aqui o regex é ancorado com `^...$`, então não há ambiguidade. Mantenha a ordem acima por legibilidade.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend`
Expected: PASS — toda a suíte do backend.

- [ ] **Step 5: Commit**

```bash
git add backend/src/router.ts backend/src/router.test.ts
git commit -m "feat(canônico): registra as sete rotas de cânone"
```

---

## Task 10: Camada de API do frontend

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/httpClient.ts`
- Modify: `frontend/src/api/mockClient.ts`
- Modify: `frontend/src/api/mockClient.test.ts`

Os três precisam andar juntos: `client.ts` é a interface, `httpClient.ts` fala com a Lambda e `mockClient.ts` é o que os testes de componente e o Playwright usam.

- [ ] **Step 1: Write the failing test**

Acrescente ao final de `frontend/src/api/mockClient.test.ts`:

```ts
describe("mock canon submissions", () => {
  it("previews, submits, lists and approves", async () => {
    const client = new MockApiClient();
    const { playerToken } = await client.login("VARGEN-0001");
    const { adminToken } = await client.adminLogin("admin");

    const preview = await client.playerCanonPreview(playerToken, "Quero criar Sera, batedora de Vargen.");
    expect(preview.proposal.title.length).toBeGreaterThan(0);
    expect(preview.review.verdict).toBe("OK");

    const submitted = await client.playerCanonSubmit(playerToken, {
      rawText: "Quero criar Sera, batedora de Vargen.",
      rawImageUrl: null,
      rawImageKey: null,
      proposal: preview.proposal,
    });
    expect(submitted.status).toBe("PENDING_GM");

    expect((await client.playerCanonList(playerToken)).map((s) => s.id)).toContain(submitted.id);
    expect((await client.adminCanonList(adminToken)).map((s) => s.id)).toContain(submitted.id);

    const approved = await client.adminCanonApprove(adminToken, { submissionId: submitted.id, proposal: preview.proposal });
    expect(approved.status).toBe("APPROVED");
    expect(approved.wikiEntryId).not.toBeNull();

    const wiki = await client.getWiki();
    expect(wiki.some((e) => e.title === preview.proposal.title)).toBe(true);
  });

  it("rejects with a note", async () => {
    const client = new MockApiClient();
    const { playerToken } = await client.login("VARGEN-0001");
    const { adminToken } = await client.adminLogin("admin");
    const preview = await client.playerCanonPreview(playerToken, "Uma torre nova.");
    const submitted = await client.playerCanonSubmit(playerToken, {
      rawText: "Uma torre nova.", rawImageUrl: null, rawImageKey: null, proposal: preview.proposal,
    });
    const rejected = await client.adminCanonReject(adminToken, { submissionId: submitted.id, note: "Conflita." });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.gmNote).toBe("Conflita.");
  });
});
```

Use exatamente o código de Casa e o código de admin que os outros testes deste arquivo já usam para `login`/`adminLogin` — não invente credenciais novas.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w frontend -- mockClient`
Expected: FAIL — `client.playerCanonPreview is not a function`.

- [ ] **Step 3: Declare the interface**

Em `frontend/src/api/client.ts`, acrescente ao topo dos imports de tipo:

```ts
import type { CanonSubmission, CanonProposal, CanonReview } from "@ravenloft/content";
```

E acrescente à interface `ApiClient` (perto dos métodos de projeto, por volta da linha 211):

```ts
  playerCanonPreview(playerToken: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview }>;
  playerCanonUploadImage(playerToken: string, file: File): Promise<{ imageUrl: string; imageKey: string }>;
  playerCanonSubmit(playerToken: string, input: CanonSubmitInput): Promise<CanonSubmission>;
  playerCanonList(playerToken: string): Promise<CanonSubmission[]>;
  adminCanonList(adminToken: string): Promise<CanonSubmission[]>;
  adminCanonApprove(adminToken: string, input: { submissionId: string; proposal?: CanonProposal }): Promise<CanonSubmission>;
  adminCanonReject(adminToken: string, input: { submissionId: string; note: string }): Promise<CanonSubmission>;
```

E, fora da interface, no mesmo arquivo:

```ts
export interface CanonSubmitInput {
  rawText: string;
  rawImageUrl: string | null;
  rawImageKey: string | null;
  proposal: CanonProposal;
}
```

- [ ] **Step 4: Implement the HTTP client**

Em `frontend/src/api/httpClient.ts`, acrescente à classe (o helper privado `requestForm(path, formData, token)` já existe na linha 121):

```ts
  playerCanonPreview(playerToken: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview }> {
    return this.request("/api/player/canonico/preview", { method: "POST", body: { rawText }, token: playerToken });
  }

  playerCanonUploadImage(playerToken: string, file: File): Promise<{ imageUrl: string; imageKey: string }> {
    const formData = new FormData();
    formData.append("image", file);
    return this.requestForm<{ imageUrl: string; imageKey: string }>("/api/player/canonico/imagem", formData, playerToken);
  }

  playerCanonSubmit(playerToken: string, input: CanonSubmitInput): Promise<CanonSubmission> {
    return this.request("/api/player/canonico", { method: "POST", body: input, token: playerToken });
  }

  playerCanonList(playerToken: string): Promise<CanonSubmission[]> {
    return this.request("/api/player/canonico", { token: playerToken });
  }

  adminCanonList(adminToken: string): Promise<CanonSubmission[]> {
    return this.request("/api/admin/canonico", { token: adminToken });
  }

  adminCanonApprove(adminToken: string, input: { submissionId: string; proposal?: CanonProposal }): Promise<CanonSubmission> {
    return this.request("/api/admin/canonico/approve", { method: "POST", body: input, token: adminToken });
  }

  adminCanonReject(adminToken: string, input: { submissionId: string; note: string }): Promise<CanonSubmission> {
    return this.request("/api/admin/canonico/reject", { method: "POST", body: input, token: adminToken });
  }
```

Acrescente `CanonSubmitInput` ao import de `./client` e `type CanonSubmission, type CanonProposal, type CanonReview` ao import de `@ravenloft/content` que já existe no topo do arquivo.

Não é preciso mexer na allowlist `API_ERROR_CODES`: `RATE_LIMITED`, `AI_DISABLED`, `IMAGE_DISABLED`, `BAD_STATUS`, `NOT_FOUND` e `INVALID_BODY` já estão lá.

- [ ] **Step 5: Implement the mock client**

Em `frontend/src/api/mockClient.ts`, acrescente um campo privado e os sete métodos:

```ts
  private canonSubmissions: CanonSubmission[] = [];

  async playerCanonPreview(token: string, rawText: string): Promise<{ proposal: CanonProposal; review: CanonReview }> {
    this.requirePlayer(token);
    const title = rawText.trim().slice(0, 60) || "Proposta sem título";
    return {
      proposal: {
        title,
        section: "casas",
        body: `${rawText.trim()}\n\n(Texto normalizado pela IA no ambiente de mock.)`,
        summary: title,
        entityType: "CHARACTER",
        canonicalName: title,
        immutableTraits: [],
        houseId: null,
      },
      review: { verdict: "OK", flags: [], conflictingEntryIds: [] },
    };
  }

  async playerCanonUploadImage(token: string, file: File): Promise<{ imageUrl: string; imageKey: string }> {
    this.requirePlayer(token);
    const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
    const key = `canon/mock-${this.canonSubmissions.length}/original.${extension}`;
    return { imageUrl: `https://mock.images/${key}`, imageKey: key };
  }

  async playerCanonSubmit(token: string, input: CanonSubmitInput): Promise<CanonSubmission> {
    const player = this.requirePlayer(token);
    const now = new Date().toISOString();
    const submission: CanonSubmission = {
      id: `canon-${this.canonSubmissions.length + 1}`,
      campaignId: "winter-dead",
      houseId: player.houseId,
      authorName: player.displayName,
      rawText: input.rawText,
      rawImageUrl: input.rawImageUrl,
      rawImageKey: input.rawImageKey,
      proposal: input.proposal,
      review: null,
      status: "PENDING_GM",
      gmNote: "",
      wikiEntryId: null,
      visualEntityId: null,
      visualAssetId: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.canonSubmissions = [submission, ...this.canonSubmissions];
    return submission;
  }

  async playerCanonList(token: string): Promise<CanonSubmission[]> {
    const player = this.requirePlayer(token);
    return this.canonSubmissions.filter((s) => s.houseId === player.houseId);
  }

  async adminCanonList(token: string): Promise<CanonSubmission[]> {
    this.requireAdmin(token);
    return this.canonSubmissions;
  }

  async adminCanonApprove(token: string, input: { submissionId: string; proposal?: CanonProposal }): Promise<CanonSubmission> {
    this.requireAdmin(token);
    const found = this.canonSubmissions.find((s) => s.id === input.submissionId);
    if (!found) throw new ApiError("NOT_FOUND", "Proposta não encontrada.");
    const proposal = input.proposal ?? found.proposal;
    const entryId = `wiki-${this.canonSubmissions.length}`;
    this.wikiEntries = [
      ...this.wikiEntries,
      { entryId, section: proposal.section, title: proposal.title, body: proposal.body, order: 999, updatedAt: new Date().toISOString() },
    ];
    const now = new Date().toISOString();
    const updated: CanonSubmission = { ...found, proposal, status: "APPROVED", wikiEntryId: entryId, resolvedAt: now, updatedAt: now };
    this.canonSubmissions = this.canonSubmissions.map((s) => (s.id === updated.id ? updated : s));
    return updated;
  }

  async adminCanonReject(token: string, input: { submissionId: string; note: string }): Promise<CanonSubmission> {
    this.requireAdmin(token);
    const found = this.canonSubmissions.find((s) => s.id === input.submissionId);
    if (!found) throw new ApiError("NOT_FOUND", "Proposta não encontrada.");
    const now = new Date().toISOString();
    const updated: CanonSubmission = { ...found, status: "REJECTED", gmNote: input.note, resolvedAt: now, updatedAt: now };
    this.canonSubmissions = this.canonSubmissions.map((s) => (s.id === updated.id ? updated : s));
    return updated;
  }
```

Use os nomes reais dos helpers e do campo de wiki que o `MockApiClient` já tem — se ele guarda os verbetes em outro nome que não `wikiEntries`, ou se `requirePlayer` devolve outra coisa, siga o que está no arquivo em vez do que está escrito acima.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -w frontend -- mockClient`
Expected: PASS (2 testes novos).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/httpClient.ts frontend/src/api/mockClient.ts frontend/src/api/mockClient.test.ts
git commit -m "feat(canônico): métodos de cânone no cliente de API"
```

---

## Task 11: Formulário de proposta do jogador

**Files:**
- Create: `frontend/src/components/CanonSubmitForm.tsx`
- Create: `frontend/src/components/CanonSubmitForm.test.tsx`

Fluxo em duas etapas na mesma tela: o jogador escreve, pede a prévia, revisa/edita o verbete que a IA montou e envia.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/CanonSubmitForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanonSubmitForm } from "./CanonSubmitForm";
import type { CanonProposal, CanonReview } from "@ravenloft/content";

const proposal: CanonProposal = {
  title: "Sera de Vargen",
  section: "casas",
  body: "Batedora das fronteiras.",
  summary: "Batedora.",
  entityType: "CHARACTER",
  canonicalName: "Sera de Vargen",
  immutableTraits: [],
  houseId: "vargen",
};

const review: CanonReview = { verdict: "OK", flags: [], conflictingEntryIds: [] };

function setup(over: Partial<React.ComponentProps<typeof CanonSubmitForm>> = {}) {
  const props = {
    onPreview: vi.fn(async () => ({ proposal, review })),
    onSubmit: vi.fn(async () => {}),
    onUploadImage: vi.fn(async () => ({ imageUrl: "https://cdn/x.png", imageKey: "canon/x/original.png" })),
    ...over,
  };
  render(<CanonSubmitForm {...props} />);
  return props;
}

describe("CanonSubmitForm", () => {
  it("keeps the submit button hidden until there is a preview", () => {
    setup();
    expect(screen.queryByRole("button", { name: /enviar ao mestre/i })).toBeNull();
  });

  it("asks for a preview and shows the proposal for editing", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Quero criar Sera.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith("Quero criar Sera."));
    expect(await screen.findByDisplayValue("Sera de Vargen")).toBeTruthy();
    expect(screen.getByRole("button", { name: /enviar ao mestre/i })).toBeTruthy();
  });

  it("submits the edited proposal", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "Quero criar Sera.");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));

    const titleField = await screen.findByDisplayValue("Sera de Vargen");
    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Sera, a Batedora");
    await userEvent.click(screen.getByRole("button", { name: /enviar ao mestre/i }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    const sent = props.onSubmit.mock.calls[0][0];
    expect(sent.proposal.title).toBe("Sera, a Batedora");
    expect(sent.rawImageUrl).toBeNull();
  });

  it("shows the review flags returned by the model", async () => {
    setup({
      onPreview: vi.fn(async () => ({
        proposal,
        review: { verdict: "CONFLICT", flags: [{ severity: "BLOCK", message: "Contradiz o cerco." }], conflictingEntryIds: [] },
      })),
    });
    await userEvent.type(screen.getByLabelText(/o que você quer tornar canônico/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));
    expect(await screen.findByText(/Contradiz o cerco\./)).toBeTruthy();
  });

  it("refuses to ask for a preview with an empty text", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /gerar prévia/i }));
    expect(props.onPreview).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w frontend -- CanonSubmitForm`
Expected: FAIL — `Failed to resolve import "./CanonSubmitForm"`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/CanonSubmitForm.tsx`:

```tsx
import { useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { WIKI_SECTIONS, isCanonWikiSection, VISUAL_ENTITY_TYPES, CANON_RAW_TEXT_MAX, type CanonProposal, type CanonReview } from "@ravenloft/content";
import type { CanonSubmitInput } from "../api/client";

export interface CanonSubmitFormProps {
  onPreview: (rawText: string) => Promise<{ proposal: CanonProposal; review: CanonReview }>;
  onSubmit: (input: CanonSubmitInput) => Promise<void>;
  onUploadImage: (file: File) => Promise<{ imageUrl: string; imageKey: string }>;
}

const SECTIONS = WIKI_SECTIONS.filter((s) => isCanonWikiSection(s.id));

const SEVERITY_COLOR = { BLOCK: "error", WARN: "warning", INFO: "info" } as const;

export function CanonSubmitForm({ onPreview, onSubmit, onUploadImage }: CanonSubmitFormProps) {
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<CanonProposal | null>(null);
  const [review, setReview] = useState<CanonReview | null>(null);
  const [image, setImage] = useState<{ imageUrl: string; imageKey: string } | null>(null);

  const runPreview = async () => {
    if (!rawText.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await onPreview(rawText.trim());
      setProposal(result.proposal);
      setReview(result.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar a prévia.");
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setImage(await onUploadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        rawText: rawText.trim(),
        rawImageUrl: image?.imageUrl ?? null,
        rawImageKey: image?.imageKey ?? null,
        proposal,
      });
      setRawText("");
      setProposal(null);
      setReview(null);
      setImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a proposta.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (change: Partial<CanonProposal>) => setProposal((p) => (p ? { ...p, ...change } : p));

  return (
    <Stack spacing={2}>
      <TextField
        label="O que você quer tornar canônico"
        helperText="Descreva o personagem, lugar ou fato. O Mestre lê antes de publicar."
        value={rawText}
        onChange={(e) => setRawText(e.target.value.slice(0, CANON_RAW_TEXT_MAX))}
        multiline
        minRows={4}
        fullWidth
      />

      <Stack direction="row" spacing={2} alignItems="center">
        <Button variant="contained" onClick={runPreview} disabled={busy}>
          Gerar prévia
        </Button>
        <Button component="label" variant="outlined" disabled={busy}>
          {image ? "Trocar imagem" : "Anexar imagem"}
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickImage(e.target.files?.[0])} />
        </Button>
        {image ? <Typography variant="body2">Imagem anexada.</Typography> : null}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {review && review.flags.length > 0 ? (
        <Stack spacing={1}>
          {review.flags.map((flag, i) => (
            <Alert key={i} severity={SEVERITY_COLOR[flag.severity]}>
              {flag.message}
            </Alert>
          ))}
        </Stack>
      ) : null}

      {proposal ? (
        <Box>
          <Stack spacing={2}>
            <Chip label={`Parecer da IA: ${review?.verdict ?? "OK"}`} size="small" sx={{ alignSelf: "flex-start" }} />
            <TextField label="Título" value={proposal.title} onChange={(e) => patch({ title: e.target.value })} fullWidth />
            <TextField label="Seção" select value={proposal.section} onChange={(e) => patch({ section: e.target.value })} fullWidth>
              {SECTIONS.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tipo de entidade"
              select
              value={proposal.entityType ?? ""}
              onChange={(e) => patch({ entityType: (e.target.value || null) as CanonProposal["entityType"] })}
              fullWidth
            >
              <MenuItem value="">Nenhum (só verbete)</MenuItem>
              {VISUAL_ENTITY_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField label="Verbete" value={proposal.body} onChange={(e) => patch({ body: e.target.value })} multiline minRows={8} fullWidth />
            <Button variant="contained" onClick={send} disabled={busy}>
              Enviar ao Mestre
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w frontend -- CanonSubmitForm`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CanonSubmitForm.tsx frontend/src/components/CanonSubmitForm.test.tsx
git commit -m "feat(canônico): formulário de proposta com prévia editável"
```

---

## Task 12: Página `/canonico`

**Files:**
- Create: `frontend/src/pages/CanonicoPage.tsx`
- Create: `frontend/src/pages/CanonicoPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/navigation.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/CanonicoPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CanonicoPage } from "./CanonicoPage";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { savePlayerSession, clearPlayerSession } from "../auth/playerSession";

async function renderPage() {
  const api = new MockApiClient();
  const { playerToken, house } = await api.login("VARGEN-0001");
  savePlayerSession({ playerToken, house } as never);
  render(
    <MemoryRouter>
      <ApiProvider client={api}>
        <CanonicoPage />
      </ApiProvider>
    </MemoryRouter>,
  );
  return api;
}

beforeEach(() => clearPlayerSession());

describe("CanonicoPage", () => {
  it("shows the submission form to a logged-in player", async () => {
    await renderPage();
    expect(await screen.findByLabelText(/o que você quer tornar canônico/i)).toBeTruthy();
  });

  it("lists the house's own submissions with their status", async () => {
    const api = await renderPage();
    const session = { playerToken: (await api.login("VARGEN-0001")).playerToken };
    const preview = await api.playerCanonPreview(session.playerToken, "Sera de Vargen.");
    await api.playerCanonSubmit(session.playerToken, {
      rawText: "Sera de Vargen.", rawImageUrl: null, rawImageKey: null, proposal: preview.proposal,
    });
    expect(await screen.findByText(/Aguardando o Mestre/i)).toBeTruthy();
  });
});
```

Ajuste `savePlayerSession`/`loadPlayerSession` e o código de Casa ao que `frontend/src/auth/playerSession.ts` e o `MockApiClient` realmente expõem — copie de um teste de página existente que já faz login.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w frontend -- CanonicoPage`
Expected: FAIL — `Failed to resolve import "./CanonicoPage"`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/pages/CanonicoPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { CanonSubmission, CanonSubmissionStatus } from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import type { CanonSubmitInput } from "../api/client";
import { loadPlayerSession } from "../auth/playerSession";
import { CanonSubmitForm } from "../components/CanonSubmitForm";
import { Layout } from "../components/Layout";
import { ApiError } from "../types/api";

const STATUS_LABEL: Record<CanonSubmissionStatus, string> = {
  PENDING_GM: "Aguardando o Mestre",
  APPROVED: "Publicado na Enciclopédia",
  REJECTED: "Recusado",
};

const STATUS_COLOR: Record<CanonSubmissionStatus, "warning" | "success" | "default"> = {
  PENDING_GM: "warning",
  APPROVED: "success",
  REJECTED: "default",
};

export function CanonicoPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<CanonSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);

  const token = loadPlayerSession()?.playerToken ?? null;

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setSubmissions(await api.playerCanonList(token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao carregar suas propostas.");
    }
  }, [api, token]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    void refresh();
  }, [token, navigate, refresh]);

  if (!token) return null;

  const preview = (rawText: string) => api.playerCanonPreview(token, rawText);
  const upload = (file: File) => api.playerCanonUploadImage(token, file);
  const submit = async (input: CanonSubmitInput) => {
    await api.playerCanonSubmit(token, input);
    await refresh();
  };

  return (
    <Layout>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Adicionar Canônico</Typography>
          <Typography color="text.secondary">
            Escreva o que você quer acrescentar ao mundo. A IA organiza em verbete, o Mestre revisa e, se aprovar,
            o texto entra na Enciclopédia e passa a valer para todo o jogo.
          </Typography>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <CanonSubmitForm onPreview={preview} onSubmit={submit} onUploadImage={upload} />

        <Stack spacing={2}>
          <Typography variant="h6">Suas propostas</Typography>
          {submissions.length === 0 ? (
            <Typography color="text.secondary">Você ainda não propôs nada.</Typography>
          ) : null}
          {submissions.map((s) => (
            <Card key={s.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight="bold">{s.proposal.title}</Typography>
                  <Chip size="small" color={STATUS_COLOR[s.status]} label={STATUS_LABEL[s.status]} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{s.proposal.summary}</Typography>
                {s.gmNote ? <Alert severity="info" sx={{ mt: 1 }}>{s.gmNote}</Alert> : null}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Layout>
  );
}
```

- [ ] **Step 4: Wire the route and the nav link**

Em `frontend/src/App.tsx`, acrescente o import junto dos outros e a rota logo depois da de `/game`:

```tsx
import { CanonicoPage } from "./pages/CanonicoPage";
```

```tsx
      <Route path="/canonico" element={<RequirePlayer><CanonicoPage /></RequirePlayer>} />
```

Em `frontend/src/components/navigation.ts`, acrescente a `PLAY_LINKS`, depois de "Meu turno":

```ts
  { label: "Adicionar Canônico", to: "/canonico", hint: "Propor um personagem, lugar ou fato para o mundo" },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w frontend -- CanonicoPage`
Expected: PASS (2 testes).

Se `navigation.test.ts` afirmar a quantidade de links de `PLAY_LINKS`, atualize o número.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CanonicoPage.tsx frontend/src/pages/CanonicoPage.test.tsx frontend/src/App.tsx frontend/src/components/navigation.ts
git commit -m "feat(canônico): página do jogador em /canonico"
```

---

## Task 13: Aba "Canônico" no painel do Mestre

**Files:**
- Create: `frontend/src/components/admin/AdminCanonTab.tsx`
- Create: `frontend/src/components/admin/AdminCanonTab.test.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`

Siga a assinatura de props de `AdminProjectsTab`: `{ adminToken, busy, onError }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/AdminCanonTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCanonTab } from "./AdminCanonTab";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";

async function setup() {
  const api = new MockApiClient();
  const { playerToken } = await api.login("VARGEN-0001");
  const { adminToken } = await api.adminLogin("admin");
  const preview = await api.playerCanonPreview(playerToken, "Sera de Vargen, batedora.");
  await api.playerCanonSubmit(playerToken, {
    rawText: "Sera de Vargen, batedora.", rawImageUrl: null, rawImageKey: null, proposal: preview.proposal,
  });
  const onError = vi.fn();
  render(
    <ApiProvider client={api}>
      <AdminCanonTab adminToken={adminToken} busy={false} onError={onError} />
    </ApiProvider>,
  );
  return { api, adminToken, onError };
}

describe("AdminCanonTab", () => {
  it("lists pending submissions with the author's house", async () => {
    await setup();
    expect(await screen.findByText(/Sera de Vargen/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /aprovar e publicar/i })).toBeTruthy();
  });

  it("approves the submission and removes it from the pending list", async () => {
    const { api, adminToken } = await setup();
    await screen.findByText(/Sera de Vargen/);
    await userEvent.click(screen.getByRole("button", { name: /aprovar e publicar/i }));
    await waitFor(async () => {
      const all = await api.adminCanonList(adminToken);
      expect(all[0].status).toBe("APPROVED");
    });
  });

  it("rejects with the typed note", async () => {
    const { api, adminToken } = await setup();
    await screen.findByText(/Sera de Vargen/);
    await userEvent.type(screen.getByLabelText(/nota para o jogador/i), "Conflita com o cerco.");
    await userEvent.click(screen.getByRole("button", { name: /recusar/i }));
    await waitFor(async () => {
      const all = await api.adminCanonList(adminToken);
      expect(all[0].status).toBe("REJECTED");
      expect(all[0].gmNote).toBe("Conflita com o cerco.");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w frontend -- AdminCanonTab`
Expected: FAIL — `Failed to resolve import "./AdminCanonTab"`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/admin/AdminCanonTab.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CanonSubmission } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { ApiError } from "../../types/api";

export function AdminCanonTab({ adminToken, busy, onError }: { adminToken: string; busy: boolean; onError: (m: string) => void }) {
  const api = useApi();
  const [submissions, setSubmissions] = useState<CanonSubmission[]>([]);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setSubmissions(await api.adminCanonList(adminToken)); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Erro ao carregar propostas."); }
  }, [api, adminToken, onError]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); await load(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Falha na ação."); }
    finally { setWorking(false); }
  }, [load, onError]);

  const pending = useMemo(() => submissions.filter((s) => s.status === "PENDING_GM"), [submissions]);
  const judged = useMemo(() => submissions.filter((s) => s.status !== "PENDING_GM"), [submissions]);
  const disabled = busy || working;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Propostas de cânone</Typography>
      {pending.length === 0 && <Typography color="text.secondary">Nenhuma proposta aguardando revisão.</Typography>}

      {pending.map((s) => (
        <Card key={s.id} variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography fontWeight="bold">
                {s.proposal.title} <Chip size="small" label={s.authorName} />
                <Chip size="small" sx={{ ml: 1 }} label={s.proposal.section} />
              </Typography>

              <Typography variant="body2" color="text.secondary">Pedido original: {s.rawText}</Typography>

              {s.review?.flags.map((flag, i) => (
                <Alert key={i} severity={flag.severity === "BLOCK" ? "error" : flag.severity === "WARN" ? "warning" : "info"}>
                  {flag.message}
                </Alert>
              ))}

              {s.rawImageUrl ? <img src={s.rawImageUrl} alt="" style={{ maxWidth: 320, borderRadius: 4 }} /> : null}

              <TextField
                label="Verbete (edite antes de publicar)"
                value={bodies[s.id] ?? s.proposal.body}
                onChange={(e) => setBodies((prev) => ({ ...prev, [s.id]: e.target.value }))}
                multiline
                minRows={6}
                fullWidth
              />

              <TextField
                label="Nota para o jogador"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                fullWidth
              />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  disabled={disabled}
                  onClick={() => void run(() => api.adminCanonApprove(adminToken, {
                    submissionId: s.id,
                    proposal: { ...s.proposal, body: bodies[s.id] ?? s.proposal.body },
                  }))}
                >
                  Aprovar e publicar
                </Button>
                <Button
                  color="error"
                  disabled={disabled}
                  onClick={() => void run(() => api.adminCanonReject(adminToken, { submissionId: s.id, note: notes[s.id] ?? "" }))}
                >
                  Recusar
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Typography variant="h6">Já julgadas</Typography>
      {judged.length === 0 && <Typography color="text.secondary">Nada julgado ainda.</Typography>}
      {judged.map((s) => (
        <Card key={s.id} variant="outlined">
          <CardContent>
            <Typography>
              {s.proposal.title} <Chip size="small" label={s.status === "APPROVED" ? "Publicado" : "Recusado"} />
            </Typography>
            {s.gmNote ? <Typography variant="body2" color="text.secondary">{s.gmNote}</Typography> : null}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Wire the tab**

Em `frontend/src/pages/AdminPage.tsx`:

1. Import: `import { AdminCanonTab } from "../components/admin/AdminCanonTab";`
2. Em `TABS`, logo depois da linha de `projetos`:

```ts
  { value: "canonico", label: "Canônico", disabled: false },
```

3. Na renderização condicional por `activeTab` (junto dos outros `activeTab === "..." && ...`, por volta da linha 230):

```tsx
      {activeTab === "canonico" && (
        <AdminCanonTab adminToken={adminToken} busy={busy} onError={setError} />
      )}
```

Use exatamente os nomes de variável de estado que a página já usa para `adminToken`, `busy` e o setter de erro — copie da linha que renderiza `AdminProjectsTab`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w frontend -- AdminCanonTab`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AdminCanonTab.tsx frontend/src/components/admin/AdminCanonTab.test.tsx frontend/src/pages/AdminPage.tsx
git commit -m "feat(canônico): aba de revisão de cânone no painel do mestre"
```

---

## Task 14: Desfazer a colisão de nome no Estúdio

**Files:**
- Modify: `frontend/src/pages/enciclopedia/EstudioTab.tsx:186`
- Modify: `frontend/src/pages/enciclopedia/EstudioTab.test.tsx:145,149`

O dropdown do Estúdio já tem uma opção chamada "Adicionar Novo Canônico". Ela gera uma imagem sem entidade e cria a entidade ao canonizar — é *image-first*, sem texto de lore. Com a página `/canonico` existindo, duas coisas diferentes passariam a ter o mesmo nome. A opção antiga descreve melhor o que faz como "Imagem sem entidade".

- [ ] **Step 1: Change the label**

Em `frontend/src/pages/enciclopedia/EstudioTab.tsx`, na linha 186, troque o texto visível `Adicionar Novo Canônico` por `Imagem sem entidade`. **Não** mude o valor da constante `NEW_CANON` nem o `value` do `MenuItem`: só o rótulo. Mudar o valor quebraria o estado salvo e a lógica de canonização.

- [ ] **Step 2: Update the assertions**

Em `frontend/src/pages/enciclopedia/EstudioTab.test.tsx`, linhas 145 e 149, troque as buscas por `/Adicionar Novo Canônico/` por `/Imagem sem entidade/`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -w frontend -- EstudioTab`
Expected: PASS.

- [ ] **Step 4: Fix the prose above the dropdown**

Na linha 183 do mesmo `EstudioTab.tsx` a frase termina em "— ou adicione um novo canônico ao acervo". Troque por "— ou gere uma imagem solta, sem entidade". A frase antiga prometia criar canônico, que agora é outra coisa e mora em `/canonico`.

- [ ] **Step 5: Update the comment in the backend**

Em `backend/src/routes/visualRoutes.ts`, o comentário de `canonizeAsset` (por volta da linha 118) cita "Adicionar Novo Canônico". Troque essa menção por "Imagem sem entidade" para o comentário continuar apontando para uma opção que existe.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/enciclopedia/EstudioTab.tsx frontend/src/pages/enciclopedia/EstudioTab.test.tsx backend/src/routes/visualRoutes.ts
git commit -m "refactor(estúdio): renomeia a opção colidente para 'Imagem sem entidade'"
```

---

## Task 15: Verificação final

**Files:** nenhum

- [ ] **Step 1: Build the whole monorepo**

Run: `npm run build`
Expected: os três pacotes compilam sem erro de tipo.

Se `backend` reclamar de algum objeto que implementa `ImageStore` sem `uploadCanonImage`, acrescente o método faltante ao fake — foi o aviso da Task 6.

- [ ] **Step 2: Run the whole test suite**

Run: `npm test`
Expected: PASS em `shared`, `backend` e `frontend`.

- [ ] **Step 3: Manual smoke check against the mock API**

Run: `npm run dev -w frontend`

Confirme, com `VITE_API_BASE_URL` vazio (cliente mock):
1. `/canonico` exige login e mostra o formulário.
2. "Gerar prévia" devolve título, seção e verbete editáveis.
3. "Enviar ao Mestre" faz a proposta aparecer em "Suas propostas" como "Aguardando o Mestre".
4. Em `/admin`, a aba "Canônico" mostra a proposta, e "Aprovar e publicar" a move para "Já julgadas".
5. O verbete aprovado aparece em `/valdren` na seção escolhida.

- [ ] **Step 4: Commit anything left over**

```bash
git status --short
```

Se houver mudanças não commitadas, commite-as com uma mensagem que descreva o que são. Se estiver limpo, a feature está pronta.

---

## Fora do plano

- Não mexemos em `shared/src/lore/characters.ts`: o elenco de `/personagens` é gerado por `backend/scripts/seed-house-characters.mjs` e compilado no bundle, não vem do DB. Um personagem criado por cânone vira verbete + `VisualEntity`, e aparece na Enciclopédia e no acervo visual — não na página `/personagens`. Mudar isso é outro projeto.
- Não geramos imagem por IA na submissão. O jogador anexa uma imagem ou não anexa nenhuma; gerar imagem canônica continua sendo trabalho do Estúdio.
- Não há edição de submissão depois de enviada. Se o Mestre recusar, o jogador propõe de novo.

---

## Divergências deliberadas em relação ao spec

Três decisões do spec foram ajustadas ao que o código realmente faz. Elas estão aqui para quem for comparar os dois documentos não achar que é esquecimento.

**1. `clampCanonText` não existe — usamos `clampText`.** O spec fala em criar um `clampCanonText` em `shared/`. Já existe `clampText(v, max)` exportado de `shared/src/projects.ts:136`, com exatamente esse comportamento. Criar um segundo seria duplicação.

**2. O código de erro é `INVALID_BODY`, não `BAD_REQUEST`.** O spec usa `BAD_REQUEST` para texto vazio e seção inválida. Esse código não existe na allowlist `API_ERROR_CODES` de `frontend/src/api/httpClient.ts:52-72`; usá-lo faria o frontend cair no fallback genérico e perder a mensagem. `INVALID_BODY` é o que o resto do backend usa para a mesma situação.

**3. `CanonSubmitForm` não é reusado na tela do Mestre.** O spec diz "formulário, usado nas duas telas". As duas telas fazem coisas diferentes: o jogador escreve texto livre e pede prévia à IA; o Mestre edita um verbete já pronto e decide. Espremer as duas no mesmo componente exigiria um punhado de flags de modo. `AdminCanonTab` tem os próprios campos de edição.

Nenhuma delas muda o comportamento que o spec descreve — só o caminho para chegar lá.
