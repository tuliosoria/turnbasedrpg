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
