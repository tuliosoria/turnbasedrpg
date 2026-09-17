import { HttpApiClient } from "./httpClient";
import type { ApiClient } from "./client";

export async function criarApiClient(): Promise<ApiClient> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (baseUrl && baseUrl.length > 0) return new HttpApiClient(baseUrl);
  const { MockApiClient } = await import("./mockClient");
  return new MockApiClient();
}
