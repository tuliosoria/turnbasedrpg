import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const env = {
  TABLE_NAME: "ravenloft-game",
  CAMPAIGN_ID: "winter-dead",
  ADMIN_CODE_HASH: "abc",
  TOKEN_SIGNING_SECRET: "secret",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

describe("loadConfig", () => {
  it("reads config from the environment", () => {
    const config = loadConfig(env);
    expect(config.tableName).toBe("ravenloft-game");
    expect(config.campaignId).toBe("winter-dead");
    expect(config.allowedOrigin).toBe("http://localhost:5173");
    expect(config.tokenTtlSeconds).toBeGreaterThan(0);
    expect(config.openAiApiKey).toBe("");
    expect(config.openAiModel).toBe("gpt-4o-mini");
  });

  it("reads optional OpenAI config when present", () => {
    const config = loadConfig({ ...env, OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4.1-mini" });
    expect(config.openAiApiKey).toBe("sk-test");
    expect(config.openAiModel).toBe("gpt-4.1-mini");
  });

  it("throws when a required variable is missing", () => {
    expect(() => loadConfig({ ...env, TABLE_NAME: undefined })).toThrow(/TABLE_NAME/);
  });
});

describe("openAiImageInputFidelity", () => {
  // sam deploy --parameter-overrides cannot pass an empty string, so "none" is
  // the sentinel that means "omit the parameter entirely".
  it("treats 'none' as disabled", () => {
    expect(loadConfig({ ...env, OPENAI_IMAGE_INPUT_FIDELITY: "none" } as never).openAiImageInputFidelity).toBe("");
  });

  it("treats an empty value as disabled", () => {
    expect(loadConfig({ ...env, OPENAI_IMAGE_INPUT_FIDELITY: "" } as never).openAiImageInputFidelity).toBe("");
  });

  it("defaults to high when unset, preserving prior behaviour", () => {
    expect(loadConfig({ ...env } as never).openAiImageInputFidelity).toBe("high");
  });

  it("passes a real value through, lowercased", () => {
    expect(loadConfig({ ...env, OPENAI_IMAGE_INPUT_FIDELITY: "HIGH" } as never).openAiImageInputFidelity).toBe("high");
  });
});

describe("synchronous image settings", () => {
  // House emblems and turn images are generated inside the HTTP request, which
  // API Gateway caps at 30s. Pointing them at the worker's high-quality profile
  // made every one of them fail with a 28s timeout mapped to
  // "Falha ao contatar a IA" — so these must stay independently configurable.
  it("defaults to the fast profile, independent of the worker's model", () => {
    const c = loadConfig({ ...env, OPENAI_IMAGE_MODEL: "gpt-image-2", OPENAI_IMAGE_QUALITY: "high" } as never);
    expect(c.openAiImageModel).toBe("gpt-image-2");
    expect(c.openAiImageQuality).toBe("high");
    expect(c.openAiSyncImageModel).toBe("gpt-image-1");
    expect(c.openAiSyncImageQuality).toBe("low");
  });

  it("can be overridden on its own", () => {
    const c = loadConfig({ ...env, OPENAI_SYNC_IMAGE_QUALITY: "low" } as never);
    expect(c.openAiSyncImageQuality).toBe("low");
  });
});
