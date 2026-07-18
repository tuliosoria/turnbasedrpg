import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { turnPk } from "../keys";

export type TurnStatus = "OPEN" | "LOCKED";

export async function getTurnStatus(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
): Promise<TurnStatus> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName, Key: { PK: turnPk(campaignId, turnId), SK: "META" } }),
  );
  return (res.Item?.turnStatus as TurnStatus) ?? "OPEN";
}

export async function setTurnStatus(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  status: TurnStatus,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: turnPk(campaignId, turnId), SK: "META", turnStatus: status },
    }),
  );
}
