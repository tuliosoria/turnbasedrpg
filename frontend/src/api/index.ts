import { HttpApiClient } from "./httpClient";
import type { ApiClient } from "./client";

export async function criarApiClient(): Promise<ApiClient> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
  if (baseUrl.length > 0) return new HttpApiClient(baseUrl);
  // Produção sem URL não pode cair no mock: o bundle sairia jogável e mentiroso.
  if (import.meta.env.PROD) {
    throw new Error(
      "VITE_API_BASE_URL está vazio num build de produção. Copie frontend/.env.production antes de buildar — sem isso o bundle usaria o MockApiClient.",
    );
  }
  const { MockApiClient } = await import("./mockClient");
  return new MockApiClient();
}
