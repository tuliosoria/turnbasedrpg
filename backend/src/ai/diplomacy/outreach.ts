import {
  SEATS,
  houseProfileFor,
  levelOf,
  type HouseProfile,
  type HouseRelation,
} from "@ravenloft/content";

/**
 * Quem escreve primeiro, para quem, e por quê.
 *
 * O mundo só parecia vivo quando um jogador puxava conversa: nenhuma Casa NPC
 * jamais tomava a iniciativa, então a diplomacia era um monólogo com eco. Aqui
 * escolhemos os pares e o motivo; a redação vem depois, e é outro assunto.
 *
 * A escolha é uma função pura de propósito — sorteio dentro do código de rede é
 * a coisa mais difícil de testar que existe.
 */
export type OutreachKind = "ESCASSEZ" | "ORDEM" | "EVENTO" | "RELACAO";

export interface OutreachPlan {
  /** Sede da Casa NPC que escreve. */
  fromSeatKey: string;
  fromSeatName: string;
  /** Casa de jogador que recebe. */
  toHouseId: string;
  toHouseName: string;
  /** Sede da Casa do jogador, para achar o perfil dela. */
  toSeatKey: string | null;
  kind: OutreachKind;
  /** Uma linha, em português, dizendo ao redator por que esta carta existe. */
  motive: string;
}

export interface OutreachInput {
  /** As Casas vivas de jogador, com a sede correspondente. */
  players: { houseId: string; name: string; seatKey: string | null }[];
  /** Sedes já ocupadas por jogador — essas não escrevem, quem escreve é gente. */
  playerSeatKeys: Set<string>;
  /** As relações que o Mestre definiu, na direção NPC → jogador. */
  relations: HouseRelation[];
  /** O evento público do turno, resumido. */
  publicEvent: string;
  /** A ordem que cada Casa escreveu no turno anterior, por houseId. */
  lastOrders: Record<string, string>;
  /** Pares que já se falaram neste turno — não geramos carta em cima de conversa viva. */
  alreadyTalking: Set<string>;
  /** Quantas cartas queremos. */
  limit: number;
}

/**
 * As mercadorias de Valdren.
 *
 * Casar frase solta com frase solta não funcionava: "O Vale da Coroa dá grão e
 * o rio dá transporte" virava a string inteira, que nunca bate com "falta
 * ferro". A economia daqui é uma lista curta e fechada, então procuramos
 * mercadorias nomeadas dos dois lados e comparamos coisas com coisas.
 */
const MERCADORIAS: { nome: string; termos: string[] }[] = [
  { nome: "grão", termos: ["grão", "graos", "grãos", "trigo", "alimento", "lavoura", "cereal", "terra cultivada", "comida"] },
  { nome: "ferro", termos: ["ferro", "metal", "aço"] },
  { nome: "madeira", termos: ["madeira", "lenha"] },
  { nome: "pedra", termos: ["pedra", "cantaria"] },
  { nome: "carvão", termos: ["carvão"] },
  { nome: "sal", termos: ["sal"] },
  { nome: "peixe", termos: ["peixe", "pesca"] },
  { nome: "remédio", termos: ["remédio", "remedio", "cuidado", "hospital"] },
  { nome: "peles", termos: ["peles", "couro"] },
  { nome: "caça", termos: ["caça", "rebanho", "gado"] },
  { nome: "ervas", termos: ["erva", "ervas"] },
  { nome: "ouro", termos: ["ouro", "prata", "moeda", "crédito"] },
  { nome: "mitril", termos: ["mitril", "mithril"] },
  { nome: "tecido", termos: ["tecido", "tecidos", "seda", "lã"] },
  { nome: "especiaria", termos: ["especiaria", "especiarias"] },
  { nome: "vidro", termos: ["vidro", "lente", "lentes"] },
];

function mercadoriasEm(texto: string): string[] {
  const t = texto.toLowerCase();
  return MERCADORIAS.filter((m) => m.termos.some((termo) => t.includes(termo))).map((m) => m.nome);
}

/**
 * Onde o texto passa a falar de escassez.
 *
 * "Falta ferro", "carece de", "não produz", "depende de" — todas marcam o mesmo
 * ponto de virada na frase. O que vem antes é sobra; o que vem depois é falta.
 */
const VIRADA = /falta[m]?|carece[m]?\s+de|carece[m]?|não produz|nao produz|depende de|não sustenta|escass/i;

export function faltas(profile: HouseProfile | null): string[] {
  if (!profile) return [];
  const partes = profile.resources.split(VIRADA);
  return partes.length > 1 ? mercadoriasEm(partes.slice(1).join(" ")) : [];
}

export function sobras(profile: HouseProfile | null): string[] {
  if (!profile) return [];
  const antes = profile.resources.split(VIRADA)[0] ?? "";
  const faltando = new Set(faltas(profile));
  // Uma Casa pode citar a mesma mercadoria dos dois lados ("o porto traz
  // peixe... falta alimento"). A falta manda: ninguém vende o que lhe falta.
  return mercadoriasEm(antes).filter((m) => !faltando.has(m));
}

/**
 * O encaixe entre a falta de um e a sobra do outro.
 *
 * É a mesma conta que a carta de resposta faz, só que aqui ela decide QUEM tem
 * motivo para escrever: quem precisa procura quem tem.
 */
export function complementaridade(carente: HouseProfile | null, provedor: HouseProfile | null): string[] {
  const querem = new Set(faltas(carente));
  return sobras(provedor).filter((s) => querem.has(s));
}

function pairKey(a: string, b: string): string {
  return `${a}~${b}`;
}

/**
 * Monta até `limit` cartas, uma por par, preferindo motivos fortes.
 *
 * A ordem importa: escassez concreta rende a melhor carta, porque nasce de um
 * dado que as duas Casas reconhecem. Reação a ordem e a evento vêm depois, e
 * relação pura é o último recurso — é a que mais facilmente vira carta genérica.
 */
export function planOutreach(input: OutreachInput): OutreachPlan[] {
  const npcSeats = SEATS.filter((s) => !input.playerSeatKeys.has(s.key));
  const relacaoDe = new Map(input.relations.map((r) => [pairKey(r.fromKey, r.toKey), r]));
  const planos: OutreachPlan[] = [];
  const usados = new Set<string>();

  const candidatar = (
    seat: { key: string; name: string },
    player: { houseId: string; name: string; seatKey: string | null },
    kind: OutreachKind,
    motive: string,
  ) => {
    const chave = pairKey(seat.key, player.houseId);
    if (usados.has(chave)) return;
    if (input.alreadyTalking.has(pairKey(player.houseId, seat.key))) return;
    usados.add(chave);
    planos.push({
      fromSeatKey: seat.key,
      fromSeatName: seat.name,
      toHouseId: player.houseId,
      toHouseName: player.name,
      toSeatKey: player.seatKey,
      kind,
      motive,
    });
  };

  // 1. Escassez: quem precisa procura quem tem. O motivo já nomeia a coisa.
  for (const seat of npcSeats) {
    for (const player of input.players) {
      if (planos.length >= input.limit * 3) break;
      const encaixe = complementaridade(houseProfileFor(seat.key), player.seatKey ? houseProfileFor(player.seatKey) : null);
      if (encaixe.length === 0) continue;
      candidatar(
        seat,
        player,
        "ESCASSEZ",
        `${seat.name} precisa de ${encaixe.slice(0, 2).join(" e ")}, e ${player.name} tem. Escreva propondo a troca, ` +
          `oferecendo o que a sua Casa produz de sobra.`,
      );
    }
  }

  // 2. O que o jogador fez no turno passado, e alguém notou.
  for (const player of input.players) {
    const ordem = (input.lastOrders[player.houseId] ?? "").trim();
    if (!ordem) continue;
    for (const seat of npcSeats) {
      const rel = relacaoDe.get(pairKey(seat.key, player.houseId)) ?? null;
      if (!rel) continue;
      candidatar(
        seat,
        player,
        "ORDEM",
        `${player.name} agiu de forma visível no turno passado. ${seat.name} tomou conhecimento e responde a isso — ` +
          `apoiando, cobrando explicação ou advertindo, conforme a relação entre vocês.`,
      );
    }
  }

  // 3. O evento do turno mexeu com todo mundo; alguém se posiciona.
  if (input.publicEvent.trim()) {
    for (const seat of npcSeats) {
      for (const player of input.players) {
        candidatar(
          seat,
          player,
          "EVENTO",
          `O que acaba de acontecer no reino atinge ${seat.name}. Escreva a ${player.name} se posicionando e ` +
            `propondo algo concreto diante disso.`,
        );
      }
    }
  }

  // Motivo forte primeiro, e no máximo uma carta por Casa de jogador para
  // ninguém abrir o turno com três cartas e outro com nenhuma.
  const peso: Record<OutreachKind, number> = { ESCASSEZ: 0, ORDEM: 1, EVENTO: 2, RELACAO: 3 };
  planos.sort((a, b) => peso[a.kind] - peso[b.kind]);

  const escolhidos: OutreachPlan[] = [];
  const porJogador = new Map<string, number>();
  const remetentes = new Set<string>();
  const teto = Math.max(1, Math.ceil(input.limit / Math.max(1, input.players.length)));
  for (const p of planos) {
    if (escolhidos.length >= input.limit) break;
    // Uma carta por remetente: três cartas da Coroa no mesmo turno não é o
    // mundo reagindo, é a mesma voz repetida.
    if (remetentes.has(p.fromSeatKey)) continue;
    const n = porJogador.get(p.toHouseId) ?? 0;
    if (n >= teto) continue;
    porJogador.set(p.toHouseId, n + 1);
    remetentes.add(p.fromSeatKey);
    escolhidos.push(p);
  }
  return escolhidos;
}

/** A relação NPC → jogador vira tom, como já acontece nas respostas. */
export function outreachTone(relation: HouseRelation | null): string {
  if (!relation) return "Vocês mal se conhecem: seja formal, direto e não presuma intimidade.";
  const amizade = levelOf(relation.amizade);
  if (amizade === "BOM") return "Vocês se dão bem: escreva com franqueza e proponha sem rodeios.";
  if (amizade === "RUIM") return "Você desconfia deles: seja frio, exija garantia e não conceda nada de graça.";
  return "Cortesia medida: nem aliado, nem inimigo.";
}
