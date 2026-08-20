import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Publica a entrada de wiki da Rede das Lanternas — a rede de informantes de
 * Porto Cinzento de onde uma Casa pode comprar informação. Cria uma entrada
 * NOVA; não reescreve nada do que o autor já escreveu.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

const entryId = "cidades-008-a-rede-das-lanternas";
const entry = {
  entryId,
  section: "cidades",
  title: "A Rede das Lanternas",
  order: 8,
  body: `Em Porto Cinzento, nem toda mercadoria cabe num porão.

A Rede das Lanternas é o nome que se dá aos informantes do porto: estivadores que contam navios, escribas que copiam duas vezes, taberneiros com boa memória e crianças que correm mais rápido que qualquer corvo. Ninguém sabe quem está no topo dela — se é que existe um topo. Sabe-se apenas que a Rede vende, e que vende a quem paga.

> "Em Porto Cinzento, toda lanterna ilumina alguma coisa — desde que você tenha moeda suficiente."

**Como funciona.** Uma Casa envia um agente a Porto Cinzento e gasta **1 ponto de Riqueza** para comprar uma informação. O jogador informa o assunto que deseja investigar — movimentações da Coroa, os Casco Vermelho, a Asteria, uma Casa rival. O Mestre determina o que a Rede conseguiu descobrir conforme a dificuldade e a disponibilidade daquele assunto.

O que volta pode ser um **rumor**, uma **informação parcial**, uma **informação confiável** ou, raramente, um **segredo importante**.

**O que não está à venda.** Informações extremamente protegidas não se compram com moeda. Nesses casos a Rede entrega outra coisa: uma **pista de como obtê-las** — um nome, um lugar, uma porta. O resto é com você.

E convém lembrar: a Rede vende a quem paga. Inclusive a quem quiser saber o que você andou perguntando.`,
  updatedAt: new Date().toISOString(),
};

async function main() {
  const key = { PK: campaignPk(campaignId), SK: `WIKI#${entryId}` };
  const existing = await doc.send(new GetCommand({ TableName: tableName, Key: key }));
  if (existing.Item) {
    console.log(`Já existe a entrada ${entryId} — será sobrescrita.`);
  }
  if (!confirm) {
    console.log(`[dry-run] criaria WIKI#${entryId} (seção ${entry.section}, ordem ${entry.order})`);
    console.log(entry.body.slice(0, 300) + "...");
    console.log("\nRode de novo com --confirm.");
    return;
  }
  await doc.send(new PutCommand({ TableName: tableName, Item: { ...key, ...entry } }));
  console.log(`Publicado: ${entry.title} (${entryId})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
