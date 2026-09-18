import {
  SEATS,
  houseProfileFor,
  levelOf,
  type HouseProfile,
  type HouseRelation,
} from "@ravenloft/content";
import { ladoNaGuerra, sedePodeEscrever } from "./lados";

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

/**
 * Quantas cartas cada Casa de jogador recebe quando o turno abre.
 *
 * Era uma. Um mundo que escreve uma carta por turno a cada jogador não é um
 * reino em guerra: é um conhecido que manda notícia. Três dão o que o Mestre
 * pediu — que a correspondência pareça o reino inteiro se movendo ao mesmo
 * tempo — e é por isso que a seleção abaixo se esforça para que as três não
 * sejam a mesma carta com brasões diferentes.
 */
export const CARTAS_POR_JOGADOR = 3;

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
 * Escassez concreta rende carta boa num trimestre normal: nasce de um dado
 * que as duas Casas reconhecem. A partir do Turno 8 Valdren deixou de ser
 * esse trimestre. Com o reino em cerco, o planejador ainda preferia a
 * despensa — e o Clã Mandíbula de Osso, que sobe a muralha de Asterhall
 * todas as noites, escreveu a Solarion pedindo noventa rolos de tecido.
 * Reação ao que aconteceu e ao que o jogador fez vêm primeiro. A despensa
 * fica de reserva para quando o mundo está quieto.
 */
export function planOutreach(input: OutreachInput): OutreachPlan[] {
  // Uma sede destruída ou cercada não tem chancelaria para escrever. Sem isto,
  // a Casa Rimerberg — cuja fortaleza caiu — mandou proposta de comboio no
  // Turno 9, e a Coroa escreveu de dentro de uma cidade incomunicável.
  const npcSeats = SEATS.filter((s) => !input.playerSeatKeys.has(s.key) && sedePodeEscrever(s.key));
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
  //
  // Com o reino em cerco, a falta continua real — um povo precisa mesmo de
  // atadura e manta — mas ela deixa de ser assunto de estação. A carta do Clã
  // que o Mestre reprovou dizia "para gente viva" e ainda assim marcava quatro
  // carroças e quinze dias: o defeito estava na forma de nota de entrega, não
  // no pedido. Aqui o motivo diz qual das duas cartas escrever.
  const emCrise = !!input.publicEvent.trim();
  for (const seat of npcSeats) {
    for (const player of input.players) {
      if (planos.length >= input.limit * 3) break;
      const encaixe = complementaridade(houseProfileFor(seat.key), player.seatKey ? houseProfileFor(player.seatKey) : null);
      if (encaixe.length === 0) continue;
      const coisa = encaixe.slice(0, 2).join(" e ");
      candidatar(
        seat,
        player,
        "ESCASSEZ",
        emCrise
          ? `${seat.name} precisa de ${coisa}, e ${player.name} tem. Isto não é negócio de estação: diga o que ` +
            `está acontecendo com a sua gente que faz precisar disso AGORA, peça como quem precisa e ofereça o que ` +
            `puder. Nada de tabela de entrega — pedir socorro e fechar comboio são cartas diferentes.`
          : `${seat.name} precisa de ${coisa}, e ${player.name} tem. Escreva propondo a troca, ` +
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
          `O que acaba de acontecer no reino atinge ${seat.name}. Escreva a ${player.name} se posicionando: ` +
            `o que você quer deles neste momento, e o que faz se não der. O assunto é o que aconteceu, não o que falta na despensa.`,
        );
      }
    }
  }

  const peso: Record<OutreachKind, number> = { ORDEM: 0, EVENTO: 1, ESCASSEZ: 2, RELACAO: 3 };
  planos.sort((a, b) => peso[a.kind] - peso[b.kind]);

  const candidatosDe = new Map<string, OutreachPlan[]>();
  for (const p of planos) {
    const lista = candidatosDe.get(p.toHouseId) ?? [];
    lista.push(p);
    candidatosDe.set(p.toHouseId, lista);
  }

  const escolhidos: OutreachPlan[] = [];
  const escolhidasDe = new Map<string, OutreachPlan[]>();
  const remetentes = new Set<string>();
  const teto = Math.max(1, Math.ceil(input.limit / Math.max(1, input.players.length)));

  /**
   * A próxima carta deste jogador, ou nada se não sobrou remetente.
   *
   * Três cartas do mesmo tipo são três vezes a mesma carta com brasões
   * diferentes. Um ângulo novo vale mais que um motivo mais forte: quem reage
   * ao que o jogador fez, quem se posiciona sobre o que aconteceu e quem
   * precisa de alguma coisa dizem coisas diferentes — e é isso que faz a caixa
   * de entrada parecer um reino em vez de um formulário.
   */
  const escolhaPara = (houseId: string): OutreachPlan | undefined => {
    const jaTem = escolhidasDe.get(houseId) ?? [];
    const candidatos = candidatosDe.get(houseId) ?? [];
    const livre = (p: OutreachPlan) => !remetentes.has(p.fromSeatKey);
    const tipoNovo = (p: OutreachPlan) => !jaTem.some((j) => j.kind === p.kind);
    // E, dentro do mesmo tipo, um lado da guerra que ainda não escreveu. Três
    // Casas leais à Coroa pedindo socorro no mesmo turno é a mesma carta três
    // vezes; a ameaça de Drakorys e a oferta dos Corvos ao lado dela é o reino.
    const ladoNovo = (p: OutreachPlan) =>
      !jaTem.some((j) => ladoNaGuerra(j.fromSeatKey) === ladoNaGuerra(p.fromSeatKey));
    return (
      candidatos.find((p) => livre(p) && tipoNovo(p) && ladoNovo(p)) ??
      candidatos.find((p) => livre(p) && tipoNovo(p)) ??
      candidatos.find((p) => livre(p) && ladoNovo(p)) ??
      candidatos.find(livre)
    );
  };

  // Uma rodada por vez, e não a lista ordenada de uma varrida só: assim as
  // primeiras sedes enchiam a caixa do primeiro jogador e as últimas sempre
  // escreviam ao último — sempre as mesmas Casas falando com a mesma gente.
  for (let rodada = 0; rodada < teto; rodada++) {
    const pendentes = input.players.map((p) => p.houseId);
    while (pendentes.length > 0 && escolhidos.length < input.limit) {
      // Dentro da rodada, quem tem o motivo mais forte escolhe primeiro. Sem
      // isto uma carta genérica ao primeiro jogador da fila consumia a única
      // sede que tinha algo específico a dizer a outro: só Vargen reagia à
      // ordem de Solarion, e Vargen ia embora escrevendo a Khazdrun sobre o
      // cerco, que qualquer uma das onze sedes poderia ter escrito.
      let escolhido = -1;
      let escolha: OutreachPlan | undefined;
      pendentes.forEach((houseId, i) => {
        const e = escolhaPara(houseId);
        if (e && (!escolha || peso[e.kind] < peso[escolha.kind])) {
          escolha = e;
          escolhido = i;
        }
      });
      if (!escolha) break;
      const houseId = pendentes[escolhido];
      pendentes.splice(escolhido, 1);
      // Uma carta por remetente: três cartas da Coroa no mesmo turno não é o
      // mundo reagindo, é a mesma voz repetida.
      remetentes.add(escolha.fromSeatKey);
      escolhidasDe.set(houseId, [...(escolhidasDe.get(houseId) ?? []), escolha]);
      escolhidos.push(escolha);
    }
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
