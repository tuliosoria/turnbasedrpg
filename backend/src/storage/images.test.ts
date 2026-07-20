import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

import { makeImageStore } from "./images";

describe("uploadHouseImage", () => {
  it("uploads under the house key and returns a versioned url", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadHouseImage("casa-vargen-ab12", 2, Buffer.from("x"));
    expect(url).toMatch(/^https:\/\/cdn\.example\/houses\/casa-vargen-ab12\/2\.png\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; Bucket: string } };
    expect(call.input.Key).toBe("houses/casa-vargen-ab12/2.png");
    expect(call.input.Bucket).toBe("my-bucket");
  });
});
