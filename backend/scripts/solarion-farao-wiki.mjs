/**
 * Põe o Faraó no lugar de Lady Samira no verbete de Solarion.
 *
 * A Enciclopédia ainda descrevia a Solarion inventada na semeadura — governada
 * por Lady Samira, com a Comandante Zahra al-Nur à frente das caravanas. A Casa
 * tem jogador, e o cânone que ele propôs e o Mestre aprovou diz outra coisa:
 * quem governa é o Faraó Gloriandur, e quem comanda as forças é o General
 * Atherion. Zahra sai porque o posto dela agora tem dono.
 *
 * O verbete vive no DynamoDB, não no código: `defaultWiki.ts` é a semente, mas
 * o corpo publicado já foi reescrito por rewrite-house-wiki.mjs e ganhou o
 * Dossiê e o bloco de quem responde pela Casa. Por isso a troca é cirúrgica em
 * cima do texto publicado, e não uma reescrita do verbete inteiro.
 *
 * Roda em seco por padrão. Com --confirm, grava e guarda o corpo anterior em
 * backups/wiki/solarion-farao/.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LEADER_PERSONAS } from "../../shared/dist/index.js";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;
const SK = "WIKI#casas-003-casa-solarion-os-olhos-do-meio-dia";

/** Os três itens que a semeadura escreveu e que o cânone do jogador substitui. */
export const ELENCO_ANTIGO = [
  "- **Lady Samira Solarion:** governante de Sahra-Lun. Diplomática, orgulhosa e consciente de que a Casa não pode esconder seu passado para sempre.",
  "- **All Marifh:** conselheiro quase inteiramente dedicado ao estudo. Foi enviado a Asterhall para exigir provas.",
  "- **Comandante Zahra al-Nur:** protetora das caravanas e das torres de poço.",
].join("\n");

/** O elenco que o Mestre aprovou, na ordem em que a corte se apresenta. */
export const ELENCO_NOVO = [
  "- **Faraó Gloriandur:** soberano de Solarion. Herdou o trono de um pai conquistador e governa sob a promessa de não repetir esse caminho.",
  "- **Princesa Akumon:** herdeira e conselheira do Faraó. Decidida e pragmática, negocia partindo da certeza de que os outros reinos precisam mais de Solarion do que Solarion deles.",
  "- **Príncipe Mithrakar:** comanda os Miragens, a tropa pessoal do Faraó. Aprendeu o ofício entre veteranos, não na corte.",
  "- **General Atherion, a Lâmina do Faraó:** responde por todas as forças do reino. Quando deixa o palácio rumo ao deserto, o exército já entende o que vem.",
  "- **All Marifh:** conselheiro e amigo pessoal do Faraó. Defende que o conhecimento serve para aproximar povos e prega a abertura de Solarion ao mundo.",
].join("\n");

/**
 * O bloco de quem responde pela Casa, no mesmo formato que
 * rewrite-house-wiki.mjs escreve — para que uma nova geração não brigue com
 * este texto.
 */
export function blocoDoLider(persona) {
  return `## Quem responde pela Casa\n\n**${persona.leaderName}**, ${persona.title}. ${persona.temperament}\n\n- **Recusa:** ${persona.refuses}`;
}

/**
 * Devolve o corpo já com o Faraó no lugar da Lady, ou o mesmo corpo se não
 * houver nada a fazer. Idempotente: rodar duas vezes não muda nada na segunda.
 */
export function trocarPeloFarao(body, persona) {
  let novo = body;

  if (novo.includes(ELENCO_ANTIGO)) {
    novo = novo.replace(ELENCO_ANTIGO, ELENCO_NOVO);
  } else if (!novo.includes(ELENCO_NOVO)) {
    throw new Error("O verbete não traz nem o elenco antigo nem o novo; o texto publicado mudou de forma.");
  }

  const i = novo.indexOf("## Quem responde pela Casa");
  if (i === -1) throw new Error("O verbete não traz o bloco de quem responde pela Casa.");
  novo = novo.slice(0, i) + blocoDoLider(persona);

  return novo;
}

async function main() {
  const gravar = process.argv.includes("--confirm");
  const persona = LEADER_PERSONAS["casa-solarion"];
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const { Item } = await doc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK } }));
  if (!Item) throw new Error(`Verbete ${SK} não encontrado em ${TABLE_NAME}.`);

  const novo = trocarPeloFarao(Item.body, persona);
  if (novo === Item.body) {
    console.log("Nada a alterar: o verbete já está com o Faraó.");
    return;
  }

  console.log(`Verbete: ${Item.title}`);
  console.log(`Corpo: ${Item.body.length} -> ${novo.length} caracteres.`);
  console.log(`Líder: ${persona.leaderName}, ${persona.title}.`);

  if (!gravar) {
    console.log("\nEnsaio. Rode com --confirm para gravar.");
    return;
  }

  const dir = new URL("../../backups/wiki/solarion-farao/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL("casa-solarion.md", dir), Item.body);

  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { ...Item, body: novo, updatedAt: new Date().toISOString() },
  }));
  console.log("Gravado. Corpo anterior em backups/wiki/solarion-farao/casa-solarion.md.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
