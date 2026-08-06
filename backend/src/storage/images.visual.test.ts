import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn(async () => ({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = sendMock; },
  PutObjectCommand: class { constructor(public input: any) {} },
}));

import { makeImageStore } from "./images";

describe("uploadVisualAsset", () => {
  it("uploads original and thumbnail and returns both URLs", async () => {
    const store = makeImageStore("bucket", "https://bucket.s3.us-east-1.amazonaws.com", "us-east-1");
    const res = await store.uploadVisualAsset("a1", Buffer.from("orig"), Buffer.from("thumb"), "image/png");
    expect(res.url).toContain("visual/a1/original.png");
    expect(res.thumbnailUrl).toContain("visual/a1/thumb.png");
    expect(res.key).toBe("visual/a1/original.png");
    expect(res.thumbnailKey).toBe("visual/a1/thumb.png");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
