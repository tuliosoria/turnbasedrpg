import OpenAI from "openai";
import { ATTRIBUTE_KEYS, type AttributeKey, type TurnResult } from "@ravenloft/content";
import { HttpError } from "../types/domain";

export type ChatFn = (system: string, user: string, jsonMode: boolean) => Promise<string>;

const RETRYABLE_CODES = new Set(["AI_PARSE", "AI_ERROR"]);

export async function generateJson<T>(
  chat: ChatFn,
  system: string,
  user: string,
  parse: (raw: string) => T,
  attempts = 2,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await chat(system, user, true);
      return parse(raw);
    } catch (e) {
      lastError = e;
      if (e instanceof HttpError && RETRYABLE_CODES.has(e.code)) continue;
      throw e;
    }
  }
  throw lastError ?? new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
}

export function makeChatFn(apiKey: string, model: string): ChatFn {
  const client = new OpenAI({ apiKey, timeout: 12000, maxRetries: 0 });
  return async (system, user, jsonMode) => {
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      return res.choices[0]?.message?.content ?? "";
    } catch (e) {
      throw mapOpenAiError(e);
    }
  };
}

export function mapOpenAiError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : undefined;
  if (status === 429) {
    return new HttpError(503, "AI_QUOTA", "IA indisponível: a cota da OpenAI foi excedida. Verifique o faturamento da conta OpenAI.");
  }
  if (status === 401 || status === 403) {
    return new HttpError(502, "AI_AUTH", "IA indisponível: a chave da OpenAI é inválida ou não tem permissão.");
  }
  const detail = status ? ` (HTTP ${status})` : "";
  return new HttpError(502, "AI_ERROR", `Falha ao contatar a IA${detail}. Tente novamente.`);
}

export function parseResolution(raw: string): TurnResult {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
  }
  const o = parseAiObject(obj);
  if (typeof o.publicResult !== "string") throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
  return {
    publicResult: o.publicResult,
    houseResults: parseAiStringRecord(o.houseResults),
    attributeDeltas: parseAiAttributeDeltas(o.attributeDeltas),
    discoveries: parseAiStringArray(o.discoveries),
  };
}

export function parsePrivateInfo(raw: string): Record<string, string> {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
  }
  return parseAiStringRecord(obj, true);
}

export function parsePublicEvent(raw: string): string {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "AI_PARSE", "A IA retornou um formato inválido.");
  }
  const o = parseAiObject(obj);
  if (typeof o.publicEvent !== "string" || !o.publicEvent.trim()) {
    throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
  }
  return o.publicEvent.trim();
}

function parseAiObject(obj: unknown): Record<string, unknown> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
  }
  return obj as Record<string, unknown>;
}

function parseAiStringRecord(raw: unknown, required = false): Record<string, string> {
  if (raw === undefined && !required) return {};
  const obj = parseAiObject(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string") throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
    out[k] = v;
  }
  return out;
}

function parseAiAttributeDeltas(raw: unknown): TurnResult["attributeDeltas"] {
  if (raw === undefined) return {};
  const obj = parseAiObject(raw);
  const out: TurnResult["attributeDeltas"] = {};
  for (const [houseId, rawDelta] of Object.entries(obj)) {
    const deltaObj = parseAiObject(rawDelta);
    const delta: TurnResult["attributeDeltas"][string] = {};
    for (const [key, value] of Object.entries(deltaObj)) {
      if (!(ATTRIBUTE_KEYS as readonly string[]).includes(key) || typeof value !== "number" || !Number.isFinite(value)) {
        throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
      }
      delta[key as AttributeKey] = value;
    }
    out[houseId] = delta;
  }
  return out;
}

function parseAiStringArray(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new HttpError(502, "AI_PARSE", "Resposta da IA incompleta.");
  }
  return raw;
}
