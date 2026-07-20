import { ATTRIBUTE_KEYS, EMBLEM_ICONS, WIKI_SECTION_IDS, GM_SECTION_IDS, validateAttributes, validateAttributeRanges, type AttributeKey, type Attributes, type Emblem } from "@ravenloft/content";
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

export function parseCreateHouseBody(body: unknown) {
  const o = asObject(body);
  return {
    displayName: str(o, "displayName", 40), name: str(o, "name", 60), motto: str(o, "motto", 120),
    emblem: parseEmblem(o.emblem), leaderName: str(o, "leaderName", 60), heirName: str(o, "heirName", 60),
    castleName: str(o, "castleName", 60), townsText: str(o, "townsText", 2000), historyText: str(o, "historyText", 2000),
    specialty: str(o, "specialty", 500), weakness: str(o, "weakness", 500), attributes: parseAttributes(o.attributes),
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

export function parseWikiCreateBody(body: unknown): { section: string; title: string; body: string; order: number } {
  const o = asObject(body);
  return {
    section: parseWikiSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
  };
}

export function parseWikiUpdateBody(body: unknown): { entryId: string; section: string; title: string; body: string; order: number } {
  const o = asObject(body);
  return {
    entryId: str(o, "entryId", 40),
    section: parseWikiSection(o),
    title: str(o, "title", 200),
    body: str(o, "body", 20000, false),
    order: parseWikiOrder(o),
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
