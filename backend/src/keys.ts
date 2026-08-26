export function campaignPk(campaignId: string): string {
  return `CAMPAIGN#${campaignId.toUpperCase().replace(/-/g, "_")}`;
}

export function padTurn(turnId: number): string {
  return String(turnId).padStart(3, "0");
}

export function turnPk(campaignId: string, turnId: number): string {
  return `${campaignPk(campaignId)}#TURN#${padTurn(turnId)}`;
}

export function houseSk(houseId: string): string {
  return `HOUSE#${houseId}`;
}

export function playerPk(codeHash: string): string {
  return `PLAYER#${codeHash}`;
}

export function submissionSk(turnId: number, houseId: string): string {
  return `TURN#${padTurn(turnId)}#SUB#${houseId}`;
}

export function worldBibleSk(): string {
  return "WORLDBIBLE";
}

/** Um único rascunho de turno pendente por campanha. */
export function turnDraftSk(): string {
  return "TURNDRAFT#CURRENT";
}

export function npcStatePrefix(): string {
  return "NPCSTATE#";
}

export function npcStateSk(houseKey: string, characterId: string): string {
  return `NPCSTATE#${houseKey}#${characterId}`;
}

export function npcDynamicPrefix(): string {
  return "NPCDYN#";
}

/** Relação direcional entre duas Casas: quem sente # sobre quem. */
export function houseRelationSk(fromKey: string, toKey: string): string {
  return `HRELATION#${fromKey}#${toKey}`;
}
export function houseRelationPrefix(): string {
  return "HRELATION#";
}

export function npcDynamicSk(affiliation: string, id: string): string {
  return `NPCDYN#${affiliation}#${id}`;
}

export function wikiSk(entryId: string): string {
  return `WIKI#${entryId}`;
}

export function gmSk(entryId: string): string {
  return `GM#${entryId}`;
}

export function rateLimitPk(bucketKey: string): string {
  return `RATELIMIT#${bucketKey}`;
}

export function projectSk(houseId: string, projectId: string): string {
  return `PROJECT#${houseId}#${projectId}`;
}

export function projectHousePrefix(houseId: string): string {
  return `PROJECT#${houseId}#`;
}

export function projectPrefix(): string {
  return "PROJECT#";
}

export function favorSk(toHouseId: string, favorId: string): string {
  return `FAVOR#${toHouseId}#${favorId}`;
}

export function favorHousePrefix(toHouseId: string): string {
  return `FAVOR#${toHouseId}#`;
}

/** A alocação de Energia de uma Casa num turno. Um item por turno e por Casa. */
export function energiaSk(turnId: number, houseId: string): string {
  return `ENERGY#${padTurn(turnId)}#${houseId}`;
}

export function padVersion(version: number): string {
  return String(version).padStart(4, "0");
}
export function styleBibleSk(version: number): string {
  return `VSTYLE#${padVersion(version)}`;
}
export function styleBiblePrefix(): string {
  return "VSTYLE#";
}
export function entitySk(entityId: string): string {
  return `VENTITY#${entityId}`;
}
export function entityPrefix(): string {
  return "VENTITY#";
}
export function assetSk(assetId: string): string {
  return `VASSET#${assetId}`;
}
export function assetPrefix(): string {
  return "VASSET#";
}
export function generationSk(genId: string): string {
  return `VGEN#${genId}`;
}
export function generationPrefix(): string {
  return "VGEN#";
}

/**
 * Correspondência e registro da partida. Ambos vivem sob a partição da
 * campanha: são história desta mesa, não cânone do mundo.
 */
export function diplomaticMessageSk(turnNumber: number, pair: string, id: string): string {
  return `DIPLMSG#${padVersion(turnNumber)}#${pair}#${id}`;
}
export function diplomaticTurnPrefix(turnNumber: number): string {
  return `DIPLMSG#${padVersion(turnNumber)}#`;
}
export function diplomaticPairPrefix(turnNumber: number, pair: string): string {
  return `DIPLMSG#${padVersion(turnNumber)}#${pair}#`;
}
export function diplomaticPrefix(): string {
  return "DIPLMSG#";
}
export function campaignFactSk(id: string): string {
  return `CFACT#${id}`;
}
export function campaignFactPrefix(): string {
  return "CFACT#";
}
/** Propostas de cânone feitas por jogadores, aguardando ou já julgadas pelo Mestre. */
export function canonSubmissionSk(submissionId: string): string {
  return `CANONSUB#${submissionId}`;
}
export function canonSubmissionPrefix(): string {
  return "CANONSUB#";
}

/** Prefixo comum a toda imagem de cânone gerada por este servidor no S3. */
export const CANON_IMAGE_KEY_PREFIX = "canon/";

/** Monta a chave S3 de uma imagem de cânone, no formato canon/<id>/original.<ext>. */
export function canonImageKey(imageId: string, extension: string): string {
  return `${CANON_IMAGE_KEY_PREFIX}${imageId}/original.${extension}`;
}

/** Confere se a chave tem a forma que uploadCanonImage geraria, sem confiar no cliente. */
export function isCanonImageKey(key: string): boolean {
  return /^canon\/[A-Za-z0-9-]+\/original\.(png|jpg|webp)$/.test(key);
}
