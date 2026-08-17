import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, canonSubmissionSk, canonSubmissionPrefix } from "../keys";
import type { CanonSubmission } from "@ravenloft/content";

function toSubmission(item: Record<string, unknown>): CanonSubmission {
  if (typeof item.id !== "string" || typeof item.campaignId !== "string" || typeof item.status !== "string") {
    throw new Error(
      `Registro de pedido de cânone corrompido ou incompleto: id=${JSON.stringify(item.id)}, campaignId=${JSON.stringify(item.campaignId)}, status=${JSON.stringify(item.status)}`,
    );
  }
  return item as unknown as CanonSubmission;
}

export async function putCanonSubmission(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  submission: CanonSubmission,
): Promise<CanonSubmission> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: { PK: campaignPk(campaignId), SK: canonSubmissionSk(submission.id), ...submission },
    }),
  );
  return submission;
}

export async function getCanonSubmission(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  submissionId: string,
): Promise<CanonSubmission | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: campaignPk(campaignId), SK: canonSubmissionSk(submissionId) },
    }),
  );
  return res.Item ? toSubmission(res.Item as Record<string, unknown>) : null;
}

/** Mais recentes primeiro. `houseId` filtra a fila do jogador. */
export async function listCanonSubmissions(
  doc: DynamoDBDocumentClient,
  tableName: string,
  campaignId: string,
  houseId?: string,
): Promise<CanonSubmission[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": canonSubmissionPrefix() },
    }),
  );
  const items = (res.Items ?? []).map((item) => toSubmission(item as Record<string, unknown>));
  const filtered = houseId ? items.filter((s) => s.houseId === houseId) : items;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
