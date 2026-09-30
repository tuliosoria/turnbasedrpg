import { beforeEach, describe, it, expect, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn((input) => ({ input })),
  DeleteObjectCommand: vi.fn((input) => ({ input })),
}));

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { makeImageStore } from "./images";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadTurnImage", () => {
  it("uploads a JPEG turn image with the matching content type and extension", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadTurnImage("result", 12, Buffer.from("jpg"), "image/jpeg");
    expect(url).toMatch(/^https:\/\/cdn\.example\/turns\/012\/result\.jpg\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string; Bucket: string } };
    expect(call.input.Key).toBe("turns/012/result.jpg");
    expect(call.input.ContentType).toBe("image/jpeg");
    expect(call.input.Bucket).toBe("my-bucket");
  });

  it("keeps generated turn images as PNG by default", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    const url = await store.uploadTurnImage("event", 4, Buffer.from("png"));
    expect(url).toMatch(/^https:\/\/cdn\.example\/turns\/004\/event\.png\?v=\d+$/);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string } };
    expect(call.input.Key).toBe("turns/004/event.png");
    expect(call.input.ContentType).toBe("image/png");
  });

  it("deletes the previous turn object when the extension changes", async () => {
    sendMock.mockResolvedValue({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    await store.uploadTurnImage(
      "result",
      12,
      Buffer.from("jpg"),
      "image/jpeg",
      "https://cdn.example/turns/012/result.png?v=1",
    );

    const keys = sendMock.mock.calls.map((c) => (c[0] as { input: { Key: string } }).input.Key);
    expect(keys).toEqual(["turns/012/result.jpg", "turns/012/result.png"]);
    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "my-bucket",
      Key: "turns/012/result.jpg",
      ContentType: "image/jpeg",
    }));
    expect(DeleteObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "my-bucket",
      Key: "turns/012/result.png",
    }));
  });

  it("leaves the previous object when the new upload uses the same key", async () => {
    sendMock.mockResolvedValue({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    await store.uploadTurnImage(
      "event",
      4,
      Buffer.from("png"),
      "image/png",
      "https://cdn.example/turns/004/event.png?v=9",
    );
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("does not delete a previous url outside this bucket or this turn image", async () => {
    sendMock.mockResolvedValue({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    await store.uploadTurnImage("event", 4, Buffer.from("jpg"), "image/jpeg", "https://other.example/turns/004/event.png");
    await store.uploadTurnImage("event", 4, Buffer.from("jpg"), "image/jpeg", "https://cdn.example/turns/004/result.png?v=1");
    await store.uploadTurnImage("event", 4, Buffer.from("jpg"), "image/jpeg", "https://cdn.example/houses/casa/1.png");
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });
});

describe("deleteTurnImage", () => {
  it("deletes the public turn object for this kind", async () => {
    sendMock.mockResolvedValue({});
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    await store.deleteTurnImage("event", 4, "https://cdn.example/turns/004/event.png?v=3");
    expect(DeleteObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "my-bucket",
      Key: "turns/004/event.png",
    }));
    expect(PutObjectCommand).not.toHaveBeenCalled();
  });

  it("does nothing when the url is empty or not this turn object", async () => {
    const store = makeImageStore("my-bucket", "https://cdn.example", "us-east-1");
    await store.deleteTurnImage("event", 4, "");
    await store.deleteTurnImage("result", 4, "https://evil.example/turns/004/result.png");
    await store.deleteTurnImage("event", 4, "https://cdn.example/houses/x/1.png");
    expect(sendMock).not.toHaveBeenCalled();
  });
});

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

describe("uploadCanonImage", () => {
  it("stores under canon/<id>/original.<ext> and returns key and url", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("bucket", "https://cdn.exemplo", "us-east-1");
    const result = await store.uploadCanonImage("img1", Buffer.from([1, 2]), "image/jpeg");
    expect(result.key).toBe("canon/img1/original.jpg");
    expect(result.url.startsWith("https://cdn.exemplo/canon/img1/original.jpg?v=")).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    // Garante que a chave enviada ao S3 é exatamente a mesma retornada pela função,
    // evitando divergência silenciosa que tornaria a imagem inacessível na aprovação.
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string } };
    expect(call.input.Key).toBe(result.key);
    expect(call.input.ContentType).toBe("image/jpeg");
  });

  it("usa PNG por padrão quando o content type é omitido", async () => {
    sendMock.mockResolvedValueOnce({});
    const store = makeImageStore("bucket", "https://cdn.exemplo", "us-east-1");
    const result = await store.uploadCanonImage("img2", Buffer.from([3, 4]));
    expect(result.key).toBe("canon/img2/original.png");
    expect(result.url.startsWith("https://cdn.exemplo/canon/img2/original.png?v=")).toBe(true);
    const call = sendMock.mock.calls[0][0] as { input: { Key: string; ContentType: string } };
    expect(call.input.ContentType).toBe("image/png");
  });
});
