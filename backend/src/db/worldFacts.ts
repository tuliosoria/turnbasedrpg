import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, worldFactPrefix, worldFactSk } from "../keys";
import type { WorldFact } from "@ravenloft/content";

export async function putWorldFact(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, f: WorldFact,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: { PK: campaignPk(campaignId), SK: worldFactSk(f.id), ...f },
  }));
}

export async function listWorldFacts(
  doc: DynamoDBDocumentClient, table: string, campaignId: string,
): Promise<WorldFact[]> {
  const res = await doc.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": worldFactPrefix() },
  }));
  return (res.Items ?? []).map((i) => {
    const { PK, SK, ...rest } = i as Record<string, unknown>;
    return rest as unknown as WorldFact;
  });
}

/**
 * Apaga os fatos extraídos de um turno.
 *
 * É o que torna a extração idempotente: reaplicar um turno reescreve os fatos
 * dele em vez de empilhar uma segunda cópia de cada um. Só apaga o que a
 * extração criou — um fato revogado à mão pelo Mestre também é daquele turno e
 * seria ressuscitado, então a revogação é respeitada e ele não volta.
 */
export async function deleteWorldFactsOfTurn(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnNumber: number,
): Promise<string[]> {
  const todos = await listWorldFacts(doc, table, campaignId);
  const doTurno = todos.filter((f) => f.turnNumber === turnNumber && f.status === "ATIVO");
  for (const f of doTurno) {
    await doc.send(new DeleteCommand({ TableName: table, Key: { PK: campaignPk(campaignId), SK: worldFactSk(f.id) } }));
  }
  return doTurno.map((f) => f.id);
}
