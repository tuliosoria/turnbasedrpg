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
