import { MockApiClient } from "./mockClient";
import { HttpApiClient } from "./httpClient";
import type { ApiClient } from "./client";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export const apiClient: ApiClient =
  baseUrl && baseUrl.length > 0 ? new HttpApiClient(baseUrl) : new MockApiClient();
