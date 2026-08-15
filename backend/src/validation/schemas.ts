import { ATTRIBUTE_KEYS, EMBLEM_ICONS, WIKI_SECTION_IDS, GM_SECTION_IDS, PROJECT_COST_TYPES, isProjectCategory, clampText, CARD_TITLE_MAX, CARD_DESCRIPTION_MAX, validateAttributes, validateAttributeRanges, type AttributeKey, type Attributes, type Emblem, type ProjectCost, type CompletionEffects, type AttributeChange, type CustomCardDraft } from "@ravenloft/content";
import { HttpError } from "../types/domain";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "INVALID_BODY", "Corpo inválido.");
  return body as Record<string, unknown>;
}
function str(obj: Record<string, unknown>, key: string, max: number, required = true): string {
  const v = obj[key];
  if (v === undefined || v === "") { if (required) throw new HttpError(400, "INVALID_BODY", `Campo obrigatório: ${key}`); return ""; }
  if (typeof v !== "string") throw new HttpError(400, "INVALID_BODY", `Campo inválido: ${key}`);
  if (v.length > max) throw new HttpError(400, "INVALID_BODY", `Campo muito longo: ${key}`);
  return v;
}
function parseAttributes(raw: unknown): Attributes {
  const o = asObject(raw); const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) { const n = o[k]; if (typeof n !== "number") throw new HttpError(400, "INVALID_BODY", `Atributo inválido: ${k}`); out[k as AttributeKey] = n; }
  const res = validateAttributes(out); if (!res.valid) throw new HttpError(400, "INVALID_ATTRIBUTES", res.error ?? "Atributos inválidos.");
  return out;
}
function parseAdminAttributes(raw: unknown): Attributes {
  const o = asObject(raw); const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) { const n = o[k]; if (typeof n !== "number") throw new HttpError(400, "INVALID_BODY", `Atributo inválido: ${k}`); out[k as AttributeKey] = n; }
  const res = validateAttributeRanges(out); if (!res.valid) throw new HttpError(400, "INVALID_ATTRIBUTES", res.error ?? "Atributos inválidos.");
  return out;
}
function parseEmblem(raw: unknown): Emblem {
  const o = asObject(raw); const icon = str(o, "icon", 20);
  if (!(EMBLEM_ICONS as readonly string[]).includes(icon)) throw new HttpError(400, "INVALID_BODY", "Ícone desconhecido.");
  return { icon: icon as Emblem["icon"], color1: str(o, "color1", 20), color2: str(o, "color2", 20) };
}

const MAX_IMAGE_CHARS = 2_800_000;
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

export function parseCreateHouseBody(body: unknown) {
  const o = asObject(body);
  return {
    displayName: str(o, "displayName", 40), name: str(o, "name", 60), motto: str(o, "motto", 120),
    emblem: parseEmblem(o.emblem), leaderName: str(o, "leaderName", 60), heirName: str(o, "heirName", 60),
    castleName: str(o, "castleName", 60), townsText: str(o, "townsText", 2000), historyText: str(o, "historyText", 2000),
    specialty: str(o, "specialty", 500), weakness: str(o, "weakness", 500), attributes: parseAttributes(o.attributes),
    images: parseImagesField(o),
  };
}
export function parseLoginBody(body: unknown) { return { playerCode: str(asObject(body), "playerCode", 40) }; }
export function parseAdminLoginBody(body: unknown) { return { adminCode: str(asObject(body), "adminCode", 80) }; }

export function parseSubmitOrderBody(body: unknown): { orderText: string } {
  const o = asObject(body); const orderText = str(o, "orderText", 4000);
  return { orderText };
}

export function parseComposeTurnBody(body: unknown) {
  const o = asObject(body);
  const publicEvent = str(o, "publicEvent", 4000, false);
  const privateInfo = (o.privateInfo && typeof o.privateInfo === "object" && !Array.isArray(o.privateInfo)) ? o.privateInfo as Record<string, string> : {};
  return { publicEvent, privateInfo };
}

export function parseTurnDraftBody(body: unknown) {
  const o = asObject(body);
  const publicEvent = str(o, "publicEvent", 8000, false);
  const privateInfo = parseStringRecord(o.privateInfo, "privateInfo");
  const note = str(o, "note", 4000, false);
  const eventImageUrl = typeof o.eventImageUrl === "string" ? o.eventImageUrl.slice(0, 2000) : "";
  return { publicEvent, privateInfo, note, eventImageUrl };
}

export function parseSetTurnImageUrlBody(body: unknown) {
  const o = asObject(body);
  const kind = o.kind === "result" ? "result" : "event";
  const url = str(o, "url", 2000, false);
  if (!url) throw new HttpError(400, "INVALID", "url é obrigatória.");
  return { kind: kind as "event" | "result", url };
}

export function parseApplyResolutionBody(body: unknown) {
  const o = asObject(body);
  return {
    publicResult: str(o, "publicResult", 8000, false),
    houseResults: parseStringRecord(o.houseResults, "houseResults"),
    attributeDeltas: parseAttributeDeltas(o.attributeDeltas),
    discoveries: parseStringArray(o.discoveries, "discoveries"),
  };
}

function parseStringRecord(raw: unknown, key: string): Record<string, string> {
  if (raw === undefined) return {};
  const o = asObject(raw);
  const out: Record<string, string> = {};
  for (const [entryKey, value] of Object.entries(o)) {
    if (typeof value !== "string") throw new HttpError(400, "INVALID_BODY", `Campo inválido: ${key}`);
    out[entryKey] = value;
  }
  return out;
}

function parseAttributeDeltas(raw: unknown): Record<string, Partial<Attributes>> {
  if (raw === undefined) return {};
  const o = asObject(raw);
  const out: Record<string, Partial<Attributes>> = {};
  for (const [houseId, rawDelta] of Object.entries(o)) {
    const deltaObj = asObject(rawDelta);
    const delta: Partial<Attributes> = {};
    for (const [key, value] of Object.entries(deltaObj)) {
      if (!(ATTRIBUTE_KEYS as readonly string[]).includes(key) || typeof value !== "number" || !Number.isFinite(value)) {
        throw new HttpError(400, "INVALID_BODY", "Variação de atributo inválida.");
      }
      delta[key as AttributeKey] = value;
    }
    out[houseId] = delta;
  }
  return out;
}

function parseStringArray(raw: unknown, key: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new HttpError(400, "INVALID_BODY", `Campo inválido: ${key}`);
  }
  return raw;
}

function parseHouseFields(o: Record<string, unknown>) {
  return {
    name: str(o, "name", 60), motto: str(o, "motto", 120),
    emblem: parseEmblem(o.emblem), leaderName: str(o, "leaderName", 60), heirName: str(o, "heirName", 60),
    castleName: str(o, "castleName", 60), townsText: str(o, "townsText", 2000), historyText: str(o, "historyText", 2000),
    specialty: str(o, "specialty", 500), weakness: str(o, "weakness", 500),
  };
}

export function parseAdminCreateHouseBody(body: unknown) {
  const o = asObject(body);
  return {
    displayName: str(o, "displayName", 40),
    ...parseHouseFields(o),
    attributes: parseAdminAttributes(o.attributes),
    images: parseImagesField(o),
  };
}

export function parseAdminUpdateHouseBody(body: unknown) {
  const o = asObject(body);
  return {
    houseId: str(o, "houseId", 80),
    ...parseHouseFields(o),
    attributes: parseAdminAttributes(o.attributes),
  };
}

export function parseAdminDeleteHouseBody(body: unknown): { houseId: string } {
  return { houseId: str(asObject(body), "houseId", 80) };
}

export function parseWorldBibleBody(body: unknown): { lore: string; visualDirectives: string } {
  const o = asObject(body);
  return {
    lore: str(o, "lore", 20000, false),
    visualDirectives: str(o, "visualDirectives", 20000, false),
  };
}

export function parseNpcStateBody(body: unknown): {
  houseKey: string;
  characterId: string;
  mood: string;
  favors: string;
  note: string;
  perceptions: Record<string, string>;
} {
  const o = asObject(body);
  const perceptions: Record<string, string> = {};
  const raw = o.perceptions;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      // Só o que o Mestre de fato escreveu: uma percepção vazia não vira um
      // par de chave-valor morto no registro.
      if (typeof v === "string" && v.trim()) perceptions[k] = v.slice(0, 800);
    }
  }
  return {
    houseKey: str(o, "houseKey", 60),
    characterId: str(o, "characterId", 120),
    mood: str(o, "mood", 800, false),
    favors: str(o, "favors", 2000, false),
    note: str(o, "note", 2000, false),
    perceptions,
  };
}

export function parseNpcDynamicBody(body: unknown): {
  affiliation: string;
  id: string;
  mood: string;
  location: string;
  objective: string;
  concerns: string;
  loyalty: string;
  relations: Record<string, { trust: number; respect: number; fear: number; resentment: number; obligation: number; summary: string }>;
  memory: { turnNumber: number; description: string; impact: string }[];
  updatedAt: string;
} {
  const o = asObject(body);
  const clampDim = (v: unknown) => Math.max(0, Math.min(100, Math.round(typeof v === "number" ? v : 50)));
  const relations: Record<string, { trust: number; respect: number; fear: number; resentment: number; obligation: number; summary: string }> = {};
  const rawRel = o.relations;
  if (rawRel && typeof rawRel === "object") {
    for (const [k, v] of Object.entries(rawRel as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      relations[k] = {
        trust: clampDim(r.trust), respect: clampDim(r.respect), fear: clampDim(r.fear),
        resentment: clampDim(r.resentment), obligation: clampDim(r.obligation),
        summary: typeof r.summary === "string" ? r.summary.slice(0, 800) : "",
      };
    }
  }
  const memory: { turnNumber: number; description: string; impact: string }[] = [];
  if (Array.isArray(o.memory)) {
    for (const m of o.memory as unknown[]) {
      const e = (m ?? {}) as Record<string, unknown>;
      if (typeof e.description === "string" && e.description.trim()) {
        memory.push({
          turnNumber: typeof e.turnNumber === "number" ? e.turnNumber : 0,
          description: e.description.slice(0, 1000),
          impact: typeof e.impact === "string" ? e.impact.slice(0, 400) : "",
        });
      }
    }
  }
  return {
    affiliation: str(o, "affiliation", 60),
    id: str(o, "id", 120),
    mood: str(o, "mood", 800, false),
    location: str(o, "location", 200, false),
    objective: str(o, "objective", 2000, false),
    concerns: str(o, "concerns", 2000, false),
    loyalty: str(o, "loyalty", 800, false),
    relations,
    memory,
    updatedAt: "",
  };
}

function parseImageKind(o: Record<string, unknown>): "event" | "result" {
  const kind = str(o, "kind", 10);
  if (kind !== "event" && kind !== "result") throw new HttpError(400, "INVALID_BODY", "kind deve ser 'event' ou 'result'.");
  return kind;
}

export function parseGenerateTurnImageBody(body: unknown): { kind: "event" | "result"; sceneDescription: string } {
  const o = asObject(body);
  return { kind: parseImageKind(o), sceneDescription: str(o, "sceneDescription", 2000, false) };
}

export function parseDeleteTurnImageBody(body: unknown): { kind: "event" | "result" } {
  return { kind: parseImageKind(asObject(body)) };
}

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

export function parseUploadTurnImageBody(headers: Record<string, string | undefined>, rawBody: Buffer | undefined): { kind: "event" | "result"; body: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" } {
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

  return { kind, body: imagePart.body, contentType: imageContentType as "image/png" | "image/jpeg" | "image/webp" };
}

function parseWikiSection(o: Record<string, unknown>): string {
  const section = str(o, "section", 40);
  if (!WIKI_SECTION_IDS.includes(section)) throw new HttpError(400, "INVALID_BODY", "Seção desconhecida.");
  return section;
}

function parseWikiOrder(o: Record<string, unknown>): number {
  const v = o.order;
  if (v === undefined) return 0;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new HttpError(400, "INVALID_BODY", "Campo inválido: order");
  return Math.trunc(v);
}

function parseWikiImageUrl(o: Record<string, unknown>): string | undefined {
  const imageUrl = str(o, "imageUrl", 500, false).trim();
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith("/") && !imageUrl.startsWith("https://")) {
    throw new HttpError(400, "INVALID_BODY", "imageUrl deve começar com / ou https://.");
  }
  return imageUrl;
}

function parseWikiImageUrls(o: Record<string, unknown>, imageUrl?: string): string[] | undefined {
  const raw = o.imageUrls;
  if (raw === undefined) return imageUrl ? [imageUrl] : undefined;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new HttpError(400, "INVALID_BODY", "imageUrls deve ser uma lista de strings.");
  }
  if (raw.length > 6) throw new HttpError(400, "INVALID_BODY", "Máximo de 6 imagens por entrada.");
  const urls = raw.map((url) => url.trim()).filter(Boolean);
  for (const url of urls) {
    if (url.length > 500 || (!url.startsWith("/") && !url.startsWith("https://"))) {
      throw new HttpError(400, "INVALID_BODY", "imageUrls deve conter caminhos / ou URLs https://.");
    }
  }
  return urls.length ? urls : undefined;
}

export function parseWikiCreateBody(body: unknown): { section: string; title: string; body: string; order: number; imageUrl?: string; imageUrls?: string[] } {
  const o = asObject(body);
  const explicitImageUrl = parseWikiImageUrl(o);
  const imageUrls = parseWikiImageUrls(o, explicitImageUrl);
  const imageUrl = explicitImageUrl ?? imageUrls?.[0];
  return {
    section: parseWikiSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageUrls ? { imageUrls } : {}),
  };
}

export function parseWikiUpdateBody(body: unknown): { entryId: string; section: string; title: string; body: string; order: number; imageUrl?: string; imageUrls?: string[] } {
  const o = asObject(body);
  const explicitImageUrl = parseWikiImageUrl(o);
  const imageUrls = parseWikiImageUrls(o, explicitImageUrl);
  const imageUrl = explicitImageUrl ?? imageUrls?.[0];
  return {
    entryId: str(o, "entryId", 40),
    section: parseWikiSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageUrls ? { imageUrls } : {}),
  };
}

export function parseWikiDeleteBody(body: unknown): { entryId: string } {
  return { entryId: str(asObject(body), "entryId", 40) };
}

function parseGmSection(o: Record<string, unknown>): string {
  const section = str(o, "section", 40);
  if (!GM_SECTION_IDS.includes(section)) throw new HttpError(400, "INVALID_BODY", "Seção desconhecida.");
  return section;
}

export function parseGmCreateBody(body: unknown): { section: string; title: string; body: string; order: number } {
  const o = asObject(body);
  return {
    section: parseGmSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
  };
}

export function parseGmUpdateBody(body: unknown): { entryId: string; section: string; title: string; body: string; order: number } {
  const o = asObject(body);
  return {
    entryId: str(o, "entryId", 40),
    section: parseGmSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
  };
}

export function parseGmDeleteBody(body: unknown): { entryId: string } {
  return { entryId: str(asObject(body), "entryId", 40) };
}

export function parseStartTemplateBody(body: unknown): { templateId: string } {
  const o = asObject(body);
  return { templateId: str(o, "templateId", 80) };
}

export function parseEnhanceCardBody(body: unknown): { title: string; body: string; targetHouseId: string | null } {
  const o = asObject(body);
  return {
    title: str(o, "title", 160),
    body: str(o, "body", 3000),
    targetHouseId: str(o, "targetHouseId", 80, false) || null,
  };
}

const DRAFT_ATTR_KEYS = ["riqueza", "recursos", "soldados", "controle", "stability"] as const;

function parseDraftCosts(v: unknown): ProjectCost[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new HttpError(400, "INVALID_BODY", "costs inválido.");
  if (v.length > 8) throw new HttpError(400, "INVALID_BODY", "costs longo demais.");
  return v.map((c) => {
    const o = asObject(c);
    if (!(PROJECT_COST_TYPES as readonly string[]).includes(o.type as string)) throw new HttpError(400, "INVALID_BODY", "Tipo de custo inválido.");
    if (typeof o.amount !== "number" || o.amount < 0 || o.amount > 10) throw new HttpError(400, "INVALID_BODY", "Valor de custo inválido.");
    return { type: o.type as ProjectCost["type"], amount: Math.round(o.amount), timing: "ON_START" as const };
  });
}

function strList(v: unknown, max: number): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new HttpError(400, "INVALID_BODY", "Lista inválida.");
  return v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, max)).slice(0, 20);
}

function parseDraftEffects(v: unknown): CompletionEffects {
  const o = (v ?? {}) as Record<string, unknown>;
  const attributeChanges: AttributeChange[] = Array.isArray(o.attributeChanges)
    ? o.attributeChanges.map((c) => {
        const x = asObject(c);
        if (!(DRAFT_ATTR_KEYS as readonly string[]).includes(x.attribute as string)) throw new HttpError(400, "INVALID_BODY", "Atributo de efeito inválido.");
        if (typeof x.amount !== "number") throw new HttpError(400, "INVALID_BODY", "Valor de efeito inválido.");
        const amount = Math.max(-5, Math.min(5, Math.round(x.amount)));
        return { attribute: x.attribute as AttributeChange["attribute"], amount, permanent: x.permanent === true };
      })
    : [];
  const favors = Array.isArray(o.favors)
    ? o.favors.map((f) => {
        const x = asObject(f);
        return { targetHouseId: String(x.targetHouseId ?? ""), amount: typeof x.amount === "number" ? Math.round(x.amount) : 1, requiresAcceptance: x.requiresAcceptance !== false };
      })
    : [];
  return { attributeChanges, favors, assets: strList(o.assets, 120), qualitativeEffects: strList(o.qualitativeEffects, 300), unlocks: strList(o.unlocks, 120) };
}

export function parseCustomCardDraftBody(body: unknown): CustomCardDraft {
  const o = asObject(body);
  if (!isProjectCategory(o.category as string)) throw new HttpError(400, "INVALID_BODY", "Categoria inválida.");
  if (typeof o.durationTurns !== "number" || o.durationTurns < 1) throw new HttpError(400, "INVALID_BODY", "Duração inválida.");
  const status = o.aiBalanceStatus;
  const okStatus = status === "BALANCED" || status === "STRONG" || status === "WEAK" || status === "NEEDS_GM_REVIEW" || status === null || status === undefined;
  if (!okStatus) throw new HttpError(400, "INVALID_BODY", "aiBalanceStatus inválido.");
  const description = clampText(str(o, "description", 3000), CARD_DESCRIPTION_MAX);
  return {
    title: clampText(str(o, "title", 2000), CARD_TITLE_MAX),
    description,
    publicDescription: str(o, "publicDescription", 3000, false) ? clampText(str(o, "publicDescription", 3000, false), CARD_DESCRIPTION_MAX) : description,
    category: o.category as CustomCardDraft["category"],
    durationTurns: Math.max(1, Math.min(12, Math.round(o.durationTurns))),
    costs: parseDraftCosts(o.costs),
    requirements: strList(o.requirements, 300),
    risks: strList(o.risks, 300),
    completionEffects: parseDraftEffects(o.completionEffects),
    targetHouseId: (typeof o.targetHouseId === "string" && o.targetHouseId) ? str(o, "targetHouseId", 80) : null,
    playerOriginalRequest: str(o, "playerOriginalRequest", 3000, false),
    playerEditedRules: o.playerEditedRules === true,
    aiBalanceStatus: (status as CustomCardDraft["aiBalanceStatus"]) ?? null,
    aiBalanceExplanation: str(o, "aiBalanceExplanation", 1000, false) || null,
  };
}

export function parseProjectIdBody(body: unknown): { projectId: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80) };
}

export function parseRevisionBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000) };
}

export function parseFavorRespondBody(body: unknown): { favorId: string; accept: boolean } {
  const o = asObject(body);
  const favorId = str(o, "favorId", 120);
  if (typeof o.accept !== "boolean") throw new HttpError(400, "INVALID_BODY", "accept deve ser booleano.");
  return { favorId, accept: o.accept };
}

export function parseApproveProjectBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000, false) };
}

export function parseRejectProjectBody(body: unknown): { projectId: string; note: string } {
  const o = asObject(body);
  return { projectId: str(o, "projectId", 80), note: str(o, "note", 1000) };
}
