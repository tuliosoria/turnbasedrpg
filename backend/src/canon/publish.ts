import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  newVisualEntity,
  isCanonWikiSection,
  type CanonSubmission,
  type VisualAsset,
  type VisualEntity,
  type WikiEntry,
} from "@ravenloft/content";
import { putWikiEntry, generateWikiId } from "../db/wiki";
import { putEntity, listEntities } from "../db/visual/entities";
import { putAsset } from "../db/visual/assets";
import { slugify } from "../validation/visualSchemas";

export interface PublishDeps {
  doc: DynamoDBDocumentClient;
  tableName: string;
  campaignId: string;
  newId: () => string;
}

export type SaveSubmission = (submission: CanonSubmission) => Promise<CanonSubmission>;

function guessMimeType(key: string): string {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * Aprova e publica uma submissão em três escritas independentes: verbete da
 * Enciclopédia, entidade visual e imagem canônica.
 *
 * Não existe transação entre uma escrita e a próxima. Cada passo grava o id que
 * produziu **antes** de o seguinte começar, e é pulado quando esse id já existe
 * — assim reaprovar depois de uma falha no meio retoma de onde parou em vez de
 * criar um segundo verbete. `status` só vira `APPROVED` quando os três terminam.
 */
export async function publishCanonSubmission(
  deps: PublishDeps,
  submission: CanonSubmission,
  save: SaveSubmission,
): Promise<CanonSubmission> {
  const { doc, tableName, campaignId } = deps;

  // Barreira de fic\u00e7\u00e3o: se\u00e7\u00f5es fora do c\u00e2none (regras de mesa) nunca recebem
  // conte\u00fado proposto por jogador. Rejeitamos antes de qualquer escrita.
  if (!isCanonWikiSection(submission.proposal.section)) {
    throw new Error(
      `Se\u00e7\u00e3o "${submission.proposal.section}" \u00e9 fora do c\u00e2none e n\u00e3o pode receber submiss\u00f5es de jogador.`,
    );
  }

  let current: CanonSubmission = { ...submission };
  const touch = async () => {
    current = { ...current, updatedAt: new Date().toISOString() };
    await save(current);
  };

  if (!current.wikiEntryId) {
    const entry: WikiEntry = {
      entryId: generateWikiId(),
      section: current.proposal.section,
      title: current.proposal.title,
      body: current.proposal.body,
      order: 999,
      updatedAt: new Date().toISOString(),
      ...(current.rawImageUrl ? { imageUrl: current.rawImageUrl, imageUrls: [current.rawImageUrl] } : {}),
    };
    await putWikiEntry(doc, tableName, campaignId, entry);
    current = { ...current, wikiEntryId: entry.entryId };
    await touch();
  }

  const wantsEntity = current.proposal.entityType !== null;

  // Mantemos a entidade criada em mem\u00f3ria para linkar a imagem sem reconsultar
  // o banco no fluxo feliz; numa retomada ela vem de listEntities.
  let createdEntity: VisualEntity | null = null;

  if (wantsEntity && !current.visualEntityId) {
    const existing = await listEntities(doc, tableName, campaignId);
    let slug = slugify(current.proposal.canonicalName);
    if (existing.some((e) => e.slug === slug)) slug = `${slug}-${deps.newId().slice(0, 4)}`;
    const entity = newVisualEntity({
      id: deps.newId(),
      campaignId,
      entityType: current.proposal.entityType!,
      canonicalName: current.proposal.canonicalName,
      slug,
      publicDescription: current.proposal.summary,
      immutableTraits: current.proposal.immutableTraits,
      wikiEntryId: current.wikiEntryId,
      houseId: current.proposal.houseId,
    });
    entity.status = "CANONICAL";
    await putEntity(doc, tableName, campaignId, entity);
    createdEntity = entity;
    current = { ...current, visualEntityId: entity.id };
    await touch();
  }

  if (
    wantsEntity &&
    current.visualEntityId &&
    current.rawImageKey &&
    current.rawImageUrl &&
    !current.visualAssetId
  ) {
    const now = new Date().toISOString();
    const asset: VisualAsset = {
      id: deps.newId(),
      campaignId,
      entityId: current.visualEntityId,
      assetType: "PORTRAIT",
      storageKey: current.rawImageKey,
      storageUrl: current.rawImageUrl,
      thumbnailStorageKey: null,
      thumbnailUrl: null,
      mimeType: guessMimeType(current.rawImageKey),
      // Enviada pelo jogador, n\u00e3o gerada: n\u00e3o passamos por decodifica\u00e7\u00e3o de
      // imagem, ent\u00e3o dimens\u00f5es e checksum ficam vazios de prop\u00f3sito.
      width: 0,
      height: 0,
      aspectRatio: "",
      checksum: "",
      status: "READY",
      canonicalLevel: "CANONICAL",
      styleBibleVersion: 0,
      entityVersion: 1,
      generationId: null,
      parentAssetIds: [],
      referenceRoles: [],
      cameraAngle: "",
      viewType: "",
      description: current.proposal.summary,
      extractedVisualDescription: "",
      consistencyScore: null,
      consistencyReport: null,
      tags: ["canon-submission"],
      createdAt: now,
    };
    await putAsset(doc, tableName, campaignId, asset);
    // Grava o id logo ap\u00f3s a escrita, antes do re-link da entidade: se
    // morr\u00eassemos entre o putAsset e este save, uma retomada geraria um novo
    // id e escreveria um segundo VisualAsset. Persistir aqui mant\u00e9m o mesmo
    // passo dos demais (escreve, grava o id, segue).
    current = { ...current, visualAssetId: asset.id };
    await touch();

    // Aponta a entidade para a imagem que acabou de virar can\u00f4nica. Numa
    // retomada a entidade n\u00e3o est\u00e1 em mem\u00f3ria, ent\u00e3o buscamos pelo id gravado.
    const entity =
      createdEntity ??
      (await listEntities(doc, tableName, campaignId)).find((e) => e.id === current.visualEntityId) ??
      null;
    if (entity) {
      entity.canonicalAssetIds = [asset.id];
      entity.updatedAt = now;
      await putEntity(doc, tableName, campaignId, entity);
    }
  }

  current = { ...current, status: "APPROVED", resolvedAt: new Date().toISOString() };
  await touch();
  return current;
}
