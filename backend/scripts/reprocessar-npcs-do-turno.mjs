import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SEATS } from "@ravenloft/content";
import { makeDocClient } from "../src/db/dynamo";
import { makeChatFn } from "../src/ai/openai";
import { getTurn } from "../src/db/turns";
import { listHouses } from "../src/db/houses";
import { listAllMessages } from "../src/db/diplomacy/messages";
import { getNpcDynamic, putNpcDynamic, listNpcDynamics } from "../src/db/npcDynamic";
import { updateNpcWorld } from "../src/ai/npc/worldUpdate";

/**
 * Roda de novo SÓ o Relationship Engine de um turno já aplicado.
 *
 * Existe porque, nos turnos 9 e 10, um campo com tipo errado vindo do modelo
 * abortou o motor no meio: os NPCs depois daquele nunca receberam a reação ao
 * turno. Reaplicar o aftermath inteiro reescreveria também os fatos do turno;
 * aqui só o motor de NPCs roda, com os mesmos insumos que o aftermath usa.
 *
 * Idempotente: `updateNpcWorld` pula todo NPC que já tem memória do turno.
 * Antes de gravar, faz backup de todos os estados vivos em JSON.
 *
 *   node <bundle> --turno 10            # mostra quem já reagiu, sem gravar
 *   node <bundle> --turno 10 --confirm  # roda o motor e grava
 *
 * A chave da OpenAI vem da configuração da Lambda, em memória — nunca de
 * arquivo e nunca de commit (mesma receita de refazer-cartas-do-turno.mjs,
 * exportando OPENAI_API_KEY e OPENAI_MODEL).
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const confirm = process.argv.includes("--confirm");
const turnoArg = process.argv.indexOf("--turno");
const turnId = turnoArg >= 0 ? Number(process.argv[turnoArg + 1]) : NaN;

const doc = makeDocClient(region);

function contagem(rows) {
  return rows.filter((d) => d.memory.some((m) => m.turnNumber === turnId)).length;
}

async function main() {
  if (!Number.isInteger(turnId) || turnId <= 0) throw new Error("Informe --turno N.");
  const turn = await getTurn(doc, tableName, campaignId, turnId);
  if (!turn?.result) throw new Error(`Turno ${turnId} não tem resolução gravada.`);

  const antes = await listNpcDynamics(doc, tableName, campaignId);
  console.log(`Turno ${turnId}: ${contagem(antes)} de ${antes.length} estados vivos já têm memória deste turno.`);
  if (!confirm) {
    console.log("Nada gravado. Rode com --confirm para processar os que faltam.");
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente.");

  const backup = resolve(`backups/npcdyn/antes-turno-${turnId}-${Date.now()}.json`);
  mkdirSync(dirname(backup), { recursive: true });
  writeFileSync(backup, JSON.stringify(antes, null, 2));
  console.log(`Backup: ${backup}`);

  const houses = await listHouses(doc, tableName, campaignId);
  const keyByHouseId = new Map(houses.map((h) => [h.houseId, SEATS.find((s) => s.name === h.name)?.key ?? null]));

  const res = await updateNpcWorld(
    {
      chat: makeChatFn(process.env.OPENAI_API_KEY, model),
      getDynamic: (aff, id) => getNpcDynamic(doc, tableName, campaignId, aff, id),
      putDynamic: (d) => putNpcDynamic(doc, tableName, campaignId, d),
      houseKeyOf: (hid) => keyByHouseId.get(hid) ?? null,
      // O mesmo recorte do aftermath: quem os jogadores procuraram vem antes.
      recentlyContacted: async () => {
        const msgs = await listAllMessages(doc, tableName, campaignId);
        return new Set(msgs.filter((m) => m.turnNumber >= turnId - 1 && m.toCharacterId).map((m) => `${m.toHouseKey}:${m.toCharacterId}`));
      },
      lastTouched: async () => {
        const rows = await listNpcDynamics(doc, tableName, campaignId);
        return new Map(rows.map((d) => [`${d.affiliation}:${d.id}`, d.memory.reduce((max, m) => Math.max(max, m.turnNumber), 0)]));
      },
    },
    { ...turn, status: "RESOLVED" },
  );

  const depois = await listNpcDynamics(doc, tableName, campaignId);
  console.log(`Motor: ${res.candidates} candidatos, ${res.changed} mudaram, ${res.vazias} sem resposta do modelo.`);
  console.log(`Agora ${contagem(depois)} de ${depois.length} estados vivos têm memória do turno ${turnId}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
