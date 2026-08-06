import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, projectSk, projectHousePrefix, projectPrefix, favorSk, favorHousePrefix } from "../keys";
import type { ProjectCard, Favor } from "@ravenloft/content";

export async function putProject(doc: DynamoDBDocumentClient, table: string, campaignId: string, p: ProjectCard): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: projectSk(p.houseId, p.id), ...p } }));
}

export async function getProject(doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string, projectId: string): Promise<ProjectCard | null> {
  const res = await doc.send(new GetCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: projectSk(houseId, projectId) } }));
  return res.Item ? toProject(res.Item) : null;
}

export async function listHouseProjects(doc: DynamoDBDocumentClient, table: string, campaignId: string, houseId: string): Promise<ProjectCard[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": projectHousePrefix(houseId) } }));
  return (res.Items ?? []).map(toProject);
}

export async function listCampaignProjects(doc: DynamoDBDocumentClient, table: string, campaignId: string): Promise<ProjectCard[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": projectPrefix() } }));
  return (res.Items ?? []).map(toProject);
}

export async function putFavor(doc: DynamoDBDocumentClient, table: string, campaignId: string, f: Favor): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: { PK: campaignPk(campaignId), SK: favorSk(f.toHouseId, f.id), ...f } }));
}

export async function listFavorsForHouse(doc: DynamoDBDocumentClient, table: string, campaignId: string, toHouseId: string): Promise<Favor[]> {
  const res = await doc.send(new QueryCommand({ TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": favorHousePrefix(toHouseId) } }));
  return (res.Items ?? []).map(toFavor);
}

function toProject(i: Record<string, unknown>): ProjectCard {
  const { PK, SK, ...rest } = i as any;
  return rest as ProjectCard;
}

function toFavor(i: Record<string, unknown>): Favor {
  const { PK, SK, ...rest } = i as any;
  return rest as Favor;
}
