import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { useGenerationPolling } from "./useGenerationPolling";
import type { ReactNode } from "react";

function wrapper(client: MockApiClient) {
  return ({ children }: { children: ReactNode }) => <ApiProvider client={client}>{children}</ApiProvider>;
}

describe("useGenerationPolling", () => {
  it("polls until the generation completes", async () => {
    const client = new MockApiClient();
    const { generationId } = await client.createVisualGeneration({ requestText: "x", entityId: "e1" });
    const { result } = renderHook(() => useGenerationPolling(generationId, 10), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.generation?.status).toBe("COMPLETED"), { timeout: 2000 });
    expect(result.current.generation?.outputAssetIds.length).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it("is idle when generationId is null", async () => {
    const client = new MockApiClient();
    const { result } = renderHook(() => useGenerationPolling(null, 10), { wrapper: wrapper(client) });
    await act(async () => {});
    expect(result.current.generation).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
