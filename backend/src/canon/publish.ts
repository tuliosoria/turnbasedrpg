import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  newVisualEntity,
  isCanonWikiSection,
  type CanonSubmission,
  type VisualAsset,
  type VisualAssetType,
  type VisualEntity,
  type VisualEntityType,
  type WikiEntry,
} from "@ravenloft/content";
import { putWikiEntry, generateWikiId } from "../db/wiki";
import { putEntity, getEntity, listEntities } from "../db/visual/entities";
import { putAsset } from "../db/visual/assets";
import { slugify } from "../validation/visualSchemas";

export interface PublishDeps {
  doc: DynamoDBDocumentClient;
  tableName: string;
  campaignId: string;
  newId: () => string;
}

export type SaveSubmission = (submission: CanonSubmission) => Promise<CanonSubmission>;

// Verbetes publicados por submissão entram no fim da seção: 999 é um piso alto o
// bastante para ficar depois do conteúdo curado, sem precisar recalcular ordens.
const WIKI_APPEND_ORDER = 999;

function assetTypeForEntity(entityType: VisualEntityType): VisualAssetType {
  switch (entityType) {
    case "CITY":
    case "SETTLEMENT":
    case "REGION":
    case "LANDMARK":
    case "BUILDING":
    case "ROOM":
      return "ESTABLISHING";
    case "MAP":
      return "MAP";
    case "HOUSE":
    case "SYMBOL":
      return "EMBLEM";
    default:
      return "PORTRAIT";
  }
}

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

  // Barreira de ficção: seções fora do cânone (regras de mesa) nunca recebem
  // conteúdo proposto por jogador. Rejeitamos antes de qualquer escrita.
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
      order: WIKI_APPEND_ORDER,
      updatedAt: new Date().toISOString(),
      ...(current.rawImageUrl ? { imageUrl: current.rawImageUrl, imageUrls: [current.rawImageUrl] } : {}),
    };
    await putWikiEntry(doc, tableName, campaignId, entry);
    current = { ...current, wikiEntryId: entry.entryId };
    await touch();
  }

  const entityType = current.proposal.entityType;
  const wantsEntity = entityType !== null;

  // Mantemos a entidade criada em memória para linkar a imagem sem reconsultar
  // o banco no fluxo feliz; numa retomada ela vem de getEntity.
  let createdEntity: VisualEntity | null = null;

  if (wantsEntity && !current.visualEntityId) {
    const existing = await listEntities(doc, tableName, campaignId);
    let slug = slugify(current.proposal.canonicalName);
    if (existing.some((e) => e.slug === slug)) slug = `${slug}-${deps.newId().slice(0, 4)}`;
    const entity = newVisualEntity({
      id: deps.newId(),
      campaignId,
      entityType,
      canonicalName: current.proposal.canonicalName,
      slug,
      publicDescription: current.proposal.summary,
      immutableTraits: current.proposal.immutableTraits,
      wikiEntryId: current.wikiEntryId,
      // A Casa vem da sessão de quem enviou, não do campo homônimo da proposta:
      // aquele é texto livre da IA, que não conhece os ids sorteados das Casas
      // e devolve o nome ("Solarion") onde se espera o id ("solarion-k0hc").
      houseId: current.houseId,
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
    const visualEntityId = current.visualEntityId;
    const now = new Date().toISOString();
    const asset: VisualAsset = {
      id: deps.newId(),
      campaignId,
      entityId: visualEntityId,
      assetType: entityType ? assetTypeForEntity(entityType) : "PORTRAIT",
      storageKey: current.rawImageKey,
      storageUrl: current.rawImageUrl,
      thumbnailStorageKey: null,
      thumbnailUrl: null,
      mimeType: guessMimeType(current.rawImageKey),
      // Enviada pelo jogador, não gerada: não passamos por decodificação de
      // imagem, então dimensões e checksum ficam vazios de propósito.
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
    // Grava o id logo após a escrita, antes do re-link da entidade: se
    // morrêssemos entre o putAsset e este save, uma retomada geraria um novo
    // id e escreveria um segundo VisualAsset. Persistir aqui mantém o mesmo
    // passo dos demais (escreve, grava o id, segue).
    current = { ...current, visualAssetId: asset.id };
    await touch();

    // Aponta a entidade para a imagem que acabou de virar canônica. Numa
    // retomada a entidade não está em memória, então buscamos pelo id gravado.
    const entity =
      createdEntity ??
      (await getEntity(doc, tableName, campaignId, visualEntityId));
    if (entity) {
      // Re-link é best-effort de propósito: o verbete da Enciclopédia é o que
      // alimenta os prompts da IA e já está gravado; o vínculo entidade↔imagem é
      // apresentação e pode ser reparado depois. Uma falha aqui não justifica
      // reprovar uma submissão que, para o jogo, já está completa.
      try {
        entity.canonicalAssetIds = [asset.id];
        entity.updatedAt = now;
        await putEntity(doc, tableName, campaignId, entity);
      } catch (err) {
        console.error(
          `Falha ao re-linkar entidade ${current.visualEntityId} ao asset ${asset.id} da submiss\u00e3o ${current.id}; aprova\u00e7\u00e3o segue e o v\u00ednculo pode ser reparado depois.`,
          err,
        );
      }
    } else {
      console.warn(
        `Submiss\u00e3o ${current.id}: entidade ${current.visualEntityId} n\u00e3o encontrada para re-link do asset ${asset.id}; v\u00ednculo entidade\u2194imagem ficou vazio.`,
      );
    }
  }

  current = { ...current, status: "APPROVED", resolvedAt: new Date().toISOString() };
  await touch();
  return current;
}
