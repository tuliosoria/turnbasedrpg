import OpenAI, { toFile } from "openai";
import { mapOpenAiError } from "./openai";
import { HttpError } from "../types/domain";

export type ImageFn = (prompt: string) => Promise<Buffer>;

export interface ImageOptions {
  model: string;
  size: string;
  quality: string;
}

/** Defaults preserve the behaviour that shipped before these were configurable. */
export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  model: "gpt-image-1",
  size: "1536x1024",
  quality: "medium",
};

export function makeImageFn(apiKey: string, timeoutMs = 28000, opts: ImageOptions = DEFAULT_IMAGE_OPTIONS): ImageFn {
  const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  return async (prompt) => {
    try {
      const res = await client.images.generate({
        model: opts.model,
        prompt,
        size: opts.size as never,
        quality: opts.quality as never,
        n: 1,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new HttpError(502, "IMAGE_ERROR", "A IA não retornou uma imagem.");
      return Buffer.from(b64, "base64");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw mapOpenAiError(e);
    }
  };
}

export type ImageEditFn = (prompt: string, references: Buffer[]) => Promise<Buffer>;

export function makeImageEditFn(apiKey: string, timeoutMs = 120000, opts: ImageOptions = DEFAULT_IMAGE_OPTIONS): ImageEditFn {
  const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  return async (prompt, references) => {
    try {
      const files = await Promise.all(
        references.map((buf, i) => toFile(buf, `ref-${i}.png`, { type: "image/png" })),
      );
      const res = await client.images.edit({
        model: opts.model,
        image: files,
        prompt,
        size: opts.size as never,
        quality: opts.quality as never,
        input_fidelity: "high",
        n: 1,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new HttpError(502, "IMAGE_ERROR", "A IA não retornou uma imagem.");
      return Buffer.from(b64, "base64");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw mapOpenAiError(e);
    }
  };
}
