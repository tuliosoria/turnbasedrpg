import OpenAI from "openai";
import { mapOpenAiError } from "./openai";
import { HttpError } from "../types/domain";

export type ImageFn = (prompt: string) => Promise<Buffer>;

const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE = "1536x1024";
const IMAGE_QUALITY = "medium";

export function makeImageFn(apiKey: string): ImageFn {
  const client = new OpenAI({ apiKey, timeout: 28000, maxRetries: 0 });
  return async (prompt) => {
    try {
      const res = await client.images.generate({
        model: IMAGE_MODEL,
        prompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
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
