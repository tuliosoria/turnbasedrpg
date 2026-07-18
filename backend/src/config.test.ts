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
