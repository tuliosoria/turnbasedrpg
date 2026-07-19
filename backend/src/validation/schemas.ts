import { ATTRIBUTE_KEYS, EMBLEM_ICONS, validateAttributes, validateAttributeRanges, type AttributeKey, type Attributes, type Emblem, type CardResponse } from "@ravenloft/content";
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

export function parseSubmitOrderBody(body: unknown): { orderText: string; cardResponses: CardResponse[] } {
  const o = asObject(body); const orderText = str(o, "orderText", 4000);
  const raw = o.cardResponses; const arr = Array.isArray(raw) ? raw : [];
  const cardResponses: CardResponse[] = arr.map((r) => {
    const c = asObject(r); const cr: CardResponse = { cardId: str(c, "cardId", 80), text: str(c, "text", 4000, false) };
    if (c.declaredSpend) { const s = asObject(c.declaredSpend); cr.declaredSpend = { attribute: str(s, "attribute", 20) as AttributeKey, amount: Number(s.amount) }; }
    if (c.declaredChoice) { const ch = asObject(c.declaredChoice); cr.declaredChoice = { attribute: str(ch, "attribute", 20) as AttributeKey }; }
    return cr;
  });
  return { orderText, cardResponses };
}

export function parseComposeTurnBody(body: unknown) {
  const o = asObject(body);
  const publicEvent = str(o, "publicEvent", 4000, false);
  const privateInfo = (o.privateInfo && typeof o.privateInfo === "object" && !Array.isArray(o.privateInfo)) ? o.privateInfo as Record<string, string> : {};
  const cardsRaw = Array.isArray(o.cards) ? o.cards : [];
  const cards = cardsRaw.map((c) => {
    const co = asObject(c);
    const card: Record<string, unknown> = { id: str(co, "id", 80), title: str(co, "title", 120),
      constraintText: str(co, "constraintText", 2000, false), narrativeQuestion: str(co, "narrativeQuestion", 2000, false),
      consequenceText: str(co, "consequenceText", 2000, false) };
    if (co.spend) { const s = asObject(co.spend); card.spend = { attribute: str(s, "attribute", 20), max: Number(s.max) }; }
    if (co.choice) { const ch = asObject(co.choice); card.choice = { attributes: (ch.attributes as string[]) ?? [], amount: Number(ch.amount) }; }
    return card;
  });
  return { publicEvent, privateInfo, cards };
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
