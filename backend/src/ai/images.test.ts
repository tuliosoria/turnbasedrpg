import { describe, it, expect, vi } from "vitest";
import { makeImageEditFn } from "./images";

vi.mock("openai", () => {
  const editMock = vi.fn(async () => ({ data: [{ b64_json: Buffer.from("edited").toString("base64") }] }));
  const toFile = vi.fn(async (buf: Buffer, name: string) => ({ name, buf }));
  class OpenAI { images = { edit: editMock }; }
  return { default: OpenAI, toFile };
});

describe("makeImageEditFn", () => {
  it("returns a Buffer from b64_json and passes input_fidelity high", async () => {
    const editFn = makeImageEditFn("key");
    const out = await editFn("edit this", [Buffer.from("ref1")]);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).toBe("edited");
    expect(out).toBeInstanceOf(Buffer);
  });
});
