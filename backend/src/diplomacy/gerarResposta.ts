import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  RELATIONS_DOC, characterFor, characterId, codexNpcBySeatAndId, houseProfileFor, newMessage,
  personaFor, seatOf, houseCanonFor, npcFor,
  type DiplomaticMessage,
} from "@ravenloft/content";
import type { ChatFn } from "../ai/openai";
import type { Config } from "../types/domain";
import { getHouse } from "../db/houses";
import { getActiveTurn, listTurns } from "../db/turns";
import { listWikiEntries } from "../db/wiki";
import { listThread, listPairHistory, putMessage } from "../db/diplomacy/messages";
import { getNpcDynamic } from "../db/npcDynamic";
import { getHouseRelation } from "../db/houseRelations";
import { putFact } from "../db/diplomacy/facts";
import { listWorldFacts } from "../db/worldFacts";
import { HOUSE_REPLY_SYSTEM_PROMPT, buildHouseReplyUser, parseReply, relationsBetween } from "../ai/diplomacy/housePrompt";
import { buildPublicChronicle } from "../ai/diplomacy/chronicle";
import { buildHouseSituation } from "../ai/diplomacy/situation";
import { leaderIsDead } from "../ai/diplomacy/succession";
import { fold, titleHead } from "../ai/visual/canonLookup";

export interface RespostaDeps {
  doc: DynamoDBDocumentClient;
  config: Config;
  chat?: ChatFn;
  chatDiplomacia?: ChatFn;
}

export interface PedidoDeResposta {
  playerHouseId: string;
  ownKey: string;
  toHouseKey: string;
  toCharacterId: string | null;
  /** A carta do jogador que está sendo respondida. */
  sentId: string;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function leaderIdOf(seatKey: string): string {
  const p = personaFor(seatKey);
  return p ? characterId(p.leaderName) : "";
}

function biographyOf(affiliation: string, id: string): string | null {
  if (!id) return null;
  return npcFor(affiliation, id)?.biography ?? null;
}

function forceOf(seatKey: string | null): { sustainableTroops: number; emergencyTroops: number } | null {
  const canon = seatKey ? houseCanonFor(seatKey) : null;
  if (!canon?.sustainableTroops || !canon.emergencyTroops) return null;
  return { sustainableTroops: canon.sustainableTroops, emergencyTroops: canon.emergencyTroops };
}

/**
 * Escreve a resposta de uma Casa a uma carta do jogador, e a grava.
 *
 * Vive fora da rota porque agora roda FORA da requisição. A resposta leva de
 * dez a quarenta segundos — o modelo raciocina antes de escrever — e o teto do
 * API Gateway é trinta. A carta era gravada antes da chamada, então o jogador
 * levava um erro vermelho com a carta já entregue, e reenviava.
 *
 * Refaz o contexto do banco em vez de recebê-lo pronto: quem a invoca é um
 * `Invoke` assíncrono, e o que atravessa ali é JSON, não objetos carregados.
 */
export async function gerarResposta(deps: RespostaDeps, pedido: PedidoDeResposta): Promise<DiplomaticMessage | null> {
  const chat = deps.chatDiplomacia ?? deps.chat;
  if (!chat) return null;

  const { playerHouseId, ownKey, toHouseKey, toCharacterId, sentId } = pedido;
  const target = seatOf(toHouseKey);
  const house = await getHouse(deps.doc, deps.config.tableName, deps.config.campaignId, playerHouseId);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!target || !house || !turn) return null;

  const character = toCharacterId ? characterFor(toHouseKey, toCharacterId) : null;
  const codexNpc = toCharacterId && !character ? codexNpcBySeatAndId(toHouseKey, toCharacterId) : null;

  const thread = await listThread(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId, playerHouseId, toHouseKey);
  const sent = thread.find((m) => m.id === sentId);
  if (!sent) return null;
  // Já respondida: um `Invoke` assíncrono pode chegar duas vezes.
  if (thread.some((m) => m.replyToId === sentId)) return null;

  const [wiki, allTurns, history, npcDynamic, houseRelation, worldFacts] = await Promise.all([
    listWikiEntries(deps.doc, deps.config.tableName, deps.config.campaignId),
    listTurns(deps.doc, deps.config.tableName, deps.config.campaignId),
    listPairHistory(deps.doc, deps.config.tableName, deps.config.campaignId, playerHouseId, toHouseKey),
    // O estado vivo (Living Characters) é chaveado por afiliação+id. Para
    // um NPC do Codex a afiliação é a dele (coroa, ordem-dos-tres); para
    // uma figura de Casa, a Casa é a afiliação. Fonte única do estado.
    // Carta à chancelaria cai no líder: é ele quem responde por ela. Sem
    // isto, tudo que o líder viveu — o que viu, quem perdeu, o que
    // desconfia — só era lido por quem soubesse endereçar a carta pelo
    // nome dele, e a memória viva ficava inalcançável na porta da frente.
    getNpcDynamic(
      deps.doc, deps.config.tableName, deps.config.campaignId,
      codexNpc?.affiliation ?? toHouseKey,
      toCharacterId ?? (personaFor(toHouseKey) ? characterId(personaFor(toHouseKey)!.leaderName) : ""),
    ),
    // Direcional: como QUEM RESPONDE vê quem escreveu. A relação inversa
    // pertence à outra carta.
    getHouseRelation(deps.doc, deps.config.tableName, deps.config.campaignId, toHouseKey, ownKey),
    // O registro da campanha. O prompt filtra; aqui se carrega tudo, que é
    // uma consulta só e o razão é pequeno perto de uma carta.
    listWorldFacts(deps.doc, deps.config.tableName, deps.config.campaignId),
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
    // Quantos combatentes cada lado realmente põe em campo. Sem isto a
    // oferta de tropa é chute: nada dizia se "300 cavaleiras" é muito ou
    // pouco para quem promete.
    worldFacts,
    houseForce: forceOf(toHouseKey),
    writerForce: forceOf(ownKey),
    // A vida de quem responde, do Codex. Um caminho só serve aos três
    // casos: a pessoa endereçada, o NPC de organização, e o líder quando
    // é a chancelaria que fala.
    biography: biographyOf(codexNpc?.affiliation ?? toHouseKey, toCharacterId ?? leaderIdOf(toHouseKey)),
    toHouseKey,
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
  // O teto cobre RACIOCÍNIO + carta, não só a carta.
  //
  // Ele já foi 700, calculado como "250 palavras cabem em ~400 tokens, o
  // resto é folga". A conta ignorava que, nesta família de modelos, os
  // tokens de raciocínio saem do mesmo orçamento. Medido em cinco chamadas
  // reais: raciocínio de 512, 1024 e 1400, com a carta ocupando ~400 além
  // disso. A 700, a maioria das cartas voltava VAZIA — o jogador escrevia e
  // não recebia resposta nenhuma. A 1400, uma em três ainda estourava.
  //
  // 2200 deixa ~800 de margem. Não se paga folga que não se usa: as
  // chamadas medidas terminaram em ~1400 tokens de completion.
  const raw = await chat(HOUSE_REPLY_SYSTEM_PROMPT, user, true, 2200);
  const { text, acordo } = parseReply(raw);
  if (!text) return null;

  const reply = newMessage({
    id: newId(), campaignId: deps.config.campaignId, turnNumber: turn.turnId,
    fromHouseId: playerHouseId, toHouseKey, author: "AI", body: text, replyToId: sent.id, toCharacterId,
  });
  await putMessage(deps.doc, deps.config.tableName, deps.config.campaignId, reply);

  // O que ficou definido na carta vira registro da partida. CampaignFact
  // existia desde o começo, com origem auditável, e nada nunca criou um:
  // aliança e acordo viviam só dentro do texto, onde ninguém consulta.
  if (acordo) {
    await putFact(deps.doc, deps.config.tableName, deps.config.campaignId, {
      id: newId(),
      campaignId: deps.config.campaignId,
      turnNumber: turn.turnId,
      kind: acordo.tipo,
      betweenA: playerHouseId,
      betweenB: toHouseKey,
      summary: acordo.resumo,
      sourceMessageId: reply.id,
      status: "ATIVO",
      createdAt: new Date().toISOString(),
    });
  }

  return reply;
}
