import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("criarApiClient", () => {
  it("uses the mock client when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const { criarApiClient } = await import("./index");
    const client = await criarApiClient();
    expect(client.constructor.name).toBe("MockApiClient");
  });

  it("uses the HTTP client when VITE_API_BASE_URL is set", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { criarApiClient } = await import("./index");
    const client = await criarApiClient();
    expect(client.constructor.name).toBe("HttpApiClient");
  });

  it("does not statically export a constructed apiClient", async () => {
    const api = await import("./index");
    expect("apiClient" in api).toBe(false);
  });
});
