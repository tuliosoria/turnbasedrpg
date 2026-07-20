import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { padTurn } from "../keys";
import { HttpError } from "../types/domain";

export type TurnImageKind = "event" | "result";

export interface ImageStore {
  uploadTurnImage(kind: TurnImageKind, turnId: number, body: Buffer): Promise<string>;
  uploadHouseImage(houseId: string, index: number, body: Buffer): Promise<string>;
}

export function makeImageStore(bucket: string, baseUrl: string, region?: string): ImageStore {
  const client = new S3Client({ region });
  return {
    async uploadTurnImage(kind, turnId, body) {
      const key = `turns/${padTurn(turnId)}/${kind}.png`;
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
