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
  // null = sem registro (Casa não distribuiu nada); {} = registro existe mas vazio
  // A distinção importa para a Task 4 decidir se aplica a distribuição padrão
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
