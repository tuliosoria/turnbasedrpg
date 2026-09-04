import type { Deps } from "./publicRoutes";
import type { HandlerRequest, HandlerResponse } from "../types/domain";
import { HttpError } from "../types/domain";
import {
  SEATS, budgetBetween, newMessage, pairKey, seatOf, sendsRemaining,
  clampMessage, characterFor, characterId, fullCodex, houseRoster, codexBySeat, codexNpcBySeatAndId, seatKeyForHouseId,
  type DiplomaticMessage,
} from "@ravenloft/content";
import { requirePlayer } from "../auth/playerAuth";
import { requireAdmin } from "../auth/adminAuth";
import { getHouse, listHouses, updateHouseStabilityAndAssets } from "../db/houses";
import { listFavorsForHouse } from "../db/projects";
import { getActiveTurn } from "../db/turns";
import { listThread, listAllMessages, listTurnMessages, listPairHistory, putMessage, deleteMessage } from "../db/diplomacy/messages";
import { getHouseRelation, putHouseRelation, listHouseRelations } from "../db/houseRelations";
import { listFacts, putFact } from "../db/diplomacy/facts";
import { PACT_DELTAS, applyDeltas, isAnswerable, pactAssetName, pactKindFor, placeInSummary, politicalFallout } from "@ravenloft/content";
import { parsePactResponseBody } from "../validation/schemas";
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

  // As propostas em aberto viajam junto: sem isto o jogador lê uma carta que
  // propõe uma rota e não tem onde dizer sim.
  const fatos = await listFacts(deps.doc, deps.config.tableName, deps.config.campaignId);
  // O preço aparece ANTES do sim. Um custo político que só se descobre depois
  // de aceitar é armadilha, não escolha.
  const todasRelacoes = await listHouseRelations(deps.doc, deps.config.tableName, deps.config.campaignId);
  const propostas = fatos
    .filter((f) => f.betweenA === player.houseId && isAnswerable(f.kind, f.status))
    .map((f) => ({
      id: f.id, comHouseKey: f.betweenB, resumo: f.summary, turnNumber: f.turnNumber,
      custoPolitico: politicalFallout(f.betweenB, pactKindFor(f.summary), todasRelacoes)
        .map((o) => ({ casa: seatOf(o.seatKey)?.name ?? o.seatKey, amizade: o.amizade })),
    }));

  return { status: 200, body: { turnNumber, open: turn?.status === "OPEN", entries, propostas } };
}

/**
 * Quantas Casas procuraram este jogador neste turno.
 *
 * Barato de propósito: uma consulta pelo prefixo do turno, sem varrer as
 * dezesseis sedes como faz a lista de destinatários. É chamado do cabeçalho,
 * em toda página, então não pode custar caro.
 */
export async function countIncoming(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const turn = await getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId);
  if (!turn) return { status: 200, body: { cartas: 0, turnNumber: 0 } };

  const mensagens = await listTurnMessages(deps.doc, deps.config.tableName, deps.config.campaignId, turn.turnId);
  const meus = mensagens.filter((m) => m.fromHouseId === player.houseId);

  // Uma Casa procurou o jogador quando a primeira carta do fio é dela.
  const porCasa = new Map<string, typeof meus>();
  for (const m of meus) porCasa.set(m.toHouseKey, [...(porCasa.get(m.toHouseKey) ?? []), m]);

  // Quais, e não só quantas. O sino dizia "4" e o jogador tinha de abrir Casa
  // por Casa para descobrir quem escreveu — o aviso apontava para um monte de
  // palheiro em vez de para a agulha.
  const remetentes = [];
  for (const [houseKey, fio] of porCasa) {
    const ordenado = [...fio].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const primeira = ordenado[0];
    if (primeira?.author !== "AI") continue;
    remetentes.push({
      houseKey,
      houseName: seatOf(houseKey)?.name ?? houseKey,
      // Quem assinou, quando a carta veio de uma pessoa e não da chancelaria.
      person: primeira.toCharacterId ? nomeDoNpc(primeira.toCharacterId) : null,
      // A primeira linha basta para o jogador saber se abre agora ou depois.
      preview: primeira.body.split("\n").find((l) => l.trim())?.trim().slice(0, 120) ?? "",
      turnNumber: primeira.turnNumber,
    });
  }

  return { status: 200, body: { cartas: remetentes.length, turnNumber: turn.turnId, remetentes } };
}

/** O nome legível de quem assinou, para o sino não mostrar "othran-sete-tintas". */
function nomeDoNpc(id: string): string {
  return fullCodex().find((n) => n.id === id)?.name ?? id;
}

/**
 * A conversa do jogador com uma Casa, do começo.
 *
 * Mostrava só o turno corrente, e por isso um jogador que negociou dois turnos
 * seguidos com Euralune abria a Casa e via vazio — como se nunca tivesse
 * escrito. A IA já recebia as cartas passadas para não responder como quem
 * esquece; faltava o jogador ter a mesma memória.
 *
 * O orçamento de mensageiros continua sendo por turno: ler o passado não gasta
 * envio, e o contador vem da lista de destinatários, não daqui.
 */
export async function getThread(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const [turn, historia] = await Promise.all([
    getActiveTurn(deps.doc, deps.config.tableName, deps.config.campaignId),
    listPairHistory(deps.doc, deps.config.tableName, deps.config.campaignId, player.houseId, req.pathParams.houseKey),
  ]);
  return { status: 200, body: { entries: historia, turnNumber: turn?.turnId ?? 0 } };
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

  // A resposta é escrita FORA da requisição.
  //
  // Ela leva de dez a quarenta segundos, porque o modelo raciocina antes de
  // escrever, e o API Gateway corta em trinta. A carta era gravada antes da
  // chamada, então o jogador levava erro vermelho com a carta já entregue — e
  // reenviava. Foi assim que a mesma carta para Ferrumor entrou duas vezes.
  //
  // Uma falha ao disparar o worker não desfaz nada: a carta está gravada e o
  // envio, cobrado. O jogador vê que a resposta não veio, e não que a carta
  // sumiu.
  let respostaAcaminho = false;
  if (deps.invokeReply) {
    try {
      await deps.invokeReply({
        playerHouseId: player.houseId, ownKey, toHouseKey, toCharacterId, sentId: sent.id,
      });
      respostaAcaminho = true;
    } catch (e) {
      console.error("Não consegui disparar a resposta:", (e as Error)?.message);
    }
  }

  return {
    status: 201,
    body: {
      sent,
      reply: null,
      remaining: sendsRemaining([...thread, sent], budget.sends),
      // A resposta vem depois, por outro caminho. O front avisa e vai buscar.
      replyPending: respostaAcaminho,
      replyFailed: !!deps.invokeReply && !respostaAcaminho,
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
    /** Verdadeiro quando foi a Casa NPC que procurou o jogador. */
    mundoComecou: boolean;
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
      mundoComecou: false,
    };
    t.messages.push(m);
    // A primeira carta do fio diz quem procurou quem. Sem isto o painel mostra
    // "Khazdrun → Casa Valerius" com a resposta de Valerius rotulada como
    // "respondeu", quando na verdade foi Valerius que escreveu primeiro.
    t.mundoComecou = t.messages[0]?.author === "AI";
    threads.set(k, t);
  }

  // Mais recente primeiro: o Mestre quase sempre quer o turno que acabou de rodar.
  const ordered = [...threads.values()].sort(
    (a, b) => b.turnNumber - a.turnNumber || a.houseName.localeCompare(b.houseName),
  );
  return { status: 200, body: { turnNumber: turn?.turnId ?? 0, threads: ordered, facts } };
}

/**
 * Retira uma carta que o mundo escreveu.
 *
 * O Mestre escolheu que as cartas de NPC chegam direto, sem fila de aprovação,
 * com a condição de poder tirar do ar a que sair errada. Só carta de IA: o que
 * um jogador enviou é registro da partida, e apagá-lo reescreveria a história
 * dele.
 */
export async function withdrawLetter(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  requireAdmin(deps.config, req);
  const id = req.pathParams.id;
  const todas = await listAllMessages(deps.doc, deps.config.tableName, deps.config.campaignId);
  const carta = todas.find((m) => m.id === id);
  if (!carta) return { status: 404, body: { code: "NOT_FOUND", message: "Carta não encontrada." } };
  if (carta.author !== "AI") {
    throw new HttpError(409, "BAD_STATUS", "Cartas escritas por jogadores não são retiradas: são registro da partida.");
  }
  await deleteMessage(deps.doc, deps.config.tableName, deps.config.campaignId, carta);
  return { status: 200, body: { id, retirada: true } };
}

/**
 * O jogador responde a uma proposta, e o mundo se mexe.
 *
 * Era o elo que faltava: a carta propunha, o registro guardava, e nada mais
 * acontecia — uma aliança firmada não mexia numa única linha do jogo. Aceitar
 * fecha três coisas de uma vez: o fato vira ALIANCA ou ACORDO, as relações
 * entre as duas Casas andam, e nasce um ativo (embaixada ou entreposto) que dá
 * ao pacto um corpo no mundo, atacável e tomável num turno futuro.
 */
/**
 * O que a Casa do jogador firmou, deve e ganhou.
 *
 * Estava tudo espalhado: favores escondidos numa aba do painel de projetos,
 * acordos só na visão do Mestre, e os ativos numa lista sem dizer de onde
 * vieram. O jogador não tinha onde olhar para saber com quem tem aliança.
 */
export async function listPacts(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { tableName, campaignId } = deps.config;
  const [fatos, favores, house] = await Promise.all([
    listFacts(deps.doc, tableName, campaignId),
    listFavorsForHouse(deps.doc, tableName, campaignId, player.houseId),
    getHouse(deps.doc, tableName, campaignId, player.houseId),
  ]);

  const meus = fatos.filter((f) => f.betweenA === player.houseId);
  const nome = (k: string) => seatOf(k)?.name ?? k;

  return {
    status: 200,
    body: {
      // Firmado: o que está de pé. Histórico: o que foi recusado ou rompido,
      // porque uma recusa também é informação para negociar depois.
      firmados: meus
        .filter((f) => f.status === "ATIVO" && (f.kind === "ALIANCA" || f.kind === "ACORDO"))
        .map((f) => ({ id: f.id, tipo: f.kind, com: nome(f.betweenB), resumo: f.summary, turnNumber: f.turnNumber })),
      abertos: meus
        .filter((f) => isAnswerable(f.kind, f.status))
        .map((f) => ({ id: f.id, com: nome(f.betweenB), resumo: f.summary, turnNumber: f.turnNumber })),
      historico: meus
        .filter((f) => f.kind === "RECUSA" || (f.status === "REVOGADO" && f.kind !== "PEDIDO"))
        .map((f) => ({ id: f.id, tipo: f.kind, com: nome(f.betweenB), resumo: f.summary, turnNumber: f.turnNumber, status: f.status })),
      favores: favores.map((f) => ({
        id: f.id, status: f.status, amount: f.amount, reason: f.reason,
        credor: nome(f.fromHouseId),
      })),
      ativos: house?.assets ?? [],
    },
  };
}

export async function respondToPact(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  const player = requirePlayer(deps.config, req);
  const { factId, aceitar } = parsePactResponseBody(req.body);
  const { tableName, campaignId } = deps.config;

  const fatos = await listFacts(deps.doc, tableName, campaignId);
  const proposta = fatos.find((f) => f.id === factId);
  if (!proposta) return { status: 404, body: { code: "NOT_FOUND", message: "Proposta não encontrada." } };
  if (proposta.betweenA !== player.houseId) {
    throw new HttpError(403, "NO_HOUSE", "Esta proposta não é sua.");
  }
  if (!isAnswerable(proposta.kind, proposta.status)) {
    throw new HttpError(409, "BAD_STATUS", "Esta proposta já foi respondida ou não admite resposta.");
  }

  // Respondida é respondida: a proposta sai de aberto nos dois casos, para não
  // poder ser aceita duas vezes.
  await putFact(deps.doc, tableName, campaignId, { ...proposta, status: "REVOGADO" });

  if (!aceitar) {
    const recusa = { ...proposta, id: newId(), kind: "RECUSA" as const, status: "ATIVO" as const,
      summary: `Recusado: ${proposta.summary}`, createdAt: new Date().toISOString() };
    await putFact(deps.doc, tableName, campaignId, recusa);
    return { status: 200, body: { aceito: false, fato: recusa } };
  }

  const tipo = pactKindFor(proposta.summary);
  // A sede de quem aceita fica de fora: o entreposto é no chão do outro, ou em
  // terra de ninguém, nunca na própria capital.
  const minhaSede = seatKeyForHouseId(player.houseId);
  const lugar = placeInSummary(proposta.summary, SEATS.map((s) => s.seat), minhaSede ? seatOf(minhaSede)?.seat : null);
  const agora = new Date().toISOString();

  const pacto = { ...proposta, id: newId(), kind: tipo, status: "ATIVO" as const, createdAt: agora };
  await putFact(deps.doc, tableName, campaignId, pacto);

  // A matriz fala em chave de SEDE, sempre. Gravar com houseId criava uma
  // segunda linha para a mesma Casa ("solarion-k0hc" ao lado de
  // "casa-solarion"), e a carta — que lê pela sede — nunca via o que o pacto
  // tinha movido. O acordo mexia num número que ninguém consultava.
  const minhaSedeChave = seatKeyForHouseId(player.houseId);
  if (!minhaSedeChave) throw new HttpError(409, "NO_SEAT", "A sua Casa ainda não tem sede registrada no mapa.");

  // A relação anda nos dois sentidos: um pacto não é sentido por um lado só.
  for (const [de, para] of [[proposta.betweenB, minhaSedeChave], [minhaSedeChave, proposta.betweenB]]) {
    const atual = await getHouseRelation(deps.doc, tableName, campaignId, de, para);
    const movida = applyDeltas(
      { amizade: atual.amizade, comercio: atual.comercio, favores: atual.favores },
      PACT_DELTAS[tipo],
    );
    await putHouseRelation(deps.doc, tableName, campaignId, {
      ...atual,
      // Explícito, e não herdado do que foi lido: uma linha gravada com a chave
      // errada se perpetuava a cada pacto, porque a escrita copiava as chaves
      // do próprio registro que estava errado.
      fromKey: de,
      toKey: para,
      ...movida,
      note: [atual.note, `Pacto do turno ${proposta.turnNumber}: ${proposta.summary.slice(0, 160)}`].filter(Boolean).join(" "),
    });
  }

  // O preço político. É isto que impede o jogador de fechar pacto com as
  // dezesseis Casas: os aliados dele se odeiam, e cada companhia custa com
  // quem detesta a companhia.
  const todas = await listHouseRelations(deps.doc, tableName, campaignId);
  const ofendidas = politicalFallout(proposta.betweenB, tipo, todas);
  for (const o of ofendidas) {
    const atual = await getHouseRelation(deps.doc, tableName, campaignId, o.seatKey, minhaSedeChave);
    await putHouseRelation(deps.doc, tableName, campaignId, {
      ...atual,
      fromKey: o.seatKey,
      toKey: minhaSedeChave,
      ...applyDeltas({ amizade: atual.amizade, comercio: atual.comercio, favores: atual.favores }, { amizade: o.amizade }),
      note: [atual.note, `Turno ${proposta.turnNumber}: fecharam ${tipo === "ALIANCA" ? "aliança" : "acordo"} com ${seatOf(proposta.betweenB)?.name ?? proposta.betweenB}.`]
        .filter(Boolean).join(" "),
    });
  }

  const ativo = pactAssetName(tipo, lugar);
  const house = await getHouse(deps.doc, tableName, campaignId, player.houseId);
  if (house && !(house.assets ?? []).includes(ativo)) {
    await updateHouseStabilityAndAssets(
      deps.doc, tableName, campaignId, player.houseId,
      house.stability ?? 3, [...(house.assets ?? []), ativo],
    );
  }

  return {
    status: 200,
    body: {
      aceito: true, fato: pacto, ativo,
      custoPolitico: ofendidas.map((o) => ({ casa: seatOf(o.seatKey)?.name ?? o.seatKey, amizade: o.amizade })),
    },
  };
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
