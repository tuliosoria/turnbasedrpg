import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Reescreve as duas respostas de IA enviadas à Casa Solarion no Turno 4.
 *
 * As personas de Euralune e Karasoy estavam erradas: Euralune respondia com o
 * vocabulário de escravidão que pertence aos orcs, e Karasoy soava leal demais
 * à Coroa para uma Casa que acabara de perder a rainha e ver exércitos irem à
 * capital. As personas já foram corrigidas em shared; aqui as cartas que já
 * haviam sido geradas com as personas velhas são substituídas para bater com
 * as novas. O jogador de Solarion será avisado do bug.
 *
 * Casa uma resposta por chave de mensagem — mexe só nestas duas, e mostra o
 * antes e o depois antes de gravar.
 *
 *   node scripts/rewrite-solarion-replies.mjs            # mostra
 *   node scripts/rewrite-solarion-replies.mjs --confirm  # grava
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

/** Identifica cada resposta pela Casa que responde + autor IA, não pela SK
 * inteira, que carrega um sufixo aleatório. */
const REWRITES = [
  {
    match: (m) => m.author === "AI" && String(m.SK).includes("~casa-euralune"),
    label: "Euralune → Solarion",
    body: [
      "À Casa Solarion,",
      "",
      "Recebemos sua proposta e reparamos na palavra que a senhora fez questão de descartar: submissão. Quem jura não pedi-la costuma tê-la pensado primeiro. Ainda assim, Ninho Alto não responde com ofensa — responde com a cautela que a altura ensina.",
      "",
      "A troca em si nos interessa, e não por cortesia. Poucos entendem que o que vendemos não é mitril nem lanças, mas distância: aquilo que se enxerga antes dos outros. Óptica, sinais e a paciência de quem lê o céu combinam bem com o que guardamos nos penhascos.",
      "",
      "O que não nos serve é a forma. Uma presença permanente em terra de Solarion, sob água, alimento e proteção de Solarion, não é parceria entre iguais — é o começo de uma coleira, por mais macio que seja o couro. O Pacto das Alturas ensina que a ave escolhe quem a monta, nunca o contrário; uma Casa não é diferente. Aliança se aceita, posse não.",
      "",
      "Se há algo a construir, que se construa no meio do caminho, em chão de ninguém, com os dois lados livres para se levantar e partir. Vigias por grão, sinais por sal, sem que nenhum de nós vire dono do outro.",
      "",
      "Nesses termos, o vento sopra a favor.",
      "",
      "— Lorde Brannic Euralune, Senhor dos Ventos",
    ].join("\n"),
  },
  {
    match: (m) => m.author === "AI" && String(m.SK).includes("~casa-karasoy"),
    label: "Karasoy → Solarion",
    body: [
      "À Casa Solarion,",
      "",
      "Sua carta chegou enquanto a sombra de Aylin ainda cobre nossos salões, e as palavras de All Marifh foram recebidas como se recebe água no deserto: sem cerimônia, com gratidão. Poucos escreveram para lamentar; a maioria escreveu para pedir. Karasoy lembra a diferença.",
      "",
      "Aceitamos a passagem e o oásis do Sol de bom grado. Entre nossas Casas há uma fronteira que pode ser ferida ou porta — preferimos porta, e a de vocês se abriu na hora certa. Uma herdeira não esquece quem a tratou como igual antes de ela ter provado que merecia.",
      "",
      "Quanto à defesa do reino, seremos francas, porque o luto nos tirou o gosto por meias-palavras. Mandaremos força a Asterhall, porque os mortos que avançam não perguntam de quem é a coroa. Mas Karasoy já sangrou, já viu exércitos marcharem sobre a capital, e não confunde mais uma convocação real com um presente. Cada lança que enviamos, enviamos contando — e esperando saber o que o trono devolve por ela.",
      "",
      "Honramos Valdren. Honramos primeiro nossas mães e o que resta do nosso povo. Que Solarion compreenda a ordem dessas duas coisas, e terá uma amiga verdadeira nas Planícies da Estrela.",
      "",
      "Pela memória de Aylin,",
      "Casa Karasoy",
    ].join("\n"),
  },
];

async function main() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "DIPLMSG" },
  }));
  const msgs = res.Items ?? [];

  const plan = [];
  for (const rw of REWRITES) {
    const found = msgs.filter(rw.match);
    if (found.length !== 1) {
      throw new Error(`${rw.label}: esperava 1 mensagem, achei ${found.length}. Abortando sem gravar.`);
    }
    plan.push({ item: found[0], ...rw });
  }

  for (const { item, label, body } of plan) {
    console.log(`\n===== ${label} =====`);
    console.log(`SK: ${item.SK}`);
    console.log(`\n--- ANTES ---\n${item.body}`);
    console.log(`\n--- DEPOIS ---\n${body}`);
  }

  if (!confirm) {
    console.log("\nRode com --confirm para gravar.");
    return;
  }

  for (const { item, label, body } of plan) {
    await doc.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression: "SET body = :b, rewrittenAt = :t",
      ExpressionAttributeValues: { ":b": body, ":t": new Date().toISOString() },
    }));
    console.log(`  gravado: ${label}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
