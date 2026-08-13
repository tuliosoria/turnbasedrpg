import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import {
  RELATIONS_DOC, SEATS, budgetBetween, newMessage, pairKey, personaFor, seatOf, sendsRemaining,
  clampMessage, type DiplomaticMessage,
} from "@ravenloft/content";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { getHouse, listHouses } from "../db/houses";
import { getActiveTurn, listTurns } from "../db/turns";
import { listWikiEntries } from "../db/wiki";
import { listThread, listTurnMessages, listPairHistory, putMessage } from "../db/diplomacy/messages";
import { listFacts, putFact } from "../db/diplomacy/facts";
import {
  HOUSE_REPLY_SYSTEM_PROMPT, buildHouseReplyUser, parseReply, relationsBetween,
} from "../ai/diplomacy/housePrompt";
import { buildPublicChronicle } from "../ai/diplomacy/chronicle";
import { leaderIsDead } from "../ai/diplomacy/succession";
import { fold, titleHead } from "../ai/visual/canonLookup";

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Casa viva do jogador → chave canônica. As Casas vivas guardam nomes curtos
 * ("Do Ouro", "Solarion"); as chaves seguem os títulos do wiki.
 */
export function houseKeyForName(name: string): string | null {
  const f = fold(name).trim();
  if (!f) return null;
  const hit = SEATS.find((s) => {
    const seat = fold(titleHead(s.name)).replace(/^(casa|cla|grande casa|ordem)\s+/g, "");
    return seat === f || fold(s.name) === f || fold(s.name).endsWith(` ${f}`);
  });
  return hit?.key ?? null;
}

/** Casas que já pertencem a um jogador — fora de escopo na Fase A. */
async function playerHouseKeys(deps: Deps): Promise<Set<string>> {
  const houses = await listHouses(deps.doc, deps.config.tableName, deps.config.campaignId);
  const keys = new Set<string>();
  for (const h of houses) {
    const k = houseKeyForName(h.name);
    if (k) keys.add(k);
  }
  return keys;
}

/** Destinatários possíveis, com o orçamento de cada um. */
export async function listRecipients(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");

  const ownKey = houseKeyForName(house.name);
  const taken = await playerHouseKeys(deps);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  const turnNumber = turn?.turnId ?? 0;

  const entries = await Promise.all(
    SEATS.filter((s) => s.key !== ownKey).map(async (s) => {
      const budget = ownKey ? budgetBetween(ownKey, s.key) : null;
      const thread = turn
        ? await listThread(deps.doc, deps.config.tableName, deps.config.campaignId, turnNumber, player.houseId, s.key)
        : [];
      return {
        houseKey: s.key,
        name: s.name,
        seat: s.seat,
        days: budget?.days ?? null,
        band: budget?.band ?? null,
        sends: budget?.sends ?? 0,
        remaining: budget ? sendsRemaining(thread, budget.sends) : 0,
        // Casas com jogador ficam listadas mas bloqueadas, para o jogador
        // entender por que não pode escrever em vez de simplesmente não vê-las.
        playerControlled: taken.has(s.key),
      };
    }),
  );

  return { status: 200, body: { turnNumber, open: turn?.status === "OPEN", entries } };
}

/** A conversa do jogador com uma Casa neste turno. */
export async function getThread(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  const messages = turn
    ? await listThread(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, player.houseId, req.pathParams.houseKey)
    : [];
  return { status: 200, body: { entries: messages } };
}

export async function sendMessage(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const toHouseKey = typeof body.toHouseKey === "string" ? body.toHouseKey : "";
  const text = clampMessage(body.body);
  if (!text) throw new HttpError(400, "INVALID_BODY", "Escreva a mensagem.");

  const target = seatOf(toHouseKey);
  if (!target) throw new HttpError(400, "INVALID_BODY", "Casa destinatária desconhecida.");

  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId);
  if (!house) throw new HttpError(404, "NO_HOUSE", "Casa não encontrada.");
  const ownKey = houseKeyForName(house.name);
  if (!ownKey) throw new HttpError(409, "NO_SEAT", "A sua Casa ainda não tem sede registrada no mapa.");
  if (ownKey === toHouseKey) throw new HttpError(400, "INVALID_BODY", "Você não escreve para si mesmo.");

  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn || turn.status !== "OPEN") {
    throw new HttpError(409, "TURN_LOCKED", "A correspondência só circula com o turno aberto.");
  }

  const taken = await playerHouseKeys(deps);
  if (taken.has(toHouseKey)) {
    throw new HttpError(409, "PLAYER_HOUSE", `${target.name} é conduzida por outro jogador. Cartas entre jogadores ainda não estão disponíveis.`);
  }

  // Orçamento antes de qualquer chamada de IA: recusar é barato, gerar não é.
  const budget = budgetBetween(ownKey, toHouseKey)!;
  const thread = await listThread(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, player.houseId, toHouseKey);
  if (sendsRemaining(thread, budget.sends) <= 0) {
    throw new HttpError(429, "NO_SENDS_LEFT",
      `Sem mensageiros disponíveis para ${target.name} neste turno. ${target.seat} fica a cerca de ${budget.days} dias de viagem.`);
  }

  const sent = newMessage({
    id: newId(), campaignId: deps.config.campaignId, turnNumber: turn.turnId,
    fromHouseId: player.houseId, toHouseKey, author: "PLAYER", body: text,
  });
  await putMessage(deps.doc, deps.config.tableName, deps.config.campaignId, sent);

  let reply: DiplomaticMessage | null = null;
  if (deps.chat) {
    try {
      const [wiki, allTurns, history] = await Promise.all([
        listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId),
        listTurns(deps.doc, deps.config.tableName, deps.config.campaignId),
        listPairHistory(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, toHouseKey),
      ]);
      const houseEntry = wiki.find((w) => fold(titleHead(w.title)) === fold(titleHead(target.name))) ?? null;
      const chronicle = buildPublicChronicle(allTurns);
      const persona = personaFor(toHouseKey);
      // O evento corrente também conta: um líder pode ter morrido agora.
      const deathSource = `${chronicle}\n${turn.publicEvent ?? ""}`;
      const user = buildHouseReplyUser({
        toHouseName: target.name,
        fromHouseName: house.name,
        houseEntry,
        relations: relationsBetween(RELATIONS_DOC, target.name, house.name),
        publicEvent: turn.publicEvent ?? "",
        chronicle,
        persona,
        leaderDied: !!persona && leaderIsDead(persona.leaderName, deathSource),
        priorLetters: history
          .filter((m) => m.turnNumber < turn.turnId)
          .slice(-8)
          .map((m) => ({ turnNumber: m.turnNumber, author: m.author, body: m.body })),
        thread: [...thread, sent].map((m) => ({ author: m.author, body: m.body })),
      });
      const raw = await deps.chat(HOUSE_REPLY_SYSTEM_PROMPT, user, false, 700);
      const text = parseReply(raw);
      if (text) {
        reply = newMessage({
          id: newId(), campaignId: deps.config.campaignId, turnNumber: turn.turnId,
          fromHouseId: player.houseId, toHouseKey, author: "AI", body: text, replyToId: sent.id,
        });
        await putMessage(deps.doc, deps.config.tableName, deps.config.campaignId, reply);
      }
    } catch {
      // A carta do jogador já foi gravada e o envio já foi cobrado. Uma falha da
      // IA não pode apagá-la; a resposta pode ser gerada depois.
      reply = null;
    }
  }

  return {
    status: 201,
    body: {
      sent,
      reply,
      remaining: sendsRemaining([...thread, sent], budget.sends),
      replyFailed: !!deps.chat && !reply,
    },
  };
}

/** Tudo que circulou no turno, mais o registro da partida. Visão do GM. */
export async function adminDiplomacy(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  const [messages, facts, houses] = await Promise.all([
    turn ? listTurnMessages(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId) : Promise.resolve([]),
    listFacts(deps.doc, deps.config.tableName, deps.config.campaignId),
    listHouses(deps.doc, deps.config.tableName, deps.config.campaignId),
  ]);

  const houseNames = Object.fromEntries(houses.map((h) => [h.houseId, h.name]));
  const threads = new Map<string, { houseId: string; houseName: string; toHouseKey: string; toName: string; messages: DiplomaticMessage[] }>();
  for (const m of messages) {
    const k = pairKey(m.fromHouseId, m.toHouseKey);
    const t = threads.get(k) ?? {
      houseId: m.fromHouseId,
      houseName: houseNames[m.fromHouseId] ?? m.fromHouseId,
      toHouseKey: m.toHouseKey,
      toName: seatOf(m.toHouseKey)?.name ?? m.toHouseKey,
      messages: [],
    };
    t.messages.push(m);
    threads.set(k, t);
  }

  return { status: 200, body: { turnNumber: turn?.turnId ?? 0, threads: [...threads.values()], facts } };
}

export async function revokeFact(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const facts = await listFacts(deps.doc, deps.config.tableName, deps.config.campaignId);
  const fact = facts.find((f) => f.id === req.pathParams.id);
  if (!fact) return { status: 404, body: { code: "NOT_FOUND", message: "Fato não encontrado." } };
  // Revogado, nunca apagado: o registro de partida precisa continuar auditável.
  await putFact(deps.doc, deps.config.tableName, deps.config.campaignId, { ...fact, status: "REVOGADO" });
  return { status: 200, body: { id: fact.id, status: "REVOGADO" } };
}
