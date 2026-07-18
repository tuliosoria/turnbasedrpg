import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("apiClient selection", () => {
  it("uses the mock client when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const { apiClient } = await import("./index");
    expect(apiClient.constructor.name).toBe("MockApiClient");
  });

  it("uses the HTTP client when VITE_API_BASE_URL is set", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiClient } = await import("./index");
    expect(apiClient.constructor.name).toBe("HttpApiClient");
  });
});
