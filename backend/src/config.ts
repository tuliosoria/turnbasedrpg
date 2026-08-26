import type { Config } from "./types/domain";

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  return {
    tableName: required(env, "TABLE_NAME"),
    campaignId: required(env, "CAMPAIGN_ID"),
    adminCodeHash: required(env, "ADMIN_CODE_HASH"),
    tokenSigningSecret: required(env, "TOKEN_SIGNING_SECRET"),
    allowedOrigin: required(env, "ALLOWED_ORIGIN"),
    tokenTtlSeconds: Number(env.TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7),
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    // A diplomacia é onde a inteligência do modelo aparece: uma carta precisa
    // comparar duas despensas e propor uma troca que feche. O resto do app
    // (rascunho de turno, arbitragem de carta) segue no modelo padrão até
    // sabermos o custo do modelo maior em produção.
    openAiDiplomacyModel: env.OPENAI_DIPLOMACY_MODEL || env.OPENAI_MODEL || "gpt-4o-mini",
    openAiImageModel: env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    openAiImageSize: env.OPENAI_IMAGE_SIZE ?? "1536x1024",
    openAiImageQuality: env.OPENAI_IMAGE_QUALITY ?? "medium",
    // "none" disables the parameter. An empty string cannot be passed through
    // sam deploy --parameter-overrides, so a sentinel is used instead.
    openAiImageInputFidelity: normaliseFidelity(env.OPENAI_IMAGE_INPUT_FIDELITY),
    openAiSyncImageModel: env.OPENAI_SYNC_IMAGE_MODEL ?? "gpt-image-1",
    openAiSyncImageSize: env.OPENAI_SYNC_IMAGE_SIZE ?? "1024x1024",
    // Measured against the live API: quality is the cost driver, not size.
    // 1536x1024 medium ~18.6s, 1024x1024 medium ~19.5s, 1024x1024 low ~13.6s.
    // The route must also thumbnail and upload to S3 inside API Gateway's 30s
    // cap, and at medium it failed roughly half the time at ~28s.
    openAiSyncImageQuality: env.OPENAI_SYNC_IMAGE_QUALITY ?? "low",
    imagesBucket: env.IMAGES_BUCKET ?? "",
    visualWorkerFunctionName: env.VISUAL_WORKER_FUNCTION_NAME ?? "",
    draftIngestToken: env.DRAFT_INGEST_TOKEN ?? "",
  };
}

function normaliseFidelity(raw: string | undefined): string {
  const v = (raw ?? "high").trim().toLowerCase();
  return v === "none" || v === "" ? "" : v;
}
