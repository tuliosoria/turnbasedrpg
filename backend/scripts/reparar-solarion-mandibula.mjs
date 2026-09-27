import { pathToFileURL } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const LETTER_REPAIRS = Object.freeze([
  Object.freeze({
    id: "mu7bh7vm-ryesl2",
    oldText: "Thorgul Crânio Cinzento caiu",
    newText: "vimos nossos mortos engrossarem a fileira inimiga",
  }),
  Object.freeze({
    id: "mua8jyze-4ykmgk",
    oldText: "Depois de Thorgul cair",
    newText: "Depois de vermos nossos mortos se levantarem",
  }),
]);

export const OLD_FACT_ID = "mu7bh7vv-ywo3lm";
export const KEEPER_FACT_ID = "mua8uzjq-buoc2p";

const PLAYER_HOUSE_ID = "solarion-k0hc";
const NPC_HOUSE_KEY = "cla-mandibula-de-osso";
const TURN_NUMBER = 10;
const PK = "CAMPAIGN#WINTER_DEAD";
const TABLE_NAME = process.env.TABLE_NAME ?? "ravenloft-game";
const REGION = process.env.AWS_REGION ?? "us-east-1";

function requirePair(a, b, id) {
  const pair = new Set([a, b]);
  if (!pair.has(PLAYER_HOUSE_ID) || !pair.has(NPC_HOUSE_KEY) || pair.size !== 2) {
    throw new Error(`${id}: par diplomático inesperado`);
  }
}

function requireKeys(item) {
  if (typeof item.PK !== "string" || typeof item.SK !== "string") {
    throw new Error(`${item.id ?? "registro"}: chave PK/SK ausente`);
  }
}

export function corrigirCarta(item) {
  const repair = LETTER_REPAIRS.find((candidate) => candidate.id === item?.id);
  if (!repair) throw new Error(`${item?.id ?? "carta"}: id fora da lista fechada`);
  requireKeys(item);
  if (item.author !== "AI") throw new Error(`${item.id}: esperado autor IA`);
  if (item.turnNumber !== TURN_NUMBER) throw new Error(`${item.id}: turno inesperado`);
  requirePair(item.fromHouseId, item.toHouseKey, item.id);
  if (typeof item.body !== "string") throw new Error(`${item.id}: corpo ausente`);

  const hasOld = item.body.includes(repair.oldText);
  const hasNew = item.body.includes(repair.newText);
  if (hasOld === hasNew) throw new Error(`${item.id}: estado inesperado da carta`);
  if (hasNew) return { state: "unchanged", before: item, after: item };

  return {
    state: "update",
    before: item,
    after: { ...item, body: item.body.replace(repair.oldText, repair.newText) },
  };
}

export function corrigirFato(item) {
  if (item?.id !== OLD_FACT_ID) {
    throw new Error(`${item?.id ?? "fato"}: id de fato inesperado`);
  }
  requireKeys(item);
  requirePair(item.betweenA, item.betweenB, item.id);
  if (item.turnNumber !== TURN_NUMBER) throw new Error(`${item.id}: turno inesperado`);
  if (item.kind !== "ACORDO") throw new Error(`${item.id}: tipo de fato inesperado`);
  if (item.status === "REVOGADO") {
    return { state: "unchanged", before: item, after: item };
  }
  if (item.status !== "ATIVO") throw new Error(`${item.id}: estado inesperado do fato`);
  return {
    state: "update",
    before: item,
    after: { ...item, status: "REVOGADO" },
  };
}

function findExactlyOne(items, id) {
  const found = items.filter((item) => item?.id === id);
  if (found.length !== 1) {
    throw new Error(`${id}: esperado exatamente um registro, encontrados ${found.length}`);
  }
  return found[0];
}

function validateKeeper(item) {
  requireKeys(item);
  requirePair(item.betweenA, item.betweenB, item.id);
  if (item.turnNumber !== TURN_NUMBER) throw new Error(`${item.id}: turno inesperado`);
  if (item.kind !== "ACORDO") throw new Error(`${item.id}: tipo de fato inesperado`);
  if (item.status !== "ATIVO") throw new Error(`${item.id}: acordo mantido não está ATIVO`);
}

export function planejarReparo(items) {
  const first = findExactlyOne(items, LETTER_REPAIRS[0].id);
  const second = findExactlyOne(items, LETTER_REPAIRS[1].id);
  const oldFact = findExactlyOne(items, OLD_FACT_ID);
  const keeper = findExactlyOne(items, KEEPER_FACT_ID);

  const letterResults = [corrigirCarta(first), corrigirCarta(second)];
  const factResult = corrigirFato(oldFact);
  validateKeeper(keeper);

  const updates = [];
  const unchanged = [KEEPER_FACT_ID];
  for (const result of letterResults) {
    if (result.state === "unchanged") {
      unchanged.push(result.before.id);
      continue;
    }
    updates.push({
      type: "letter",
      id: result.before.id,
      key: { PK: result.before.PK, SK: result.before.SK },
      oldBody: result.before.body,
      newBody: result.after.body,
    });
  }

  if (factResult.state === "unchanged") {
    unchanged.push(factResult.before.id);
  } else {
    updates.push({
      type: "fact",
      id: factResult.before.id,
      key: { PK: factResult.before.PK, SK: factResult.before.SK },
      oldStatus: "ATIVO",
      newStatus: "REVOGADO",
    });
  }

  return { updates, unchanged };
}

async function queryPrefix(doc, prefix) {
  const items = [];
  let cursor;
  do {
    const result = await doc.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": PK, ":sk": prefix },
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }));
    items.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}

function printPlan(plan) {
  console.log(`Reparo Solarion × Mandíbula em ${TABLE_NAME}`);
  for (const update of plan.updates) {
    if (update.type === "letter") {
      console.log(`UPDATE carta ${update.id}: premissa falsa será substituída`);
    } else {
      console.log(`UPDATE fato ${update.id}: ${update.oldStatus} -> ${update.newStatus}`);
    }
  }
  for (const id of plan.unchanged) console.log(`UNCHANGED ${id}`);
}

export async function main(argv = process.argv.slice(2)) {
  const confirm = argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const [letters, facts] = await Promise.all([
    queryPrefix(doc, "DIPLMSG#"),
    queryPrefix(doc, "CFACT#"),
  ]);
  const plan = planejarReparo([...letters, ...facts]);
  printPlan(plan);

  if (!confirm) {
    console.log("DRY-RUN: nenhum dado foi escrito. Use --confirm somente após revisar este plano.");
    return plan;
  }

  for (const update of plan.updates) {
    if (update.type === "letter") {
      await doc.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: update.key,
        UpdateExpression: "SET body = :newBody, rewrittenAt = :now",
        ConditionExpression: "body = :oldBody AND author = :ai",
        ExpressionAttributeValues: {
          ":newBody": update.newBody,
          ":oldBody": update.oldBody,
          ":now": new Date().toISOString(),
          ":ai": "AI",
        },
      }));
    } else {
      await doc.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: update.key,
        UpdateExpression: "SET #status = :newStatus",
        ConditionExpression: "#status = :oldStatus",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":newStatus": update.newStatus,
          ":oldStatus": update.oldStatus,
        },
      }));
    }
    console.log(`WRITTEN ${update.type} ${update.id}`);
  }
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
