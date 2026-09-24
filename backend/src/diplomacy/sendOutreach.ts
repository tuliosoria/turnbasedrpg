import type { DiplomaticMessage, Favor, WorldFact } from "@ravenloft/content";
import { clampMessage, personaFor, seatKeyForHouseId } from "@ravenloft/content";
import { houseRoster, codexBySeat } from "@ravenloft/content/gm-codex";
import { CARTAS_POR_JOGADOR, planOutreach, type OutreachPlan } from "../ai/diplomacy/outreach";
import { buildOutreachUser, OUTREACH_SYSTEM_PROMPT } from "../ai/diplomacy/outreachPrompt";
import { REVIEW_SYSTEM_PROMPT, buildReviewUser, parseRevisao } from "../ai/diplomacy/revisor";
import { encurtar, escalaAbsurda } from "../ai/diplomacy/escala";
import { safeSignature } from "../ai/diplomacy/grounding";
import type { Dossie } from "../ai/diplomacy/dossie";
import type { NpcDynamic } from "@ravenloft/content";

export interface OutreachDeps {
  chat?: (system: string, user: string, json: boolean, maxTokens: number) => Promise<string>;
  houses: { houseId: string; name: string }[];
  relations: { fromKey: string; toKey: string; amizade: number; comercio: number; favores: number; note: string; updatedAt: string }[];
  publicEvent: string;
  recentPublicResult?: string;
  publicObservations: Record<string, string>;
  alreadyTalking: Set<string>;
  turnNumber: number;
  campaignId: string;
  putMessage: (m: DiplomaticMessage) => Promise<void>;
  /** Grava a proposta como favor pendente, para o jogador aceitar ou recusar. */
  putFavor?: (f: Favor) => Promise<void>;
  newId: () => string;
  /** O registro da campanha, para a carta não contradizer o que já aconteceu. */
  worldFacts?: WorldFact[];
  /** A crônica pública, a mesma que a resposta a carta já recebia. */
  chronicle?: string;
  /** O fio completo com aquele par. Sem isto a carta proativa é amnésica. */
  dossieDe?: (playerHouseId: string, seatKey: string) => Promise<Dossie>;
  /** A memória viva de quem escreve — humor, o que teme, o que quer. */
  dynamicDe?: (seatKey: string) => Promise<NpcDynamic | null>;
  limit?: number;
  /**
   * Quanto tempo, no total, as cartas podem levar.
   *
   * O disparo vive no worker de 900s. O padrão é a folga de 840s: se uma
   * carta travar, abandonamos o lote antes do hard timeout da Lambda, que
   * reexecutaria e duplicaria o que já gravou. Não é o teto de 30s do
   * gateway — essa corrida já matou carta no meio da segunda passada.
   */
  deadlineMs?: number;
}

/** Folga do worker de 900s. Não voltar para 20s: outreach não passa mais pelo gateway. */
export const OUTREACH_DEADLINE_MS = 840_000;

/**
 * As cartas que o mundo escreve sozinho, quando o turno abre.
 *
 * Antes disto a diplomacia era um monólogo: nenhuma Casa NPC jamais procurava
 * um jogador, então quem não escrevia primeiro nunca recebia nada. A carta é
 * gravada no mesmo fio da conversa (jogador, Casa), então aparece onde o
 * jogador já sabe olhar.
 *
 * Falha de IA não derruba a abertura do turno: se uma carta não sai, as outras
 * saem, e se nenhuma sai o turno abre do mesmo jeito. Um mundo silencioso é
 * pior que um mundo vivo, mas é muito melhor que um turno que não abre.
 */
export async function sendOutreach(deps: OutreachDeps): Promise<DiplomaticMessage[]> {
  if (!deps.chat) return [];

  const players = deps.houses.map((h) => ({
    houseId: h.houseId,
    name: h.name,
    seatKey: seatKeyForHouseId(h.name) ?? seatKeyForHouseId(h.houseId),
  }));
  const playerSeatKeys = new Set(players.map((p) => p.seatKey).filter((k): k is string => !!k));

  const planos = planOutreach({
    players,
    playerSeatKeys,
    relations: deps.relations as never,
    publicEvent: deps.publicEvent,
    recentPublicResult: deps.recentPublicResult,
    publicObservations: deps.publicObservations,
    alreadyTalking: deps.alreadyTalking,
    limit: deps.limit ?? CARTAS_POR_JOGADOR * Math.max(1, players.length),
  });

  const relacaoDe = new Map(deps.relations.map((r) => [`${r.fromKey}~${r.toKey}`, r]));
  // Em paralelo porque cada carta são duas chamadas com raciocínio alto
  // (~25–70s cada). O worker aguenta; serializar só alonga o lote.
  const escrita = Promise.all(
    planos.map(async (plan) => ({
      plan,
      texto: await escrever(deps, plan, relacaoDe.get(`${plan.fromSeatKey}~${plan.toHouseId}`) ?? null),
    })),
  );
  const cartas = await Promise.race([
    escrita,
    new Promise<null>((r) => setTimeout(() => r(null), deps.deadlineMs ?? OUTREACH_DEADLINE_MS)),
  ]);
  if (!cartas) return [];

  const enviadas: DiplomaticMessage[] = [];
  for (const { plan, texto: carta } of cartas) {
    if (!carta) continue;
    const message: DiplomaticMessage = {
      id: deps.newId(),
      campaignId: deps.campaignId,
      turnNumber: deps.turnNumber,
      // O fio é sempre (Casa do jogador, Casa NPC), mesmo quando quem começa é
      // o NPC: assim a carta cai onde o jogador já procura correspondência.
      fromHouseId: plan.toHouseId,
      toHouseKey: plan.fromSeatKey,
      author: "AI",
      body: clampMessage(carta.texto),
      replyToId: null,
      toCharacterId: null,
      createdAt: new Date().toISOString(),
    };
    await deps.putMessage(message);
    enviadas.push(message);

    // A proposta vira dívida pendente no razão. O jogador aceita ou recusa; a
    // IA propõe, o consentimento é que cria o registro.
    if (deps.putFavor && carta.oferta && carta.pedido) {
      // Fora de escala, a proposta não ganha botão de aceitar. A CARTA sai
      // igual: carta que some é jogador escrevendo no vazio, e isso é pior.
      // O que não pode existir é o jogador aceitar com um clique uma entrega
      // que ninguém no mundo consegue cumprir.
      const absurdo = escalaAbsurda(`${carta.oferta} ${carta.pedido}`);
      if (absurdo) {
        console.warn(
          "Troca fora de escala, favor não gravado:",
          plan.fromSeatKey, "->", plan.toHouseId, "|", absurdo,
          "|", carta.oferta, "por", carta.pedido,
        );
      } else {
        const agora = new Date().toISOString();
        await deps.putFavor({
          id: `${message.id}-favor`,
          campaignId: deps.campaignId,
          fromHouseId: plan.fromSeatKey,
          toHouseId: plan.toHouseId,
          amount: 1,
          status: "PENDING",
          reason: `${plan.fromSeatName} oferece ${carta.oferta} e pede ${carta.pedido}.`,
          createdAt: agora,
          updatedAt: agora,
        });
      }
    }
  }
  return enviadas;
}

interface CartaEscrita {
  texto: string;
  oferta: string;
  pedido: string;
}

async function escrever(
  deps: OutreachDeps,
  plan: OutreachPlan,
  relation: OutreachDeps["relations"][number] | null,
): Promise<CartaEscrita | null> {
  try {
    const user = buildOutreachUser({
      plan,
      relation: relation as never,
      publicEvent: deps.publicEvent,
      recentPublicResult: deps.recentPublicResult,
      publicObservation: deps.publicObservations[plan.toHouseId] ?? "",
      worldFacts: deps.worldFacts,
      chronicle: deps.chronicle,
      dossie: deps.dossieDe ? await deps.dossieDe(plan.toHouseId, plan.fromSeatKey) : undefined,
      npcDynamic: deps.dynamicDe ? await deps.dynamicDe(plan.fromSeatKey) : undefined,
    });
    // Teto 4000, o mesmo da resposta. Os tokens de raciocínio saem do MESMO
    // orçamento da carta. A 900 o modelo pensava o orçamento inteiro e
    // devolvia string vazia — as três cartas de abertura do Turno 9 voltaram
    // com zero caractere, e o mundo ficou mudo sem erro em lugar nenhum.
    // 2200 bastava no raciocínio padrão; com reasoning_effort alto o modelo
    // pensa mais, e pensar mais sai daqui. A repetição cobre o vazio
    // ocasional, que é aleatório e não some só subindo o teto.
    let raw = await deps.chat!(OUTREACH_SYSTEM_PROMPT, user, true, 4000);
    if (!raw.trim()) raw = await deps.chat!(OUTREACH_SYSTEM_PROMPT, user, true, 4000);
    if (!raw.trim()) {
      console.warn("Carta do mundo vazia após duas tentativas:", plan.fromSeatKey, "->", plan.toHouseName);
      return null;
    }
    const o = JSON.parse(raw) as Record<string, unknown>;
    const texto = typeof o.carta === "string" ? o.carta.trim() : "";
    if (texto.length <= 40) return null;
    // "troca" é opcional agora. Carta de aviso, ameaça ou acusação não tem
    // escambo, e antes tinha que inventar um para preencher o formato.
    // Aceita o formato antigo (oferta/pedido soltos) para não quebrar nada
    // que ainda esteja em voo quando isto subir.
    const t = (o.troca ?? o) as Record<string, unknown>;
    // Segunda leitura antes de sair. Falha para o lado seguro: qualquer
    // problema com o revisor e vale o rascunho.
    let final = texto;
    try {
      const rev = await deps.chat!(REVIEW_SYSTEM_PROMPT, buildReviewUser({ materialDoEscritor: user, rascunho: texto }), true, 4000);
      const r = parseRevisao(rev, texto);
      if (r) {
        final = r.carta;
        if (r.motivos.length) console.info("Carta do mundo revisada:", plan.fromSeatKey, "|", r.motivos.join(" | "));
      }
    } catch (e) {
      console.warn("Revisão falhou, segue o rascunho:", (e as Error)?.message);
    }

    const knownNames = [personaFor(plan.fromSeatKey)?.leaderName,
      ...houseRoster(plan.fromSeatKey).map((c) => c.name),
      ...codexBySeat(plan.fromSeatKey).map((n) => n.name),
    ].filter((n): n is string => !!n);
    return {
      texto: safeSignature(final, knownNames, plan.fromSeatName),
      // O JSON de troca pertence ao rascunho. Se o revisor mudou a carta,
      // não oferecer botão para termos que talvez não estejam mais nela.
      oferta: final === texto && typeof t.oferta === "string" ? encurtar(t.oferta) : "",
      pedido: final === texto && typeof t.pedido === "string" ? encurtar(t.pedido) : "",
    };
  } catch {
    // Modelo fora do ar ou JSON quebrado: esta carta não sai, as outras saem.
    return null;
  }
}
