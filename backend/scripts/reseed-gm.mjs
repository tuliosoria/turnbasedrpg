/**
 * Reconcilia a Bíblia do Mestre (verbetes `GM#`) com a semente do código.
 *
 * `seedDefaultGm` só semeia quando a tabela está vazia (backend/src/db/gm.ts),
 * então quando `shared/src/defaultGm.ts` foi corrigido para chamar o
 * antagonista de "Rei Branco" — o nome canônico em
 * valdren-context/MESTRE/15_SEGREDOS_CENTRAIS_E_CONSPIRACAO_DE_ASTERHALL.md —
 * o banco em produção ficou preso no nome de trabalho antigo, "Rei Pálido".
 *
 * A troca não é "apagar e semear de novo": um verbete foi escrito pelo autor
 * direto no banco (`GM#vortice-branco`, sobre o Vórtice Branco) e não existe
 * na semente. Ele precisa sobreviver intacto. Por isso a reconciliação casa
 * verbete vivo com verbete da semente pelo TÍTULO e, quando o título mudou
 * (o caso do Rei Pálido → Rei Branco), pela combinação seção+ordem — nunca
 * apaga um verbete vivo só porque a semente não tem título igual.
 *
 * A troca esperada já foi diagnosticada byte a byte antes deste script
 * existir: 15 verbetes idênticos, 4 com o corpo desatualizado, 1 renomeado, 1
 * só do autor. `checarExpectativa` compara o plano contra esse diagnóstico e
 * recusa `--confirm` se o banco tiver mudado desde então — nesse caso alguém
 * precisa olhar antes de qualquer escrita.
 *
 *   node scripts/reseed-gm.mjs             # mostra o plano, não grava nada
 *   node scripts/reseed-gm.mjs --confirm   # faz backup e grava
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { DEFAULT_GM_ENTRIES } from "../../shared/dist/defaultGm.js";

const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const REGION = process.env.AWS_REGION || "us-east-1";
const CONFIRM = process.argv.includes("--confirm");
const BACKUP_DIR = new URL("../../backups/gm/", import.meta.url);

const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const gmSk = (entryId) => `GM#${entryId}`;

/**
 * O diagnóstico exato, feito antes de este script existir, comparando os 20
 * verbetes da semente com os 21 verbetes então vivos no banco. Serve de
 * expectativa para `checarExpectativa`: se o banco tiver mudado desde então,
 * o plano calculado agora não vai bater com isto, e `--confirm` é recusado.
 */
export const EXPECTATIVA = {
  totalSemente: 20,
  totalVivo: 21,
  naoAlterados: 15,
  corpoAtualizado: [
    "Fase 2: O exército que se lembra",
    "Valdren está presa",
    "A verdade sobre o Inverno das Cinzas",
    "A pergunta central da campanha",
  ].sort(),
  renomeado: { de: "Quem é o Rei Pálido", para: "Quem é o Rei Branco" },
  somenteAutor: ["vortice-branco"],
  sementeSemPar: [],
};

/**
 * Casa cada verbete da semente com um verbete vivo e classifica a ação.
 *
 * Duas passadas: primeiro por TÍTULO igual (a maioria dos casos). O que
 * sobra é casado por seção+ordem — é assim que "Quem é o Rei Pálido" (seção
 * a-verdade, ordem 1) encontra o lugar de "Quem é o Rei Branco" na semente
 * (mesma seção, mesma ordem) sem que o título precise coincidir.
 *
 * O que sobra vivo depois das duas passadas nunca é tocado: é conteúdo que a
 * semente não conhece, escrito direto no banco, e a ação é "somente-autor".
 *
 * Não recebe nada do AWS SDK — só arrays simples — para ser testável sem rede.
 */
export function reconciliar(itensVivos, entradasSemente) {
  const vivoPorTitulo = new Map(itensVivos.map((it) => [it.title, it]));
  const casados = new Set();
  const plano = [];
  const sementeSemPar = [];

  const pendentes = [];
  for (const semente of entradasSemente) {
    const vivo = vivoPorTitulo.get(semente.title);
    if (vivo) {
      casados.add(vivo.entryId);
      plano.push(classificar(vivo, semente, "titulo"));
    } else {
      pendentes.push(semente);
    }
  }

  for (const semente of pendentes) {
    const vivo = itensVivos.find(
      (it) => !casados.has(it.entryId) && it.section === semente.section && it.order === semente.order,
    );
    if (vivo) {
      casados.add(vivo.entryId);
      plano.push(classificar(vivo, semente, "secao-ordem"));
    } else {
      sementeSemPar.push(semente.title);
    }
  }

  for (const vivo of itensVivos) {
    if (!casados.has(vivo.entryId)) {
      plano.push({ acao: "somente-autor", entryId: vivo.entryId, tituloVivo: vivo.title });
    }
  }

  return { plano, sementeSemPar };
}

function classificar(vivo, semente, comoAchou) {
  const tituloMudou = vivo.title !== semente.title;
  const corpoIgual =
    vivo.body === semente.body && vivo.section === semente.section && vivo.order === semente.order && !tituloMudou;

  if (corpoIgual) {
    return { acao: "sem-alteracao", entryId: vivo.entryId, tituloVivo: vivo.title, comoAchou };
  }
  return {
    acao: tituloMudou ? "renomeado" : "corpo-atualizado",
    entryId: vivo.entryId,
    tituloVivo: vivo.title,
    tituloNovo: semente.title,
    section: semente.section,
    title: semente.title,
    body: semente.body,
    order: semente.order,
    comoAchou,
  };
}

/** Resume o plano em contagens, para imprimir e para comparar com EXPECTATIVA. */
export function resumirPlano(plano) {
  const porAcao = { "sem-alteracao": [], "corpo-atualizado": [], renomeado: [], "somente-autor": [] };
  for (const item of plano) porAcao[item.acao].push(item);
  return porAcao;
}

/**
 * Compara o plano recém-calculado com o diagnóstico conhecido (EXPECTATIVA).
 * Devolve { ok: true } só se baterem exatamente — mesma contagem de cada
 * ação, mesmos títulos alterados, mesma renomeação, mesmo verbete só-do-autor
 * e nenhum verbete da semente sem par vivo. Qualquer divergência vira um
 * motivo em `motivos`, para imprimir e recusar `--confirm`.
 */
export function checarExpectativa(plano, sementeSemPar, entradasSemente, itensVivos) {
  const porAcao = resumirPlano(plano);
  const motivos = [];

  if (entradasSemente.length !== EXPECTATIVA.totalSemente) {
    motivos.push(`semente tem ${entradasSemente.length} verbetes, esperado ${EXPECTATIVA.totalSemente}`);
  }
  if (itensVivos.length !== EXPECTATIVA.totalVivo) {
    motivos.push(`banco tem ${itensVivos.length} verbetes, esperado ${EXPECTATIVA.totalVivo}`);
  }
  if (porAcao["sem-alteracao"].length !== EXPECTATIVA.naoAlterados) {
    motivos.push(`${porAcao["sem-alteracao"].length} verbetes sem alteração, esperado ${EXPECTATIVA.naoAlterados}`);
  }

  const corpoTitulos = porAcao["corpo-atualizado"].map((p) => p.tituloVivo).sort();
  if (JSON.stringify(corpoTitulos) !== JSON.stringify(EXPECTATIVA.corpoAtualizado)) {
    motivos.push(
      `corpo-atualizado tem [${corpoTitulos.join(", ")}], esperado [${EXPECTATIVA.corpoAtualizado.join(", ")}]`,
    );
  }

  const renomeados = porAcao.renomeado;
  if (renomeados.length !== 1) {
    motivos.push(`${renomeados.length} verbetes renomeados, esperado 1`);
  } else if (
    renomeados[0].tituloVivo !== EXPECTATIVA.renomeado.de ||
    renomeados[0].tituloNovo !== EXPECTATIVA.renomeado.para
  ) {
    motivos.push(
      `renomeação é "${renomeados[0].tituloVivo}" -> "${renomeados[0].tituloNovo}", esperado ` +
        `"${EXPECTATIVA.renomeado.de}" -> "${EXPECTATIVA.renomeado.para}"`,
    );
  }

  const autorIds = porAcao["somente-autor"].map((p) => p.entryId).sort();
  if (JSON.stringify(autorIds) !== JSON.stringify([...EXPECTATIVA.somenteAutor].sort())) {
    motivos.push(`somente-autor tem [${autorIds.join(", ")}], esperado [${EXPECTATIVA.somenteAutor.join(", ")}]`);
  }

  if (JSON.stringify(sementeSemPar.sort()) !== JSON.stringify(EXPECTATIVA.sementeSemPar)) {
    motivos.push(`verbetes da semente sem par vivo: [${sementeSemPar.join(", ")}], esperado nenhum`);
  }

  return { ok: motivos.length === 0, motivos };
}

function imprimirPlano(plano) {
  const porAcao = resumirPlano(plano);
  const rotulo = {
    "sem-alteracao": "sem alteração",
    "corpo-atualizado": "corpo atualizado",
    renomeado: "renomeado",
    "somente-autor": "só do autor, preservado como está",
  };
  for (const acao of ["sem-alteracao", "corpo-atualizado", "renomeado", "somente-autor"]) {
    console.log(`\n${rotulo[acao]} (${porAcao[acao].length}):`);
    for (const item of porAcao[acao]) {
      if (acao === "renomeado") {
        console.log(`  "${item.tituloVivo}" -> "${item.tituloNovo}"  (GM#${item.entryId})`);
      } else if (acao === "somente-autor") {
        console.log(`  "${item.tituloVivo}"  (GM#${item.entryId})`);
      } else {
        console.log(`  "${item.tituloVivo}"  (GM#${item.entryId})`);
      }
    }
  }
}

async function listarVivos(doc) {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": campaignPk(CAMPAIGN_ID), ":sk": "GM#" },
    }),
  );
  return res.Items ?? [];
}

async function gravarBackup(itensVivos) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const arquivo = new URL(`gm-${carimbo}.json`, BACKUP_DIR);
  const bruto = { Items: itensVivos.map((it) => marshall(it, { removeUndefinedValues: true })) };
  await writeFile(arquivo, JSON.stringify(bruto, null, 2), "utf-8");
  return arquivo;
}

async function main() {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const itensVivos = await listarVivos(doc);

  console.log(`verbetes vivos: ${itensVivos.length}  |  verbetes na semente: ${DEFAULT_GM_ENTRIES.length}`);

  const arquivoBackup = await gravarBackup(itensVivos);
  console.log(`backup gravado em ${arquivoBackup.pathname}`);

  const { plano, sementeSemPar } = reconciliar(itensVivos, DEFAULT_GM_ENTRIES);
  imprimirPlano(plano);
  if (sementeSemPar.length) {
    console.log(`\nverbetes da semente sem verbete vivo correspondente (${sementeSemPar.length}):`);
    for (const t of sementeSemPar) console.log(`  "${t}"`);
  }

  const { ok, motivos } = checarExpectativa(plano, sementeSemPar, DEFAULT_GM_ENTRIES, itensVivos);

  if (!CONFIRM) {
    console.log(ok ? "\nplano bate com a expectativa diagnosticada." : "\nplano NÃO bate com a expectativa:");
    for (const m of motivos) console.log(`  - ${m}`);
    console.log("\n[dry-run] nada foi gravado. Rode com --confirm para gravar.");
    return;
  }

  if (!ok) {
    console.error("\nRECUSANDO gravar: o plano não bate com a expectativa diagnosticada.");
    for (const m of motivos) console.error(`  - ${m}`);
    console.error("\nO banco mudou desde o diagnóstico. Confira à mão antes de rodar de novo.");
    process.exitCode = 1;
    return;
  }

  const porAcao = resumirPlano(plano);
  const paraGravar = [...porAcao["corpo-atualizado"], ...porAcao.renomeado];
  const agora = new Date().toISOString();
  for (const item of paraGravar) {
    await doc.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: campaignPk(CAMPAIGN_ID),
          SK: gmSk(item.entryId),
          entryId: item.entryId,
          section: item.section,
          title: item.title,
          body: item.body,
          order: item.order,
          updatedAt: agora,
        },
      }),
    );
    console.log(`gravado: "${item.tituloVivo}"${item.acao === "renomeado" ? ` -> "${item.title}"` : ""}`);
  }
  console.log(`\n${paraGravar.length} verbetes gravados. ${porAcao["sem-alteracao"].length} deixados como estavam.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
