import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { padTurn } from "../keys";
import { HttpError } from "../types/domain";

export type TurnImageKind = "event" | "result";
export type StoredImageContentType = "image/png" | "image/jpeg" | "image/webp";

function imageExtension(contentType: StoredImageContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

export interface ImageStore {
  uploadTurnImage(kind: TurnImageKind, turnId: number, body: Buffer, contentType?: StoredImageContentType): Promise<string>;
  uploadHouseImage(houseId: string, index: number, body: Buffer): Promise<string>;
}

export function makeImageStore(bucket: string, baseUrl: string, region?: string): ImageStore {
  const client = new S3Client({ region });
  return {
    async uploadTurnImage(kind, turnId, body, contentType = "image/png") {
      const key = `turns/${padTurn(turnId)}/${kind}.${imageExtension(contentType)}`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
      return `${baseUrl}/${key}?v=${Date.now()}`;
    },
    async uploadHouseImage(houseId, index, body) {
      const key = `houses/${houseId}/${index}.png`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "image/png",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
      return `${baseUrl}/${key}?v=${Date.now()}`;
    },
  };
}
