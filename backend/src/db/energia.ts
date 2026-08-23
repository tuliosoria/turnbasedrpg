import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { campaignPk, energiaSk } from "../keys";
import type { AlocacaoEnergia } from "@ravenloft/content";

export async function getAlocacaoEnergia(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnId: number, houseId: string,
): Promise<AlocacaoEnergia | null> {
  const res = await doc.send(new GetCommand({
    TableName: table,
    Key: { PK: campaignPk(campaignId), SK: energiaSk(turnId, houseId) },
  }));
  // null = não há registro, ou seja, a Casa não distribuiu nada neste turno.
  // {} = há registro e está vazio, ou seja, ela distribuiu e escolheu não mover
  // carta nenhuma. A resolução do turno trata os dois casos de forma diferente:
  // o primeiro recebe a distribuição padrão, o segundo é respeitado como está.
  return res.Item ? ((res.Item as { porProjeto?: AlocacaoEnergia }).porProjeto ?? {}) : null;
}

export async function putAlocacaoEnergia(
  doc: DynamoDBDocumentClient, table: string, campaignId: string, turnId: number, houseId: string,
  porProjeto: AlocacaoEnergia,
): Promise<void> {
  await doc.send(new PutCommand({
    TableName: table,
    Item: {
      PK: campaignPk(campaignId),
      SK: energiaSk(turnId, houseId),
      turnId, houseId, porProjeto,
      atualizadoEm: new Date().toISOString(),
    },
  }));
}
