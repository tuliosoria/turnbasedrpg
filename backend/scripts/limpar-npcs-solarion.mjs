/**
 * Tira do acervo os personagens que a semeadura inventou para Solarion.
 *
 * A Casa tem jogador, e o Mestre decidiu que só fica em Solarion quem ele
 * propôs e teve aprovado. O elenco estático já saiu de characters.ts e do
 * verbete; o que sobra são as entidades visuais que a semeadura gravou no
 * banco — Lady Samira e o retrato dela. Elas não aparecem mais no índice de
 * personagens, mas continuam no acervo do Estúdio e no que a IA consulta para
 * detectar conflito de cânone, o que faria a Lady ressurgir na primeira
 * proposta que citasse Solarion.
 *
 * Roda em seco por padrão. Com --confirm, apaga e guarda os itens inteiros em
 * backups/entidades/solarion/, que é o desfazer: são PutItem de volta.
 *
 * A imagem no S3 não é tocada de propósito. Apagar o item do DynamoDB some com
 * ela do jogo; apagar o arquivo é irreversível e não é preciso.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;

/**
 * O que sai. Só o que a semeadura criou: nada aqui tem `wikiEntryId`, que é a
 * marca de um verbete proposto por jogador e aprovado pelo Mestre.
 */
export const A_REMOVER = [
  "VENTITY#lady-samira-solarion",
  "VASSET#lady-samira-solarion-portrait",
];

/**
 * Recusa apagar o que veio do jogador. Uma entidade com verbete foi aprovada
 * pelo Mestre no Adicionar Canônico, e apagá-la levaria junto o retrato e o
 * texto que ele enviou.
 */
export function verificarSemeado(item) {
  if (item.wikiEntryId) {
    throw new Error(`${item.SK} tem verbete (${item.wikiEntryId}): é cânone do jogador, não da semeadura.`);
  }
  return item;
}

async function main() {
  const gravar = process.argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const achados = [];
  for (const SK of A_REMOVER) {
    const { Item } = await doc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK } }));
    if (!Item) {
      console.log(`${SK}: já não existe.`);
      continue;
    }
    achados.push(verificarSemeado(Item));
    console.log(`${SK}: ${Item.canonicalName ?? Item.description ?? ""}`);
  }

  if (achados.length === 0) {
    console.log("Nada a remover.");
    return;
  }

  if (!gravar) {
    console.log(`\nEnsaio: ${achados.length} item(ns) sairiam. Rode com --confirm para apagar.`);
    return;
  }

  const dir = new URL("../../backups/entidades/solarion/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const item of achados) {
    const nome = item.SK.replace(/[#/]/g, "_");
    writeFileSync(new URL(`${nome}.json`, dir), JSON.stringify(item, null, 2));
    await doc.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: item.PK, SK: item.SK } }));
  }
  console.log(`Removidos ${achados.length} item(ns). Cópia em backups/entidades/solarion/.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
