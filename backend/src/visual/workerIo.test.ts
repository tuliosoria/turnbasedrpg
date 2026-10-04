import { describe, it, expect, vi, afterEach } from "vitest";
import type { VisualAsset } from "@ravenloft/content";
import { fetchReferenceBuffer, shareAssetQuery } from "./workerIo";

function asset(id: string): VisualAsset {
  return {
    id, campaignId: "winter-dead", entityId: "alic", assetType: "PORTRAIT", storageKey: "k", storageUrl: "https://x/a.png",
    thumbnailStorageKey: null, thumbnailUrl: null, mimeType: "image/png", width: 1, height: 1, aspectRatio: "1:1",
    checksum: "c", status: "READY", canonicalLevel: "CANONICAL", styleBibleVersion: 1, entityVersion: null,
    generationId: null, parentAssetIds: [], referenceRoles: [], cameraAngle: "", viewType: "", description: "",
    extractedVisualDescription: "", consistencyScore: null, consistencyReport: null, tags: [], createdAt: "",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shareAssetQuery", () => {
  it("runs the VASSET query once when two callers ask for the same campaign", async () => {
    const rows = [asset("a1"), asset("a2")];
    const load = vi.fn(async () => rows);
    const assetsFor = shareAssetQuery(load);
    const [first, second] = await Promise.all([assetsFor("winter-dead"), assetsFor("winter-dead")]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(rows);
    expect(second).toBe(rows);
  });
});

describe("fetchReferenceBuffer", () => {
  it("fails when the reference response is not 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    await expect(fetchReferenceBuffer("https://x/a.png")).rejects.toThrow(/404/);
  });

  it("aborts a reference download that exceeds the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(new Error("aborted"));
        return;
      }
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    await expect(fetchReferenceBuffer("https://x/a.png", 20)).rejects.toThrow(/abort/i);
  });
});
