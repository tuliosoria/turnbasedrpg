import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, submissionSk, padTurn } from "../keys";
import type { Submission, CardResponse } from "@ravenloft/content";

export async function putSubmission(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, sub: Submission): Promise<void> {
  await doc.send(new PutCommand({ TableName: tableName, Item: {
    PK: campaignPk(campaignId), SK: submissionSk(turnId, sub.houseId),
    houseId: sub.houseId, orderText: sub.orderText, cardResponses: sub.cardResponses, submittedAt: sub.submittedAt } }));
}

export async function getSubmission(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number, houseId: string): Promise<Submission | null> {
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { PK: campaignPk(campaignId), SK: submissionSk(turnId, houseId) } }));
  if (!res.Item) return null;
  return { houseId: res.Item.houseId as string, orderText: res.Item.orderText as string,
    cardResponses: (res.Item.cardResponses as CardResponse[]) ?? [], submittedAt: res.Item.submittedAt as string };
}

export async function listSubmissions(doc: DynamoDBDocumentClient, tableName: string, campaignId: string, turnId: number): Promise<Submission[]> {
  const res = await doc.send(new QueryCommand({ TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": `TURN#${padTurn(turnId)}#SUB#` } }));
  return (res.Items ?? []).map((i) => ({ houseId: i.houseId as string, orderText: i.orderText as string,
    cardResponses: (i.cardResponses as CardResponse[]) ?? [], submittedAt: i.submittedAt as string }));
}
