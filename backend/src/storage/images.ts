import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { padTurn, canonImageKey } from "../keys";
import { HttpError } from "../types/domain";

export type TurnImageKind = "event" | "result";
export type StoredImageContentType = "image/png" | "image/jpeg" | "image/webp";

function imageExtension(contentType: StoredImageContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

const TURN_OBJECT_KEY = /^turns\/(\d{3})\/(event|result)\.(png|jpg|webp)$/;

function turnObjectKey(kind: TurnImageKind, turnId: number, contentType: StoredImageContentType): string {
  return `turns/${padTurn(turnId)}/${kind}.${imageExtension(contentType)}`;
}

/** Chave deste bucket só se a URL for o objeto deste turno e deste tipo. */
function ownedTurnObjectKey(baseUrl: string, url: string, kind: TurnImageKind, turnId: number): string | null {
  const prefix = `${baseUrl}/`;
  if (!url.startsWith(prefix)) return null;
  const path = (url.slice(prefix.length).split("?")[0] ?? "").split("#")[0] ?? "";
  const match = TURN_OBJECT_KEY.exec(path);
  if (!match || match[1] !== padTurn(turnId) || match[2] !== kind) return null;
  return path;
}

export interface ImageStore {
  /** URL base pública de todo objeto deste bucket, usada para validar imagens do próprio servidor. */
  readonly baseUrl: string;
  uploadTurnImage(
    kind: TurnImageKind,
    turnId: number,
    body: Buffer,
    contentType?: StoredImageContentType,
    previousUrl?: string,
  ): Promise<string>;
  deleteTurnImage(kind: TurnImageKind, turnId: number, currentUrl: string): Promise<void>;
  uploadHouseImage(houseId: string, index: number, body: Buffer): Promise<string>;
  uploadVisualAsset(
    assetId: string,
    original: Buffer,
    thumbnail: Buffer | null,
    contentType?: StoredImageContentType,
  ): Promise<{ key: string; url: string; thumbnailKey: string | null; thumbnailUrl: string | null }>;
  uploadCanonImage(
    imageId: string,
    body: Buffer,
    contentType?: StoredImageContentType,
  ): Promise<{ key: string; url: string }>;
}

export function makeImageStore(bucket: string, baseUrl: string, region?: string): ImageStore {
  const client = new S3Client({ region });
  return {
    baseUrl,
    async uploadTurnImage(kind, turnId, body, contentType = "image/png", previousUrl) {
      const key = turnObjectKey(kind, turnId, contentType);
      const previousKey = previousUrl ? ownedTurnObjectKey(baseUrl, previousUrl, kind, turnId) : null;
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
        if (previousKey && previousKey !== key) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: previousKey }));
        }
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
      return `${baseUrl}/${key}?v=${Date.now()}`;
    },
    async deleteTurnImage(kind, turnId, currentUrl) {
      const key = ownedTurnObjectKey(baseUrl, currentUrl, kind, turnId);
      if (!key) return;
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao apagar a imagem no armazenamento.");
      }
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
    async uploadVisualAsset(assetId, original, thumbnail, contentType = "image/png") {
      const ext = imageExtension(contentType);
      const key = `visual/${assetId}/original.${ext}`;
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: original, ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }));
        let thumbnailKey: string | null = null;
        let thumbnailUrl: string | null = null;
        if (thumbnail) {
          thumbnailKey = `visual/${assetId}/thumb.${ext}`;
          await client.send(new PutObjectCommand({
            Bucket: bucket, Key: thumbnailKey, Body: thumbnail, ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }));
          thumbnailUrl = `${baseUrl}/${thumbnailKey}?v=${Date.now()}`;
        }
        return { key, url: `${baseUrl}/${key}?v=${Date.now()}`, thumbnailKey, thumbnailUrl };
      } catch {
        throw new HttpError(502, "IMAGE_ERROR", "Falha ao salvar a imagem no armazenamento.");
      }
    },
    async uploadCanonImage(imageId, body, contentType = "image/png") {
      const key = canonImageKey(imageId, imageExtension(contentType));
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
      return { key, url: `${baseUrl}/${key}?v=${Date.now()}` };
    },
  };
}
