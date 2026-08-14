import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Tira o nome do cenário antigo dos registros que ainda o carregam.
 *
 * "Ravenloft" e "O Inverno dos Mortos" saíram do código, mas dois registros no
 * DynamoDB continuam alimentando texto novo com eles: a Bíblia Visual, cujo
 * `renderingStyle` entra em todo prompt de imagem, e a Bíblia do Mestre, que é
 * o contexto de toda narrativa gerada. Enquanto estiverem lá, o jogo continua
 * dizendo os nomes mesmo com a interface limpa.
 *
 * Mexer em prosa autoral merece cuidado: o script mostra cada trecho antes e
 * depois, grava só com --confirm, e nunca reescreve — só remove o nome e
 * conserta a pontuação que sobra.
 *
 *   node scripts/drop-setting-name.mjs            # mostra o que mudaria
 *   node scripts/drop-setting-name.mjs --confirm  # grava
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

/** Campos que alimentam texto novo. Histórico de gerações fica como está. */
const TARGETS = [
  { skPrefix: "VSTYLE#", fields: ["renderingStyle"] },
  { skPrefix: "WORLDBIBLE", fields: ["lore", "visualDirectives"] },
];

function clean(text) {
  return text
    // "chamada "O Inverno dos Mortos"." e variações com aspas
    .replace(/\s*chamada\s+"O Inverno dos Mortos"/gi, "")
    .replace(/\s*\("O Inverno dos Mortos"\)/gi, "")
    .replace(/"O Inverno dos Mortos"/gi, "")
    .replace(/O Inverno dos Mortos/gi, "")
    // "um reino de Ravenloft" perde só a filiação, não o reino
    .replace(/\breino de Ravenloft\b/gi, "reino")
    .replace(/,\s*Ravenloft\s*,/gi, ", ")
    .replace(/\bRavenloft\s*,\s*/gi, "")
    .replace(/,?\s*\bRavenloft\b/gi, "")
    // Pontuação órfã deixada pelas remoções — e só ela.
    //
    // Nada aqui pode tocar em quebra de linha: os dois campos são markdown, e
    // um `\s{2,}` ingênuo colapsava os parágrafos junto com os espaços. Numa
    // passagem de teste isso levou a Bíblia do Mestre de treze parágrafos para
    // cinco. Por isso as classes são `[^\S\n]`, que é espaço menos newline.
    .replace(/[^\S\n]+,/g, ",")
    .replace(/,[^\S\n]*,/g, ",")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+\./g, ".")
    .replace(/\.[^\S\n]*\./g, ".")
    .trim();
}

function excerpt(text, needle) {
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i === -1) return null;
  return text.slice(Math.max(0, i - 70), i + 90).replace(/\n/g, " ");
}

async function main() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId) },
  }));

  const planned = [];
  for (const item of res.Items ?? []) {
    const target = TARGETS.find((t) => String(item.SK).startsWith(t.skPrefix));
    if (!target) continue;

    for (const field of target.fields) {
      const before = item[field];
      if (typeof before !== "string") continue;
      if (!/Ravenloft|Inverno dos Mortos/i.test(before)) continue;

      const after = clean(before);
      planned.push({ sk: item.SK, field, before, after });
      console.log(`\n${item.SK} · ${field}`);
      for (const name of ["Ravenloft", "Inverno dos Mortos"]) {
        const e = excerpt(before, name);
        if (e) console.log(`  antes:  …${e}…`);
      }
      console.log(`  depois: …${after.slice(0, 160).replace(/\n/g, " ")}…`);
      console.log(`  ${before.length} -> ${after.length} chars`);
    }
  }

  if (planned.length === 0) {
    console.log("Nada a fazer: nenhum registro cita os nomes antigos.");
    return;
  }

  console.log(`\n${planned.length} campo(s) a atualizar.`);
  if (!confirm) {
    console.log("Rode com --confirm para gravar.");
    return;
  }

  for (const { sk, field, after } of planned) {
    await doc.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: campaignPk(campaignId), SK: sk },
      UpdateExpression: "SET #f = :v",
      ExpressionAttributeNames: { "#f": field },
      ExpressionAttributeValues: { ":v": after },
    }));
    console.log(`  gravado: ${sk} · ${field}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
