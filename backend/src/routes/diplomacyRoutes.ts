import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import {
  RELATIONS_DOC, SEATS, budgetBetween, newMessage, pairKey, personaFor, seatOf, sendsRemaining,
  clampMessage, characterFor, characterId, houseRoster, codexBySeat, codexNpcBySeatAndId, houseProfileFor,
  type DiplomaticMessage,
} from "@ravenloft/content";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { getHouse, listHouses } from "../db/houses";
import { getActiveTurn, listTurns } from "../db/turns";
import { listWikiEntries } from "../db/wiki";
import { listThread, listAllMessages, listPairHistory, putMessage } from "../db/diplomacy/messages";
import { getNpcDynamic } from "../db/npcDynamic";
import { getHouseRelation } from "../db/houseRelations";
import { listFacts, putFact } from "../db/diplomacy/facts";
import {
  HOUSE_REPLY_SYSTEM_PROMPT, buildHouseReplyUser, parseReply, relationsBetween,
} from "../ai/diplomacy/housePrompt";
import { buildPublicChronicle } from "../ai/diplomacy/chronicle";
import { buildHouseSituation } from "../ai/diplomacy/situation";
import { leaderIsDead } from "../ai/diplomacy/succession";
import { fold, titleHead } from "../ai/visual/canonLookup";

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Uma pessoa por id: um NPC do Codex não pode aparecer duas vezes na lista. */
function dedupePeople(people: { id: string; name: string; role: string }[]): { id: string; name: string; role: string }[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return [...byId.values()];
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
        // Uma Casa NPC que escreveu primeiro. Sem este sinal a carta chega e
        // fica invisível: nada na lista distingue quem procurou o jogador de
        // quem nunca falou com ele.
        escreveuPrimeiro: thread.length > 0 && thread[0].author === "AI",
        // Casas com jogador ficam listadas mas bloqueadas, para o jogador
        // entender por que não pode escrever em vez de simplesmente não vê-las.
        playerControlled: taken.has(s.key),
        // O elenco endereçável, de uma fonte só. Os Major NPCs do Codex —
        // arquimagos, a Coroa — entram junto das figuras de Casa: os
        // mensageiros viajam até a sede, seja para a chancelaria, uma figura,
        // ou um NPC de organização alcançado por ali.
        people: dedupePeople([
          ...codexBySeat(s.key).map((n) => ({ id: n.id, name: n.name, role: n.role })),
          ...houseRoster(s.key).map((c) => ({ id: characterId(c.name), name: c.name, role: c.role })),
        ]),
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

  // Nulo = a chancelaria da Casa, como sempre. Um id é ou uma figura da Casa
  // (HOUSE_CHARACTERS) ou um Major NPC do Codex alcançado por esta sede — um
  // arquimago, a Coroa. Se não for nenhum dos dois, a carta iria ao vazio.
  const toCharacterId = typeof body.toCharacterId === "string" && body.toCharacterId ? body.toCharacterId : null;
  const character = toCharacterId ? characterFor(toHouseKey, toCharacterId) : null;
  const codexNpc = toCharacterId && !character ? codexNpcBySeatAndId(toHouseKey, toCharacterId) : null;
  if (toCharacterId && !character && !codexNpc) {
    throw new HttpError(400, "INVALID_BODY", `Ninguém com esse nome responde por ${target.name}.`);
  }

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
    fromHouseId: player.houseId, toHouseKey, author: "PLAYER", body: text, toCharacterId,
  });
  await putMessage(deps.doc, deps.config.tableName, deps.config.campaignId, sent);

  let reply: DiplomaticMessage | null = null;
  if (deps.chat) {
    try {
      const [wiki, allTurns, history, npcDynamic, houseRelation] = await Promise.all([
        listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId),
        listTurns(deps.doc, deps.config.tableName, deps.config.campaignId),
        listPairHistory(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, toHouseKey),
        // O estado vivo (Living Characters) é chaveado por afiliação+id. Para
        // um NPC do Codex a afiliação é a dele (coroa, ordem-dos-tres); para
        // uma figura de Casa, a Casa é a afiliação. Fonte única do estado.
        toCharacterId
          ? getNpcDynamic(deps.doc, deps.config.tableName, deps.config.campaignId, codexNpc?.affiliation ?? toHouseKey, toCharacterId)
          : Promise.resolve(null),
        // Direcional: como QUEM RESPONDE vê quem escreveu. A relação inversa
        // pertence à outra carta.
        getHouseRelation(deps.doc, deps.config.tableName, deps.config.campaignId, toHouseKey, ownKey),
      ]);
      const houseEntry = wiki.find((w) => fold(titleHead(w.title)) === fold(titleHead(target.name))) ?? null;
      const chronicle = buildPublicChronicle(allTurns);
      const persona = personaFor(toHouseKey);
      // O evento corrente também conta: um líder pode ter morrido agora.
      const deathSource = `${chronicle}\n${turn.publicEvent ?? ""}`;
      const user = buildHouseReplyUser({
        toHouseName: target.name,
        fromHouseName: house.name,
        fromHouseKey: ownKey,
        houseEntry,
        // A Casa que responde sabe do que vive e do que carece: é o que permite
        // pedir grão a quem planta e cobrar caro pelo ferro que só ela funde.
        houseProfile: houseProfileFor(toHouseKey),
        // E o perfil de quem escreveu: sem os dois lados, a Casa responde
        // cega e só sobra cortesia.
        writerProfile: houseProfileFor(ownKey),
        relations: relationsBetween(RELATIONS_DOC, target.name, house.name),
        publicEvent: turn.publicEvent ?? "",
        chronicle,
        persona,
        character,
        // Quando quem responde é um NPC de organização/Coroa, é a ficha do
        // Codex que fala, na própria voz.
        codexIdentity: codexNpc,
        // A Casa destinatária é sempre canon (as de jogador são bloqueadas),
        // então a situação vem da menção nos eventos, sem houseId.
        houseSituation: buildHouseSituation({ houseName: target.name, turns: allTurns }),
        npcDynamic,
        // Par nunca tocado não vira bloco de prompt: o padrão não diz nada
        // que a persona já não diga, e custa contexto em toda carta.
        houseRelation: houseRelation.updatedAt ? houseRelation : null,
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
          fromHouseId: player.houseId, toHouseKey, author: "AI", body: text, replyToId: sent.id, toCharacterId,
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

/**
 * Toda a correspondência da campanha, mais o registro da partida. Visão do GM.
 *
 * Antes só devolvia o turno corrente, e o Mestre não conseguia acompanhar uma
 * negociação que atravessa turnos — que é justamente como a diplomacia acontece
 * aqui. Agora vem tudo, agrupado por turno e por par de correspondentes.
 */
export async function adminDiplomacy(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const [turn, messages, facts, houses] = await Promise.all([
    getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId),
    listAllMessages(deps.doc, deps.config.tableName, deps.config.campaignId),
    listFacts(deps.doc, deps.config.tableName, deps.config.campaignId),
    listHouses(deps.doc, deps.config.tableName, deps.config.campaignId),
  ]);

  const houseNames = Object.fromEntries(houses.map((h) => [h.houseId, h.name]));
  // Uma conversa por (turno, remetente, destinatário): a mesma dupla volta a se
  // falar em turnos diferentes, e juntar tudo num fio só esconderia quando cada
  // coisa foi dita.
  const threads = new Map<string, {
    turnNumber: number; houseId: string; houseName: string;
    toHouseKey: string; toName: string; messages: DiplomaticMessage[];
  }>();
  for (const m of messages) {
    const k = `${m.turnNumber}#${pairKey(m.fromHouseId, m.toHouseKey)}`;
    const t = threads.get(k) ?? {
      turnNumber: m.turnNumber,
      houseId: m.fromHouseId,
      houseName: houseNames[m.fromHouseId] ?? m.fromHouseId,
      toHouseKey: m.toHouseKey,
      toName: seatOf(m.toHouseKey)?.name ?? m.toHouseKey,
      messages: [],
    };
    t.messages.push(m);
    threads.set(k, t);
  }

  // Mais recente primeiro: o Mestre quase sempre quer o turno que acabou de rodar.
  const ordered = [...threads.values()].sort(
    (a, b) => b.turnNumber - a.turnNumber || a.houseName.localeCompare(b.houseName),
  );
  return { status: 200, body: { turnNumber: turn?.turnId ?? 0, threads: ordered, facts } };
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
