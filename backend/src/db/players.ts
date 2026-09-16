import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { playerPk } from "../keys";

export interface PlayerProfile {
  houseId: string;
  displayName: string;
  codeHash: string;
}

export async function getPlayerByCodeHash(
  doc: DynamoDBDocumentClient,
  tableName: string,
  codeHash: string,
): Promise<PlayerProfile | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: playerPk(codeHash), SK: "PROFILE" } }),
  );
  if (!res.Item) return null;
  return {
    houseId: res.Item.houseId as string,
    displayName: res.Item.displayName as string,
    codeHash: res.Item.codeHash as string,
  };
}
