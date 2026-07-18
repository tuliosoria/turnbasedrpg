import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { turnPk, houseSk } from "../keys";
import { HttpError } from "../types/domain";

export interface StoredChoice {
  cardId: string;
  chosenAt: string;
}

export async function putChoice(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  houseId: string,
  cardId: string,
  chosenAt: string,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: turnPk(campaignId, turnId),
        SK: houseSk(houseId),
        houseId,
        cardId,
        chosenAt,
      },
    }),
  );
}

export async function putChoiceGuarded(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  houseId: string,
  cardId: string,
  chosenAt: string,
): Promise<void> {
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: turnPk(campaignId, turnId),
                SK: houseSk(houseId),
                houseId,
                cardId,
                chosenAt,
              },
            },
          },
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: turnPk(campaignId, turnId), SK: "META" },
              ConditionExpression: "attribute_not_exists(turnStatus) OR turnStatus <> :locked",
              ExpressionAttributeValues: { ":locked": "LOCKED" },
            },
          },
        ],
      }),
    );
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
      throw new HttpError(423, "TURN_LOCKED", "O Conselho está resolvendo o turno.");
    }
    throw e;
  }
}

export async function getChoice(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
  houseId: string,
): Promise<StoredChoice | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: turnPk(campaignId, turnId), SK: houseSk(houseId) },
    }),
  );
  if (!res.Item) return null;
  return { cardId: res.Item.cardId as string, chosenAt: res.Item.chosenAt as string };
}

export async function listChoices(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  turnId: number,
): Promise<Map<string, StoredChoice>> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": turnPk(campaignId, turnId), ":sk": "HOUSE#" },
    }),
  );
  const map = new Map<string, StoredChoice>();
  for (const item of res.Items ?? []) {
    map.set(item.houseId as string, {
      cardId: item.cardId as string,
      chosenAt: item.chosenAt as string,
    });
  }
  return map;
}
