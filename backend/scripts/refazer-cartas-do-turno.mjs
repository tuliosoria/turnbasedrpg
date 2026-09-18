import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { makeDocClient } from "../src/db/dynamo";
import { makeChatFn } from "../src/ai/openai";
import { listAllMessages, deleteMessage } from "../src/db/diplomacy/messages";
import { getActiveTurn, getTurn } from "../src/db/turns";
import { enviarCartasDoMundo } from "../src/diplomacy/cartasDoMundo";
import { triarCartasDoTurno } from "../src/diplomacy/refazerCartas";

/**
 * Apaga as cartas que o mundo escreveu num turno e manda o mundo escrever de
 * novo — três por Casa de jogador, pelo pipeline de verdade.
 *
 * Existe porque corrigir o planejador e os prompts não mexe no que já está
 * gravado: o jogador continua vendo a carta velha até alguém trocá-la.
 *
 * Diferente da reescrita de UMA carta, aqui não dá para gravar antes de
 * apagar. O gerador pula todo par que já tem conversa viva no turno, então as
 * cartas velhas bloqueariam as novas. A ordem é apagar e gerar — e por isso o
 * script grava um backup em JSON de tudo que apaga, antes de apagar.
 *
 * Nunca toca em carta de jogador, em carta escrita à mão pelo Mestre (`gm-`),
 * nem em carta do mundo que o jogador já respondeu: quem decide isso é
 * `triarCartasDoTurno`, que é testado.
 *
 *   node <bundle>                      # mostra o que faria, sem gravar
 *   node <bundle> --turno 10           # escolhe o turno (padrão: o ativo)
 *   node <bundle> --confirm            # apaga, regenera e relê do banco
 *
 * A chave da OpenAI vem da configuração da Lambda, em memória — nunca de
 * arquivo e nunca de commit:
 *
 *   FN=$(aws lambda list-functions --region us-east-1 \
 *     --query "Functions[?starts_with(FunctionName,'ravenloft-winter-ApiFunction')].FunctionName" --output text)
 *   eval "$(aws lambda get-function-configuration --region us-east-1 --function-name $FN \
 *     --query "Environment.Variables" --output json | python3 -c '
 *   import json,sys
 *   v=json.load(sys.stdin)
 *   for k in ("OPENAI_API_KEY","OPENAI_DIPLOMACY_MODEL"):
 *       if v.get(k): print(f"export {k}={json.dumps(v[k])}")')"
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const model = process.env.OPENAI_DIPLOMACY_MODEL || "gpt-5.5";

const confirm = process.argv.includes("--confirm");
const turnoArg = process.argv.indexOf("--turno");
const turnoPedido = turnoArg >= 0 ? Number(process.argv[turnoArg + 1]) : null;

const doc = makeDocClient(region);
const config = { tableName, campaignId };

function resumo(c) {
  const corpo = c.body.replace(/\s+/g, " ").trim();
  return `[${c.id}] ${c.fromHouseId} <- ${c.toHouseKey}: ${corpo.slice(0, 110)}${corpo.length > 110 ? "…" : ""}`;
}

async function main() {
  const turno = turnoPedido
    ? await getTurn(doc, tableName, campaignId, turnoPedido)
    : await getActiveTurn(doc, tableName, campaignId);
  if (!turno) throw new Error(`Turno não encontrado (${turnoPedido ?? "ativo"}).`);

  const { refazer, mantidas } = triarCartasDoTurno(
    await listAllMessages(doc, tableName, campaignId),
    turno.turnId,
  );

  console.log(`\n=== Turno ${turno.turnId} (${turno.status}) ===`);
  console.log(`\n--- A APAGAR E REFAZER (${refazer.length}) ---`);
  for (const c of refazer) console.log("  " + resumo(c));
  console.log(`\n--- FICAM COMO ESTÃO (${mantidas.length}) ---`);
  for (const { carta, motivo } of mantidas) console.log(`  ${resumo(carta)}\n      motivo: ${motivo}`);

  if (!confirm) {
    console.log("\nRode com --confirm para apagar, regerar e conferir no banco.");
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Sem OPENAI_API_KEY: abortando ANTES de apagar. Uma carta ruim é melhor que nenhuma.");
  }

  // O backup é o que torna o apagar reversível. Vai para disco antes de
  // qualquer DeleteCommand, e o script para se não conseguir escrevê-lo.
  const arquivo = resolve(
    process.cwd(),
    `../backups/cartas/turno-${turno.turnId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, JSON.stringify(refazer, null, 2));
  console.log(`\nbackup: ${arquivo}`);

  for (const c of refazer) {
    await deleteMessage(doc, tableName, campaignId, c);
    console.log(`  apagada: ${c.id}`);
  }

  const chatDiplomacia = makeChatFn(process.env.OPENAI_API_KEY, model, "high");
  const n = await enviarCartasDoMundo({ doc, config, chatDiplomacia }, turno.turnId, turno.publicEvent ?? "");
  console.log(`\ncartas escritas: ${n}`);

  // Reler do banco, e não relatar o que foi gerado. Mostrar um bom rascunho e
  // deixar o ruim gravado já aconteceu duas vezes nesta campanha.
  const depois = (await listAllMessages(doc, tableName, campaignId)).filter((m) => m.turnNumber === turno.turnId);
  console.log(`\n=== O QUE ESTÁ NO BANCO AGORA (${depois.length} no turno) ===`);
  for (const c of depois) console.log(`\n  ${resumo(c)}`);

  const porJogador = new Map();
  for (const c of depois.filter((m) => m.author === "AI")) {
    porJogador.set(c.fromHouseId, (porJogador.get(c.fromHouseId) ?? 0) + 1);
  }
  console.log("\ncartas de IA por Casa de jogador:");
  for (const [houseId, total] of porJogador) console.log(`  ${houseId}: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
