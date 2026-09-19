import {
  SEATS,
  type Turn,
  type WorldFact,
} from "@ravenloft/content";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ChatFn } from "../ai/openai";
import { generateJson } from "../ai/openai";
import { updateNpcWorld } from "../ai/npc/worldUpdate";
import {
  FACT_EXTRACTION_SYSTEM_PROMPT, buildFactExtractionUser, parseFacts, turnBlocks,
} from "../ai/campaign/factExtraction";
import { buildProjectCanon, buildProjectResolutionPrompt, parseProjectResolution } from "../ai/projectPrompts";
import type { Config } from "../types/domain";
import { getHouse, listHouses, updateHouseAttributes, updateHouseStabilityAndAssets } from "../db/houses";
import { listCampaignProjects, putProject, putFavor } from "../db/projects";
import { getAlocacaoEnergia } from "../db/energia";
import { listWikiEntries } from "../db/wiki";
import { listAllMessages } from "../db/diplomacy/messages";
import { deleteWorldFactsOfTurn, putWorldFact } from "../db/worldFacts";
import { getNpcDynamic, putNpcDynamic, listNpcDynamics } from "../db/npcDynamic";
import { processProjectsForTurn } from "../projects/processTurn";

/**
 * O que sobra depois da resolução já estar gravada: juiz de carta, registro
 * de fatos, Relationship Engine.
 *
 * Cada um é IA longa. No gateway isso empilhava depois do persist e estourava
 * os 30s. O worker recebe este pedido; a rota só dispara e devolve.
 */
export interface PedidoDeResolucao {
  turnId: number;
  publicEvent: string;
  privateInfo: Record<string, string>;
  publicResult: string;
  houseResults: Record<string, string>;
  discoveries?: string[];
}

export interface AftermathDeps {
  doc: DynamoDBDocumentClient;
  config: Config;
  chat?: ChatFn;
}

export async function runResolutionAftermath(deps: AftermathDeps, pedido: PedidoDeResolucao): Promise<void> {
  const { tableName, campaignId } = deps.config;
  const chat = deps.chat;
  const canon = chat ? buildProjectCanon(await listWikiEntries(deps.doc, tableName, campaignId)) : "";
  await processProjectsForTurn(
    {
      listCampaignProjects: (c) => listCampaignProjects(deps.doc, tableName, c),
      getHouse: (h) => getHouse(deps.doc, tableName, campaignId, h),
      putProject: (p) => putProject(deps.doc, tableName, campaignId, p),
      updateHouseAttributes: (h, a, motivo) => updateHouseAttributes(deps.doc, tableName, campaignId, h, a, motivo),
      updateHouseStabilityAndAssets: (h, s, assets) => updateHouseStabilityAndAssets(deps.doc, tableName, campaignId, h, s, assets),
      putFavor: (f) => putFavor(deps.doc, tableName, campaignId, f),
      getAlocacaoEnergia: (h, t) => getAlocacaoEnergia(deps.doc, tableName, campaignId, t, h),
      judgeOutcome: chat
        ? async (project, house) => {
            const { system, user } = buildProjectResolutionPrompt(house, project, pedido.publicResult, canon);
            // Os riscos da própria carta viajam até o parser: é lá que se
            // confere se o fracasso apontado tem de onde vir.
            return generateJson(chat, system, user, (raw) => parseProjectResolution(raw, project.risks ?? []), 2, 900);
          }
        : undefined,
    },
    campaignId,
    pedido.turnId,
  );
  // O registro da campanha: extrai do texto que o Mestre acabou de escrever os
  // fatos que ninguém pode esquecer. Roda aqui, no fim, e nunca desfaz o turno
  // — uma falha da IA deixa o registro como estava e a resolução segue gravada.
  if (chat) {
    try {
      const houses = await listHouses(deps.doc, tableName, campaignId);
      const seatOfHouseId = (h: string) => SEATS.find((s) => s.name === houses.find((x) => x.houseId === h)?.name)?.key ?? null;
      const entrada = {
        turnNumber: pedido.turnId,
        publicEvent: pedido.publicEvent ?? "",
        publicResult: pedido.publicResult ?? "",
        houseResults: pedido.houseResults ?? {},
        seatOfHouseId,
      };

      // Uma chamada por bloco. Com o turno inteiro numa chamada só, o modelo
      // gastou o orçamento todo em raciocínio e devolveu nada em duas de três
      // tentativas — a entrada grande é que dispara isso. Cada bloco também já
      // sabe de quem é o segredo, então a visibilidade para de ser dedução.
      const novos: WorldFact[] = [];
      let descartadosTotal = 0;
      for (const bloco of turnBlocks(entrada)) {
        let raw = "";
        for (let tentativa = 0; tentativa < 2 && !raw.trim(); tentativa++) {
          raw = await chat(FACT_EXTRACTION_SYSTEM_PROMPT, buildFactExtractionUser(pedido.turnId, bloco), true, 4000);
        }
        if (!raw.trim()) {
          console.warn(`Registro de fatos: bloco ${bloco.visibility} do turno ${pedido.turnId} sem resposta do modelo.`);
          continue;
        }
        const { facts, descartados } = parseFacts(raw, {
          bloco, turnNumber: pedido.turnId, campaignId,
          now: new Date().toISOString(),
          id: () => `wf-${pedido.turnId}-${Math.random().toString(36).slice(2, 9)}`,
        });
        novos.push(...facts);
        descartadosTotal += descartados;
      }

      if (novos.length > 0) {
        // Idempotente: reaplicar o turno reescreve os fatos dele em vez de
        // empilhar uma segunda cópia de cada um.
        await deleteWorldFactsOfTurn(deps.doc, tableName, campaignId, pedido.turnId);
        for (const f of novos) await putWorldFact(deps.doc, tableName, campaignId, f);
      }
      if (descartadosTotal > 0) {
        // Fato descartado é fato que o modelo não conseguiu ancorar no texto.
        console.warn(`Registro de fatos: ${descartadosTotal} descartados por citação que não confere, ${novos.length} gravados.`);
      }
    } catch (e) {
      console.error("Falha ao extrair fatos (turno segue aplicado):", (e as Error)?.message);
    }
  }

  // Relationship Engine: depois da resolução gravada, atualiza os NPCs que
  // tomaram conhecimento do que aconteceu. Roda aqui, no fim, e nunca desfaz o
  // turno: uma falha da IA deixa os NPCs como estavam e o turno segue aplicado.
  if (chat) {
    try {
      const houses = await listHouses(deps.doc, tableName, campaignId);
      const keyByHouseId = new Map(
        houses.map((h) => [h.houseId, SEATS.find((s) => s.name === h.name)?.key ?? null] as const),
      );
      const resolvedTurn = {
        turnId: pedido.turnId,
        status: "RESOLVED",
        publicEvent: pedido.publicEvent,
        privateInfo: pedido.privateInfo ?? {},
        createdAt: "",
        result: {
          publicResult: pedido.publicResult,
          houseResults: pedido.houseResults,
          discoveries: pedido.discoveries,
        },
      } as Turn;
      await updateNpcWorld(
        {
          chat,
          getDynamic: (aff, id) => getNpcDynamic(deps.doc, tableName, campaignId, aff, id),
          putDynamic: (d) => putNpcDynamic(deps.doc, tableName, campaignId, d),
          houseKeyOf: (hid) => keyByHouseId.get(hid) ?? null,
          // Quem os jogadores procuraram entra na frente: o estado vivo só é
          // lido quando alguém escreve para aquele NPC, e ele estava sendo
          // gasto com líderes que quase ninguém procura.
          recentlyContacted: async () => {
            const msgs = await listAllMessages(deps.doc, tableName, campaignId);
            const chaves = new Set<string>();
            for (const m of msgs) {
              if (m.turnNumber >= pedido.turnId - 1 && m.toCharacterId) {
                chaves.add(`${m.toHouseKey}:${m.toCharacterId}`);
              }
            }
            return chaves;
          },
          lastTouched: async () => {
            const rows = await listNpcDynamics(deps.doc, tableName, campaignId);
            return new Map(
              rows.map((d) => [
                `${d.affiliation}:${d.id}`,
                d.memory.reduce((max, m) => Math.max(max, m.turnNumber), 0),
              ]),
            );
          },
        },
        resolvedTurn,
      );
    } catch (e) {
      console.error("Falha no Relationship Engine (turno segue aplicado):", (e as Error)?.message);
    }
  }
}
