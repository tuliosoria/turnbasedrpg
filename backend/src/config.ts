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
    openAiImageModel: env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    openAiImageSize: env.OPENAI_IMAGE_SIZE ?? "1536x1024",
    openAiImageQuality: env.OPENAI_IMAGE_QUALITY ?? "medium",
    openAiImageInputFidelity: env.OPENAI_IMAGE_INPUT_FIDELITY ?? "high",
    imagesBucket: env.IMAGES_BUCKET ?? "",
    visualWorkerFunctionName: env.VISUAL_WORKER_FUNCTION_NAME ?? "",
  };
}
